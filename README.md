# Bus Tracker - Real-time Public Transport Tracking

A complete web application for real-time bus tracking in small cities and tier-2 towns, optimized for low-bandwidth environments.

## Features

✅ **Real-time GPS bus location tracking** with interactive maps  
✅ **Live arrival time estimates** at bus stops with route information  
✅ **Bus route search functionality** with stop-wise journey planning  
✅ **Mobile-responsive design** optimized for low-bandwidth connections  
✅ **Real-time notifications** for delays, overcrowding, and service updates  
✅ **Transport authority dashboard** for fleet monitoring and analytics  
✅ **Bus stop finder** with nearby stops and route information  
✅ **Data compression and caching** for optimal performance  
✅ **Progressive Web App (PWA)** with offline functionality  
✅ **No API keys required** - uses OpenStreetMap and Leaflet.js  

## Tech Stack

- **Backend:** Python FastAPI with WebSocket support
- **Database:** SQLite (easily upgradeable to PostgreSQL)
- **Frontend:** Vanilla JavaScript with Leaflet.js maps
- **Maps:** OpenStreetMap tiles (no API keys needed)
- **Styling:** Mobile-first responsive CSS
- **Real-time:** WebSocket connections for live updates
- **PWA:** Service worker for offline functionality

## Installation & Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the application:**
   ```bash
   python main.py
   ```

3. **Access the app:**
   - Public interface: `http://localhost:5000`
   - Admin dashboard: `http://localhost:5000/admin`

## File Structure

```
bus_tracker/
├── main.py                 # FastAPI backend server
├── requirements.txt        # Python dependencies
├── .replit                # Replit deployment config
├── templates/
│   ├── index.html         # Main user interface
│   └── admin.html         # Transport authority dashboard
├── static/
│   ├── css/
│   │   └── style.css      # Mobile-responsive styles
│   ├── js/
│   │   ├── app.js         # Main frontend JavaScript
│   │   └── admin.js       # Admin dashboard JavaScript
│   ├── manifest.json      # PWA manifest
│   └── sw.js             # Service worker for offline support
└── bus_tracker.db         # SQLite database (auto-created)
```

## Key Features Explained

### Real-time Tracking
- WebSocket connections provide live bus location updates
- GPS coordinates are simulated for demonstration (integrate with real GPS in production)
- Interactive map shows buses and stops with detailed popups

### Mobile Optimization
- Responsive design works on all screen sizes
- Optimized for touch interactions
- Data compression for slow network connections
- Offline functionality with service worker

### Search & Navigation
- Route search between any two points
- Stop finder with proximity detection
- Real-time arrival estimates
- Journey planning with multiple stops

### Admin Dashboard
- Fleet monitoring with real-time status
- Route performance analytics
- Alert system for delays and issues
- Occupancy monitoring and statistics

## Deployment

### On Replit
1. Upload all files to a new Replit project
2. The `.replit` file will auto-configure the environment
3. Click "Run" - the app will be accessible via the provided URL

### On Other Platforms
1. Set up Python 3.11+ environment
2. Install dependencies: `pip install -r requirements.txt`
3. Run: `python main.py`
4. Configure port 5000 or set PORT environment variable

## Configuration

### Database
- Default: SQLite for simplicity
- Production: Change to PostgreSQL in main.py
- Sample data included for demonstration

### Maps
- Uses OpenStreetMap (no API keys required)
- Can be changed to other tile providers in app.js
- Offline map caching supported

### Real-time Updates
- WebSocket connections for live data
- 5-second update intervals (configurable)
- Automatic reconnection on connection loss

## Browser Support

- Chrome/Edge: Full support including PWA
- Firefox: Full support
- Safari: Full support with PWA
- Mobile browsers: Optimized experience
- Works offline after first visit

## License

Open source - modify and use freely for public transport solutions.
