from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from typing import List
import sqlite3
import json
import asyncio
import random
from datetime import datetime, timedelta
import uvicorn

app = FastAPI(title="Bus Tracker")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

def get_db_connection():
    conn = sqlite3.connect("bus_tracker.db")
    conn.row_factory = sqlite3.Row
    return conn

# Database setup
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS buses (
        bus_id INTEGER PRIMARY KEY,
        bus_number TEXT,
        route_id INTEGER,
        latitude REAL,
        longitude REAL,
        speed REAL,
        occupancy INTEGER,
        last_updated TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS routes (
        route_id INTEGER PRIMARY KEY,
        route_no TEXT,
        route_name TEXT,
        start_point TEXT,
        end_point TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stops (
        stop_id INTEGER PRIMARY KEY,
        stop_name TEXT,
        latitude REAL,
        longitude REAL,
        route_id INTEGER,
        sequence INTEGER
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY,
        message TEXT,
        type TEXT,
        bus_id INTEGER,
        timestamp TIMESTAMP
    )
    """)

    # Insert sample data
    sample_routes = [
        (1, "Route A", "City Center", "Airport"),
        (2, "Route B", "Railway Station", "Mall"),
        (3, "Route C", "Hospital", "University")
    ]

    sample_stops = [
        (1, "City Center", 17.3850, 78.4867, 1),
        (2, "Metro Station", 17.3900, 78.4900, 1),
        (3, "Airport", 17.2403, 78.4294, 1),
        (4, "Railway Station", 17.3616, 78.4747, 2),
        (5, "Shopping Mall", 17.4065, 78.4772, 2),
        (6, "Hospital", 17.4126, 78.4071, 3),
        (7, "University", 17.4599, 78.3747, 3)
    ]

    sample_buses = [
        (1, "BUS001", 1, 17.3850, 78.4867, 25.5, 45, datetime.now()),
        (2, "BUS002", 1, 17.3900, 78.4900, 30.0, 60, datetime.now()),
        (3, "BUS003", 2, 17.3616, 78.4747, 20.0, 35, datetime.now()),
        (4, "BUS004", 3, 17.4126, 78.4071, 28.0, 50, datetime.now())
    ]

    cursor.executemany("INSERT OR REPLACE INTO routes VALUES (?, ?, ?, ?, ?)", sample_routes)
    cursor.executemany("INSERT OR REPLACE INTO stops VALUES (?, ?, ?, ?, ?)", sample_stops)
    cursor.executemany("INSERT OR REPLACE INTO buses VALUES (?, ?, ?, ?, ?, ?, ?, ?)", sample_buses)

    conn.commit()
    conn.close()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except WebSocketDisconnect:
                self.disconnect(connection)

manager = ConnectionManager()

# Models
class BusLocation(BaseModel):
    id: int
    bus_number: str
    latitude: float
    longitude: float
    speed: float
    occupancy: int

class Arrival(BaseModel):
    route: str
    destination: str
    eta: int

# Routes
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})

@app.get("/api/stops")
async def get_stops():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM stops")
    stops = []
    for row in cursor.fetchall():
        stops.append({
            "id": row["stop_id"],
            "stop_name": row["stop_name"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "route_id": row["route_id"]
        })
    conn.close()
    return {"stops": stops}

@app.get("/api/routes")
async def get_routes():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM routes")
    routes = []
    for row in cursor.fetchall():
        routes.append({
            "id": row["route_id"],
            "route_name": row["route_name"],
            "start_point": row["start_point"],
            "end_point": row["end_point"]
        })
    conn.close()
    return {"routes": routes}

@app.get("/api/arrivals/{stop_id}")
async def get_arrivals(stop_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT route_id FROM stops WHERE stop_id = ?", (stop_id,))
    result = cursor.fetchone()

    if result:
        route_id = result["route_id"]
        cursor.execute("SELECT * FROM buses WHERE route_id = ?", (route_id,))
        buses = cursor.fetchall()

        arrivals = []
        for bus in buses:
            # Calculate mock arrival time (2-15 minutes)
            arrival_time = datetime.now() + timedelta(minutes=random.randint(2, 15))
            arrivals.append({
                "bus_number": bus["bus_number"],
                "estimated_arrival": arrival_time.strftime("%H:%M"),
                "occupancy": bus["occupancy"]
            })
    else:
        arrivals = []

    conn.close()
    return {"arrivals": arrivals}

# Updated search_routes function in main.py
@app.get("/api/search_routes")
async def search_routes(start: str = Query(...), end: str = Query(...)):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Select the new path column
    cursor.execute("SELECT route_id, route_no, route_name, start_point, end_point, path FROM routes")
    routes = cursor.fetchall()

    result_routes = []

    for route in routes:
        route_id = route["route_id"]
        # Use the correct column for stop id
        cursor.execute("SELECT stop_name, latitude, longitude FROM stops WHERE route_id = ?", (route_id,))
        stops = cursor.fetchall()

        stop_names = [stop["stop_name"].lower() for stop in stops]
        if start.lower() in stop_names and end.lower() in stop_names:
            stops_formatted = [{"stop_name": s["stop_name"], "latitude": s["latitude"], "longitude": s["longitude"]} for s in stops]
            
            # Parse the path from the database
            path_data = json.loads(route["path"]) if route["path"] else []
            
            result_routes.append({
                "id": route_id,
                "route_no": route["route_no"], # Use the correct column for route_no
                "route_name": route["route_name"],
                "start_point": route["start_point"],
                "end_point": route["end_point"],
                "stops": stops_formatted,
                "path": path_data # Add the path data
            })

    conn.close()
    return {"routes": result_routes}

@app.get("/api/nearby_stops")
async def nearby_stops(lat: float, lon: float, radius: float = 0.01):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT *, 
        ((latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?)) as distance
        FROM stops
        HAVING distance < ?
        ORDER BY distance
    """, (lat, lat, lon, lon, radius * radius))

    stops = []
    for row in cursor.fetchall():
        stops.append({
            "id": row["stop_id"],
            "stop_name": row["stop_name"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "route_id": row["route_id"]
        })

    conn.close()
    return {"stops": stops}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Simulate real-time bus updates
            await asyncio.sleep(5)  # Update every 5 seconds

            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM buses")
            buses = cursor.fetchall()

            for bus in buses:
                # Simulate GPS movement
                new_lat = bus["latitude"] + random.uniform(-0.001, 0.001)
                new_lon = bus["longitude"] + random.uniform(-0.001, 0.001)
                new_speed = max(0, bus["speed"] + random.uniform(-5, 5))
                new_occupancy = max(0, min(100, bus["occupancy"] + random.randint(-5, 5)))

                cursor.execute("""
                    UPDATE buses 
                    SET latitude=?, longitude=?, speed=?, occupancy=?, last_updated=?
                    WHERE bus_id=?
                """, (new_lat, new_lon, new_speed, new_occupancy, datetime.now(), bus["bus_id"]))

            conn.commit()
            
            # Get updated data
            cursor.execute("SELECT * FROM buses")
            updated_buses = []
            for row in cursor.fetchall():
                updated_buses.append({
                    "id": row["bus_id"],
                    "bus_number": row["bus_number"],
                    "route_id": row["route_id"],
                    "latitude": row["latitude"],
                    "longitude": row["longitude"],
                    "speed": row["speed"],
                    "occupancy": row["occupancy"]
                })

            conn.close()

            # Broadcast updates
            await manager.broadcast(json.dumps({
                "type": "bus_update",
                "data": updated_buses
            }))

            # Send notifications occasionally
            if random.random() < 0.1:  # 10% chance
                notification = {
                    "type": "notification",
                    "message": "Bus BUS001 is experiencing delays",
                    "severity": "warning"
                }
                await manager.broadcast(json.dumps(notification))

    except WebSocketDisconnect:
        manager.disconnect(websocket)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)