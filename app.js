// Main application JavaScript
class BusTracker {
    constructor() {
        this.map = null;
        this.buses = [];
        this.stops = [];
        this.routes = [];
        this.busMarkers = [];
        this.stopMarkers = [];
        this.routeLine = null; // New property to store the route polyline
        this.socket = null;
        this.userLocation = null;
        this.currentTab = 'map';

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initMap();
        this.connectWebSocket();
        await this.loadInitialData();
        this.startLocationTracking();
        this.setupOfflineDetection();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Search form
        document.getElementById('search-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.searchRoutes();
        });

        // Stop search
        document.getElementById('stop-search').addEventListener('input', (e) => {
            this.filterStops(e.target.value);
        });

        // Arrival stop selection
        document.getElementById('arrival-stop').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadArrivals(parseInt(e.target.value));
            }
        });

        // Map controls
        document.getElementById('locate-btn').addEventListener('click', () => {
            this.trackUserLocation();
        });

        // Back button for arrivals
        document.getElementById('back-btn').addEventListener('click', () => {
            this.switchTab('stops');
        });
    }

    initMap() {
        if (!this.map) {
            // Initialize the map and set the initial view
            this.map = L.map('mapid').setView([17.3850, 78.4867], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18,
            }).addTo(this.map);
        }
    }

    async loadInitialData() {
        // Load all stops
        await fetch('/api/stops')
            .then(response => response.json())
            .then(data => {
                this.stops = data.stops;
                this.renderStops();
                this.populateStopSelect();
            })
            .catch(error => console.error('Error fetching stops:', error));

        // Load all routes
        await fetch('/api/routes')
            .then(response => response.json())
            .then(data => {
                this.routes = data.routes;
            })
            .catch(error => console.error('Error fetching routes:', error));
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        if (this.socket) {
            this.socket.close();
        }

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            this.showNotification('Connected to real-time bus updates.', 'success');
            document.getElementById('status-text').textContent = 'Connected';
            document.body.classList.remove('offline');
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'bus_update') {
                this.buses = data.data;
                this.updateBusMarkers();
            } else if (data.type === 'notification') {
                this.showNotification(data.message, data.severity);
            }
        };

        this.socket.onclose = (event) => {
            this.showNotification('Disconnected from server. Reconnecting...', 'warning');
            document.getElementById('status-text').textContent = 'Disconnected';
            setTimeout(() => this.connectWebSocket(), 3000); // Attempt to reconnect
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            this.showNotification('Connection error. Check network.', 'error');
        };
    }

    updateBusMarkers() {
        // Clear all existing bus markers
        this.busMarkers.forEach(marker => this.map.removeLayer(marker));
        this.busMarkers = [];

        const busIcon = L.divIcon({
            className: 'bus-marker',
            html: '🚌',
            iconSize: [25, 25],
            iconAnchor: [12, 12]
        });

        // Add new markers for each bus
        this.buses.forEach(bus => {
            const lat = parseFloat(bus.latitude);
            const lon = parseFloat(bus.longitude);

            if (!isNaN(lat) && !isNaN(lon)) {
                const marker = L.marker([lat, lon], { icon: busIcon }).addTo(this.map);
                marker.bindPopup(`<b>Bus ${bus.bus_number}</b><br>Route: ${bus.route_id}<br>Speed: ${bus.speed} km/h<br>Occupancy: ${bus.occupancy}%`);
                this.busMarkers.push(marker);
            }
        });
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        document.getElementById(`${tabId}-tab`).style.display = 'block';
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        this.currentTab = tabId;

        if (tabId === 'map') {
            this.map.invalidateSize(); // Fix map rendering issue
        }
    }

    filterStops(query) {
        const list = document.getElementById('stops-list');
        list.innerHTML = '';
        const filtered = this.stops.filter(stop =>
            stop.stop_name.toLowerCase().includes(query.toLowerCase())
        );

        if (filtered.length > 0) {
            filtered.forEach(stop => {
                const item = document.createElement('div');
                item.className = 'stop-item';
                item.innerHTML = `
                    <h4>${stop.stop_name}</h4>
                    <p>Route: ${stop.route_id}</p>
                    <button onclick="window.app.loadArrivals(${stop.id})">Arrivals</button>
                    <button onclick="window.app.map.setView([${stop.latitude}, ${stop.longitude}], 15)">View on Map</button>
                `;
                list.appendChild(item);
            });
        } else {
            list.innerHTML = '<p class="info-message">No stops found.</p>';
        }
    }

    populateStopSelect() {
        const select = document.getElementById('arrival-stop');
        select.innerHTML = '<option value="">--Select Stop--</option>';
        this.stops.forEach(stop => {
            const option = document.createElement('option');
            option.value = stop.id;
            option.textContent = stop.stop_name;
            select.appendChild(option);
        });
    }

    loadArrivals(stopId) {
        fetch(`/api/arrivals/${stopId}`)
            .then(response => response.json())
            .then(data => {
                const list = document.getElementById('arrivals-list');
                list.innerHTML = '';
                if (data.arrivals && data.arrivals.length > 0) {
                    data.arrivals.forEach(arrival => {
                        const item = document.createElement('div');
                        item.className = 'arrival-item';
                        item.innerHTML = `
                            <h4>Bus ${arrival.bus_number}</h4>
                            <p>Estimated Arrival: ${arrival.estimated_arrival}</p>
                            <p>Occupancy: ${arrival.occupancy}%</p>
                        `;
                        list.appendChild(item);
                    });
                } else {
                    list.innerHTML = '<p class="info-message">No upcoming arrivals.</p>';
                }
                this.switchTab('arrivals');
            })
            .catch(error => console.error('Error fetching arrivals:', error));
    }

    // New and corrected function to search routes and draw them
    searchRoutes() {
        const start = document.getElementById('start-search').value;
        const end = document.getElementById('end-search').value;
        const resultsContainer = document.getElementById('search-results');

        // Clear previous results and route lines
        resultsContainer.innerHTML = '';
        this.clearAllRoutes();

        if (!start || !end) {
            resultsContainer.innerHTML = '<p class="info-message">Please enter both a start and end point.</p>';
            return;
        }

        // Show loading spinner
        resultsContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        fetch(`/api/search_routes?start=${start}&end=${end}`)
            .then(response => response.json())
            .then(data => {
                resultsContainer.innerHTML = '';
                if (data.routes && data.routes.length > 0) {
                    data.routes.forEach(route => {
                        const routeElement = document.createElement('div');
                        routeElement.className = 'route-card';
                        routeElement.innerHTML = `
                            <h4>🚌 Route ${route.route_no} - ${route.route_name}</h4>
                            <p><strong>From:</strong> ${route.start_point}</p>
                            <p><strong>To:</strong> ${route.end_point}</p>
                            <ul class="stop-list">
                                ${route.stops.map(stop => `<li>${stop.stop_name}</li>`).join('')}
                            </ul>
                        `;
                        resultsContainer.appendChild(routeElement);

                        // Draw the route on the map
                        this.drawRouteOnMap(route.path);
                    });
                } else {
                    resultsContainer.innerHTML = '<p class="info-message">No routes found for your search.</p>';
                }
            })
            .catch(error => {
                console.error('Error searching routes:', error);
                resultsContainer.innerHTML = '<p class="error-message">Failed to load routes. Please try again later.</p>';
            });
    }

    // New function to draw a route polyline on the map
    drawRouteOnMap(path) {
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
        }
        if (path && path.length > 1) {
            this.routeLine = L.polyline(path, {
                color: '#2196F3',
                weight: 5,
                opacity: 0.7
            }).addTo(this.map);
            this.map.fitBounds(this.routeLine.getBounds());
        }
    }

    // New function to clear all previously drawn route lines and stops
    clearAllRoutes() {
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
            this.routeLine = null;
        }
    }

    trackUserLocation() {
        if (!navigator.geolocation) {
            this.showNotification('Geolocation is not supported by your browser.', 'error');
            return;
        }

        const locateBtn = document.getElementById('locate-btn');
        locateBtn.textContent = 'Locating...';
        locateBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                this.map.setView([lat, lon], 15);
                this.showNearbyStops(lat, lon);
                locateBtn.textContent = 'My Location';
                locateBtn.disabled = false;
            },
            (error) => {
                console.error('Geolocation error:', error);
                this.showNotification('Unable to retrieve your location.', 'error');
                locateBtn.textContent = 'My Location';
                locateBtn.disabled = false;
            }
        );
    }

    showNearbyStops(lat, lon) {
        fetch(`/api/nearby_stops?lat=${lat}&lon=${lon}`)
            .then(response => response.json())
            .then(data => {
                if (this.stopMarkers) {
                    this.stopMarkers.forEach(marker => this.map.removeLayer(marker));
                }
                this.stopMarkers = [];

                data.stops.forEach(stop => {
                    const stopIcon = L.divIcon({
                        className: 'stop-marker',
                        html: '📍',
                        iconSize: [25, 25],
                        iconAnchor: [12, 12]
                    });
                    const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon }).addTo(this.map);
                    marker.bindPopup(`<b>${stop.stop_name}</b><br>Route: ${stop.route_id}`);
                    this.stopMarkers.push(marker);
                });
            })
            .catch(error => console.error('Error fetching nearby stops:', error));
    }

    showNotification(message, type = 'info') {
        const notificationsContainer = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div>${message}</div>
            <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 1.2rem; cursor: pointer;">&times;</button>
        `;

        notificationsContainer.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    setupOfflineDetection() {
        window.addEventListener('online', () => {
            this.showNotification('Connection restored', 'info');
            this.connectWebSocket();
        });

        window.addEventListener('offline', () => {
            this.showNotification('You are offline', 'warning');
            document.body.classList.add('offline');
        });

        // Check if already offline
        if (!navigator.onLine) {
            document.body.classList.add('offline');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BusTracker();
});

// Service Worker for PWA and caching (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
}