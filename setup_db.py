import sqlite3
from datetime import datetime

# Connect to SQLite database
conn = sqlite3.connect("bus_tracker.db")
cursor = conn.cursor()

# Drop tables if they exist (for clean re-run)
cursor.executescript("""
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS buses;
DROP TABLE IF EXISTS stops;
DROP TABLE IF EXISTS notifications;
""")

# Create tables
cursor.execute("""
CREATE TABLE routes (
    route_id INTEGER PRIMARY KEY,
    route_no TEXT,
    route_name TEXT,
    start_point TEXT,
    end_point TEXT
)
""")

cursor.execute("""
CREATE TABLE buses (
    bus_id INTEGER PRIMARY KEY,
    bus_number TEXT,
    route_id INTEGER,
    latitude REAL,
    longitude REAL,
    speed INTEGER,
    occupancy INTEGER,
    last_updated TIMESTAMP
)
""")

cursor.execute("""
CREATE TABLE stops (
    stop_id INTEGER PRIMARY KEY,
    stop_name TEXT,
    latitude REAL,
    longitude REAL,
    route_id INTEGER,
    sequence INTEGER
)
""")

cursor.execute("""
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY,
    message TEXT,
    type TEXT,
    bus_id INTEGER,
    timestamp TIMESTAMP
)
""")

# Insert sample routes
routes = [
    (1, "218K", "Koti–Kondapur", "Koti", "Kondapur"),
    (2, "8C", "Secunderabad–Mehdipatnam", "Secunderabad", "Mehdipatnam"),
    (3, "10H", "Charminar–Hitech City", "Charminar", "Hitech City"),
    (4, "127K", "Koti–Kukatpally", "Koti", "Kukatpally"),
    (5, "225D", "Dilsukhnagar–Gachibowli", "Dilsukhnagar", "Gachibowli")
]
cursor.executemany("INSERT INTO routes VALUES (?, ?, ?, ?, ?)", routes)

# Insert sample buses
buses = [
    (1, "HYD001", 1, 17.4375, 78.4483, 32, 60, datetime.now()),
    (2, "HYD002", 1, 17.4440, 78.3936, 28, 45, datetime.now()),
    (3, "HYD003", 2, 17.4065, 78.4691, 35, 70, datetime.now()),
    (4, "HYD004", 2, 17.3986, 78.4567, 30, 50, datetime.now()),
    (5, "HYD005", 3, 17.4239, 78.4128, 40, 80, datetime.now())
]
cursor.executemany("INSERT INTO buses VALUES (?, ?, ?, ?, ?, ?, ?, ?)", buses)

# Insert sample stops
stops = [
    (1, "Koti", 17.3850, 78.4867, 1, 1),
    (2, "Ameerpet", 17.4375, 78.4483, 1, 2),
    (3, "Madhapur", 17.4440, 78.3936, 1, 3),
    (4, "Kondapur", 17.4700, 78.3800, 1, 4),
    (5, "Secunderabad", 17.4399, 78.4983, 2, 1),
    (6, "Lakdikapul", 17.4065, 78.4691, 2, 2),
    (7, "Masab Tank", 17.3986, 78.4567, 2, 3),
    (8, "Mehdipatnam", 17.3950, 78.4400, 2, 4)
]
cursor.executemany("INSERT INTO stops VALUES (?, ?, ?, ?, ?, ?)", stops)

# Insert sample notifications
notifications = [
    (1, "Bus HYD001 delayed by 10 mins", "delay", 1, datetime.now()),
    (2, "Bus HYD003 overcrowded", "crowd", 3, datetime.now()),
    (3, "Route 218K service resumed", "service", None, datetime.now())
]
cursor.executemany("INSERT INTO notifications VALUES (?, ?, ?, ?, ?)", notifications)

# Commit and close
conn.commit()
conn.close()
print("Database setup complete.")