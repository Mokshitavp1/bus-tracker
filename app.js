// Main application JavaScript
class BusTracker {
    constructor() {
        this.map = null;
        this.buses = [];
        this.stops = [];
        this.routes = [];
        this.busMarkers = [];
        this.stopMarkers = [];
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
            this.locateUser();
        });

        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshData();
        });

        // Menu toggle for mobile
        document.getElementById('menu-toggle').addEventListener('click', () => {
            document.getElementById('nav-menu').classList.toggle('active');
        });
    }

    initMap() {
        // Initialize Leaflet map with OpenStreetMap tiles (no API key required)
        this.map = L.map('map').setView([17.3850, 78.4867], 13);

        // Use OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
        }).addTo(this.map);

        // Custom bus icon
        this.busIcon = L.divIcon({
            className: 'bus-marker',
            html: '🚌',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        // Custom stop icon
        this.stopIcon = L.divIcon({
            className: 'stop-marker',
            html: '🚏',
            iconSize: [25, 25],
            iconAnchor: [12, 12]
        });
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            this.updateConnectionStatus('connected', 'Connected');
            console.log('WebSocket connected');
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.socket.onclose = () => {
            this.updateConnectionStatus('disconnected', 'Disconnected');
            console.log('WebSocket disconnected');
            // Attempt to reconnect after 3 seconds
            setTimeout(() => this.connectWebSocket(), 3000);
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('disconnected', 'Connection Error');
        };
    }

    handleWebSocketMessage(data) {
        if (data.type === 'bus_update') {
            this.updateBusLocations(data.data);
        } else if (data.type === 'notification') {
            this.showNotification(data.message, data.severity || 'info');
        }
    }

    updateConnectionStatus(status, text) {
        const statusEl = document.getElementById('connection-status');
        statusEl.className = `connection-status ${status}`;
        document.getElementById('status-text').textContent = text;
    }

    async loadInitialData() {
        try {
            // Load buses, stops, and routes
            const [busesRes, stopsRes, routesRes] = await Promise.all([
                fetch('/api/buses'),
                fetch('/api/stops'),
                fetch('/api/routes')
            ]);

            this.buses = await busesRes.json();
            const stopsData = await stopsRes.json();
            const routesData = await routesRes.json();

            this.stops = stopsData.stops;
            this.routes = routesData.routes;

            this.renderBusMarkers();
            this.renderStopMarkers();
            this.populateStopSelectors();
            this.renderStopsList();

        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Failed to load data. Please refresh.', 'error');
        }
    }

    renderBusMarkers() {
        // Clear existing bus markers
        this.busMarkers.forEach(marker => this.map.removeLayer(marker));
        this.busMarkers = [];

        // Add new bus markers
        this.buses.forEach(bus => {
            const marker = L.marker([bus.latitude, bus.longitude], {
                icon: this.busIcon
            }).addTo(this.map);

            const occupancyClass = bus.occupancy > 70 ? 'high' : bus.occupancy > 40 ? 'medium' : 'low';
            const popupContent = `
                <div class="bus-popup">
                    <h3>🚌 ${bus.bus_number}</h3>
                    <p><strong>Speed:</strong> ${bus.speed.toFixed(1)} km/h</p>
                    <p><strong>Occupancy:</strong> <span class="occupancy ${occupancyClass}">${bus.occupancy}%</span></p>
                    <p><strong>Route:</strong> ${this.getRouteName(bus.route_id)}</p>
                </div>
            `;

            marker.bindPopup(popupContent);
            this.busMarkers.push(marker);
        });
    }

    renderStopMarkers() {
        // Clear existing stop markers
        this.stopMarkers.forEach(marker => this.map.removeLayer(marker));
        this.stopMarkers = [];

        // Add new stop markers
        this.stops.forEach(stop => {
            const marker = L.marker([stop.latitude, stop.longitude], {
                icon: this.stopIcon
            }).addTo(this.map);

            const popupContent = `
                <div class="stop-popup">
                    <h3>🚏 ${stop.stop_name}</h3>
                    <p><strong>Route:</strong> ${this.getRouteName(stop.route_id)}</p>
                    <button onclick="app.loadArrivals(${stop.id})" class="btn-primary">Check Arrivals</button>
                </div>
            `;

            marker.bindPopup(popupContent);
            this.stopMarkers.push(marker);
        });
    }

    updateBusLocations(updatedBuses) {
        this.buses = updatedBuses;
        this.renderBusMarkers();
    }

    getRouteName(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        return route ? route.route_name : 'Unknown Route';
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Refresh map size if switching to map tab
        if (tabName === 'map') {
            setTimeout(() => this.map.invalidateSize(), 100);
        }
    }

    async searchRoutes() {
        const startStop = document.getElementById('start-stop').value.trim();
        const endStop = document.getElementById('end-stop').value.trim();

        if (!startStop || !endStop) {
            this.showNotification('Please enter both start and end points', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/search_routes?start=${encodeURIComponent(startStop)}&end=${encodeURIComponent(endStop)}`);
            const data = await response.json();

            this.renderSearchResults(data.routes);
        } catch (error) {
            console.error('Error searching routes:', error);
            this.showNotification('Failed to search routes', 'error');
        }
    }

    renderSearchResults(routes) {
        const resultsContainer = document.getElementById('search-results');

        if (routes.length === 0) {
            resultsContainer.innerHTML = '<p>No routes found matching your search criteria.</p>';
            return;
        }

        resultsContainer.innerHTML = routes.map(route => `
            <div class="result-item" onclick="app.showRouteOnMap(${route.id})">
                <h3>${route.route_name}</h3>
                <p><strong>From:</strong> ${route.start_point}</p>
                <p><strong>To:</strong> ${route.end_point}</p>
            </div>
        `).join('');
    }

    showRouteOnMap(routeId) {
        // Switch to map tab and highlight the route
        this.switchTab('map');

        // Filter and highlight buses for this route
        const routeBuses = this.buses.filter(bus => bus.route_id === routeId);
        const routeStops = this.stops.filter(stop => stop.route_id === routeId);

        if (routeBuses.length > 0 || routeStops.length > 0) {
            const group = new L.featureGroup([]);

            routeBuses.forEach(bus => {
                const marker = this.busMarkers.find(m => 
                    m.getLatLng().lat === bus.latitude && m.getLatLng().lng === bus.longitude
                );
                if (marker) group.addLayer(marker);
            });

            routeStops.forEach(stop => {
                const marker = this.stopMarkers.find(m => 
                    m.getLatLng().lat === stop.latitude && m.getLatLng().lng === stop.longitude
                );
                if (marker) group.addLayer(marker);
            });

            if (group.getLayers().length > 0) {
                this.map.fitBounds(group.getBounds(), { padding: [20, 20] });
            }
        }
    }

    populateStopSelectors() {
        const arrivalStopSelect = document.getElementById('arrival-stop');
        arrivalStopSelect.innerHTML = '<option value="">Select a bus stop</option>' +
            this.stops.map(stop => 
                `<option value="${stop.id}">${stop.stop_name} (${this.getRouteName(stop.route_id)})</option>`
            ).join('');
    }

    renderStopsList() {
        const stopsContainer = document.getElementById('stops-list');
        stopsContainer.innerHTML = this.stops.map(stop => `
            <div class="stop-item" onclick="app.showStopOnMap(${stop.latitude}, ${stop.longitude})">
                <h3>${stop.stop_name}</h3>
                <p><strong>Route:</strong> ${this.getRouteName(stop.route_id)}</p>
                <button onclick="event.stopPropagation(); app.loadArrivals(${stop.id})" class="btn-primary">Check Arrivals</button>
            </div>
        `).join('');
    }

    filterStops(query) {
        const filteredStops = this.stops.filter(stop => 
            stop.stop_name.toLowerCase().includes(query.toLowerCase()) ||
            this.getRouteName(stop.route_id).toLowerCase().includes(query.toLowerCase())
        );

        const stopsContainer = document.getElementById('stops-list');
        stopsContainer.innerHTML = filteredStops.map(stop => `
            <div class="stop-item" onclick="app.showStopOnMap(${stop.latitude}, ${stop.longitude})">
                <h3>${stop.stop_name}</h3>
                <p><strong>Route:</strong> ${this.getRouteName(stop.route_id)}</p>
                <button onclick="event.stopPropagation(); app.loadArrivals(${stop.id})" class="btn-primary">Check Arrivals</button>
            </div>
        `).join('');
    }

    showStopOnMap(lat, lng) {
        this.switchTab('map');
        this.map.setView([lat, lng], 16);

        // Find and open the popup for this stop
        const marker = this.stopMarkers.find(m => 
            Math.abs(m.getLatLng().lat - lat) < 0.0001 && 
            Math.abs(m.getLatLng().lng - lng) < 0.0001
        );
        if (marker) {
            marker.openPopup();
        }
    }

    async loadArrivals(stopId) {
        try {
            const response = await fetch(`/api/arrivals/${stopId}`);
            const data = await response.json();

            this.renderArrivals(data.arrivals);

            // Switch to arrivals tab and update selector
            this.switchTab('arrivals');
            document.getElementById('arrival-stop').value = stopId;

        } catch (error) {
            console.error('Error loading arrivals:', error);
            this.showNotification('Failed to load arrivals', 'error');
        }
    }

    renderArrivals(arrivals) {
        const arrivalsContainer = document.getElementById('arrivals-list');

        if (arrivals.length === 0) {
            arrivalsContainer.innerHTML = '<p>No buses scheduled for this stop currently.</p>';
            return;
        }

        arrivalsContainer.innerHTML = arrivals.map(arrival => {
            const occupancyClass = arrival.occupancy > 70 ? 'high' : arrival.occupancy > 40 ? 'medium' : 'low';
            return `
                <div class="arrival-item">
                    <div>
                        <h3>🚌 ${arrival.bus_number}</h3>
                        <span class="occupancy ${occupancyClass}">${arrival.occupancy}% full</span>
                    </div>
                    <div class="arrival-time">${arrival.estimated_arrival}</div>
                </div>
            `;
        }).join('');
    }

    async loadNearbyStops(lat, lng) {
        try {
            const response = await fetch(`/api/nearby_stops?lat=${lat}&lon=${lng}&radius=0.01`);
            const data = await response.json();

            return data.stops;
        } catch (error) {
            console.error('Error loading nearby stops:', error);
            return [];
        }
    }

    locateUser() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    this.userLocation = [lat, lng];
                    this.map.setView([lat, lng], 16);

                    // Add user location marker
                    if (this.userMarker) {
                        this.map.removeLayer(this.userMarker);
                    }

                    this.userMarker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'user-marker',
                            html: '📍',
                            iconSize: [25, 25],
                            iconAnchor: [12, 12]
                        })
                    }).addTo(this.map);

                    this.userMarker.bindPopup('📍 Your Location').openPopup();

                    // Load nearby stops
                    this.loadNearbyStops(lat, lng).then(nearbyStops => {
                        if (nearbyStops.length > 0) {
                            this.showNotification(`Found ${nearbyStops.length} nearby stops`, 'info');
                        }
                    });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    this.showNotification('Unable to access your location', 'error');
                }
            );
        } else {
            this.showNotification('Geolocation not supported by this browser', 'error');
        }
    }

    startLocationTracking() {
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(
                (position) => {
                    this.userLocation = [position.coords.latitude, position.coords.longitude];
                },
                (error) => console.log('Location tracking error:', error),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        }
    }

    refreshData() {
        this.loadInitialData().then(() => {
            this.showNotification('Data refreshed successfully', 'info');
        }).catch(() => {
            this.showNotification('Failed to refresh data', 'error');
        });
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