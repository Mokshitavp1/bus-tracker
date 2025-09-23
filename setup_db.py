import sqlite3
from datetime import datetime
import json

# Connect to SQLite database
conn = sqlite3.connect("bus_tracker.db")
cursor = conn.cursor()

# Drop tables if they exist (for a clean re-run)
cursor.executescript("""
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS buses;
DROP TABLE IF EXISTS stops;
DROP TABLE IF EXISTS notifications;
""")

# Create tables with updated schema
cursor.execute("""
CREATE TABLE routes (
    route_id INTEGER PRIMARY KEY,
    route_no TEXT,
    route_name TEXT,
    start_point TEXT,
    end_point TEXT,
    path TEXT
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

# Sample data with route paths
routes = [
    (1, "222A", "Koti–Kondapur", "Koti", "Kondapur", json.dumps([[17.3850, 78.4867], [17.4084, 78.4735], [17.4375, 78.4483]])),
    (2, "10H", "Secunderabad–Gachibowli", "Secunderabad", "Gachibowli", json.dumps([[17.4399, 78.4983], [17.4440, 78.3936], [17.4439, 78.3916]])),
    (3, "90L", "Dilsukhnagar–Gachibowli", "Dilsukhnagar", "Gachibowli", json.dumps([[17.3735, 78.5204], [17.4065, 78.4691], [17.4239, 78.4128]])),
]
cursor.executemany("INSERT INTO routes VALUES (?, ?, ?, ?, ?, ?)", routes)

# Insert sample buses
buses = [
    (1, "HYD001", 1, 17.4375, 78.4483, 32, 60, datetime.now()),
    (2, "HYD002", 1, 17.4440, 78.3936, 28, 45, datetime.now()),
    (3, "HYD003", 2, 17.4065, 78.4691, 35, 70, datetime.now()),
    (4, "HYD004", 2, 17.3986, 78.4567, 30, 50, datetime.now()),
    (5, "HYD005", 3, 17.4239, 78.4128, 40, 80, datetime.now()),
]
cursor.executemany("INSERT INTO buses VALUES (?, ?, ?, ?, ?, ?, ?, ?)", buses)

# Insert sample stops
stops = [
    (1, "Koti", 17.3850, 78.4867, 1, 1),
    (2, "Abids", 17.3986, 78.4751, 1, 2),
    (3, "Lakdikapul", 17.4084, 78.4735, 1, 3),
    (4, "Khairtabad", 17.4216, 78.4619, 1, 4),
    (5, "Panjagutta", 17.4344, 78.4526, 1, 5),
    (6, "Ameerpet", 17.4375, 78.4483, 1, 6),
    (7, "Jubilee Hills Check Post", 17.4369, 78.4184, 1, 7),
    (8, "Kondapur", 17.4440, 78.3936, 1, 8),
    (9, "Secunderabad", 17.4399, 78.4983, 2, 1),
    (10, "Paradise", 17.4440, 78.4851, 2, 2),
    (11, "Begumpet", 17.4488, 78.4642, 2, 3),
    (12, "Gachibowli", 17.4439, 78.3916, 2, 4),
    (13, "Dilsukhnagar", 17.3735, 78.5204, 3, 1),
    (14, "Malakpet", 17.3769, 78.4975, 3, 2),
    (15, "Nalgonda X Roads", 17.3941, 78.4842, 3, 3),
    (16, "Kachiguda", 17.4065, 78.4691, 3, 4),
    (17, "Himayatnagar", 17.4184, 78.4525, 3, 5),
    (18, "Toli Chowki", 17.4239, 78.4128, 3, 6)
]
cursor.executemany("INSERT INTO stops VALUES (?, ?, ?, ?, ?, ?)", stops)

# Commit changes and close connection
conn.commit()
conn.close()

print("Database initialized successfully with updated schema.")