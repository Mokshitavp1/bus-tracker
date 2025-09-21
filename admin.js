// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.map = null;
        this.buses = [];
        this.routes = [];
        this.socket = null;
        this.busMarkers = [];

        this.init();
    }

    async init() {
        this.initMap();
        this.connectWebSocket();
        await this.loadData();
        this.updateStats();
        this.setupAutoRefresh();
    }

    initMap() {
        // Initialize admin map
        this.map = L.map('admin-map').setView([17.3850, 78.4867], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
        }).addTo(this.map);

        // Custom icons for admin view
        this.busIcon = L.divIcon({
            className: 'admin-bus-marker',
            html: '🚌',
            iconSize: [25, 25],
            iconAnchor: [12, 12]
        });
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'bus_update') {
                this.updateBusData(data.data);
            }
        };
    }

    async loadData() {
        try {
            const [busesRes, routesRes] = await Promise.all([
                fetch('/api/buses'),
                fetch('/api/routes')
            ]);

            this.buses = await busesRes.json();
            const routesData = await routesRes.json();
            this.routes = routesData.routes;

            this.renderFleetMap();
            this.renderFleetTable();
            this.renderRoutePerformance();

        } catch (error) {
            console.error('Error loading admin data:', error);
        }
    }

    updateBusData(updatedBuses) {
        this.buses = updatedBuses;
        this.renderFleetMap();
        this.renderFleetTable();
        this.updateStats();
    }

    renderFleetMap() {
        // Clear existing markers
        this.busMarkers.forEach(marker => this.map.removeLayer(marker));
        this.busMarkers = [];

        // Add bus markers with admin-specific styling
        this.buses.forEach(bus => {
            const marker = L.marker([bus.latitude, bus.longitude], {
                icon: this.busIcon
            }).addTo(this.map);

            const status = this.getBusStatus(bus);
            const statusClass = status.toLowerCase().replace(' ', '-');

            const popupContent = `
                <div class="admin-bus-popup">
                    <h3>🚌 ${bus.bus_number}</h3>
                    <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${status}</span></p>
                    <p><strong>Speed:</strong> ${bus.speed.toFixed(1)} km/h</p>
                    <p><strong>Occupancy:</strong> ${bus.occupancy}%</p>
                    <p><strong>Route:</strong> ${this.getRouteName(bus.route_id)}</p>
                    <p><strong>Last Update:</strong> ${new Date(bus.last_updated).toLocaleTimeString()}</p>
                </div>
            `;

            marker.bindPopup(popupContent);
            this.busMarkers.push(marker);
        });
    }

    renderFleetTable() {
        const tbody = document.getElementById('fleet-tbody');
        tbody.innerHTML = this.buses.map(bus => {
            const status = this.getBusStatus(bus);
            const statusClass = status.toLowerCase().replace(' ', '-');

            return `
                <tr>
                    <td>${bus.bus_number}</td>
                    <td>${this.getRouteName(bus.route_id)}</td>
                    <td>${bus.speed.toFixed(1)} km/h</td>
                    <td>${bus.occupancy}%</td>
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                    <td>${new Date(bus.last_updated).toLocaleTimeString()}</td>
                </tr>
            `;
        }).join('');
    }

    renderRoutePerformance() {
        const container = document.getElementById('route-performance');

        // Calculate route statistics
        const routeStats = this.routes.map(route => {
            const routeBuses = this.buses.filter(bus => bus.route_id === route.id);
            const avgSpeed = routeBuses.reduce((sum, bus) => sum + bus.speed, 0) / routeBuses.length || 0;
            const avgOccupancy = routeBuses.reduce((sum, bus) => sum + bus.occupancy, 0) / routeBuses.length || 0;

            return {
                ...route,
                busCount: routeBuses.length,
                avgSpeed: avgSpeed.toFixed(1),
                avgOccupancy: Math.round(avgOccupancy),
                efficiency: this.calculateRouteEfficiency(routeBuses)
            };
        });

        container.innerHTML = `
            <div class="route-stats-grid">
                ${routeStats.map(route => `
                    <div class="route-stat-card">
                        <h4>${route.route_name}</h4>
                        <p><strong>Active Buses:</strong> ${route.busCount}</p>
                        <p><strong>Avg Speed:</strong> ${route.avgSpeed} km/h</p>
                        <p><strong>Avg Occupancy:</strong> ${route.avgOccupancy}%</p>
                        <p><strong>Efficiency:</strong> <span class="efficiency ${route.efficiency.class}">${route.efficiency.score}%</span></p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    updateStats() {
        // Update dashboard statistics
        const activeBuses = this.buses.filter(bus => this.getBusStatus(bus) === 'Online').length;
        const totalRoutes = this.routes.length;
        const avgOccupancy = Math.round(
            this.buses.reduce((sum, bus) => sum + bus.occupancy, 0) / this.buses.length || 0
        );
        const activeAlerts = this.buses.filter(bus => 
            this.getBusStatus(bus) === 'Delayed' || bus.occupancy > 80
        ).length;

        document.getElementById('active-buses').textContent = activeBuses;
        document.getElementById('total-routes').textContent = totalRoutes;
        document.getElementById('avg-occupancy').textContent = avgOccupancy + '%';
        document.getElementById('active-alerts').textContent = activeAlerts;
    }

    getBusStatus(bus) {
        const now = new Date();
        const lastUpdate = new Date(bus.last_updated);
        const timeDiff = (now - lastUpdate) / 1000 / 60; // minutes

        if (timeDiff > 10) return 'Offline';
        if (bus.speed < 5) return 'Delayed';
        if (bus.occupancy > 90) return 'Overcrowded';
        return 'Online';
    }

    calculateRouteEfficiency(buses) {
        if (buses.length === 0) return { score: 0, class: 'low' };

        const avgSpeed = buses.reduce((sum, bus) => sum + bus.speed, 0) / buses.length;
        const avgOccupancy = buses.reduce((sum, bus) => sum + bus.occupancy, 0) / buses.length;

        // Simple efficiency calculation (can be made more sophisticated)
        const speedScore = Math.min(avgSpeed / 30 * 50, 50); // Max 50 points for speed
        const occupancyScore = Math.min(avgOccupancy / 60 * 50, 50); // Max 50 points for occupancy

        const efficiency = Math.round(speedScore + occupancyScore);

        let efficiencyClass = 'low';
        if (efficiency > 70) efficiencyClass = 'high';
        else if (efficiency > 40) efficiencyClass = 'medium';

        return { score: efficiency, class: efficiencyClass };
    }

    getRouteName(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        return route ? route.route_name : 'Unknown Route';
    }

    setupAutoRefresh() {
        // Refresh data every 30 seconds
        setInterval(() => {
            this.loadData();
        }, 30000);
    }
}

// Global functions for alert buttons
window.sendAlert = function(type) {
    let message = '';
    switch(type) {
        case 'delay':
            message = 'Service delays reported on multiple routes';
            break;
        case 'breakdown':
            message = 'Bus breakdown reported - alternative arrangements in place';
            break;
        case 'overcrowding':
            message = 'High passenger volume detected - additional buses deployed';
            break;
    }

    // Add alert to alerts list
    const alertsList = document.getElementById('alerts-list');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-item alert-${type}`;
    alertDiv.innerHTML = `
        <div class="alert-content">
            <strong>${new Date().toLocaleTimeString()}</strong>
            <p>${message}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="alert-dismiss">×</button>
    `;

    alertsList.prepend(alertDiv);

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (alertDiv.parentElement) {
            alertDiv.remove();
        }
    }, 10000);
};

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});

// Add CSS for admin-specific styles
const adminStyles = `
<style>
.route-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
}

.route-stat-card {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 8px;
    border-left: 4px solid #2196F3;
}

.route-stat-card h4 {
    margin-bottom: 0.5rem;
    color: #333;
}

.efficiency.high { color: #4caf50; font-weight: bold; }
.efficiency.medium { color: #ff9800; font-weight: bold; }
.efficiency.low { color: #f44336; font-weight: bold; }

.alert-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    margin-bottom: 0.5rem;
    border-radius: 4px;
    border-left: 4px solid #2196F3;
    background: #f8f9fa;
}

.alert-delay { border-left-color: #ff9800; }
.alert-breakdown { border-left-color: #f44336; }
.alert-overcrowding { border-left-color: #2196F3; }

.alert-dismiss {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
}

.alert-dismiss:hover {
    color: #333;
}

.admin-bus-popup {
    min-width: 200px;
}

.status-badge.overcrowded { background: #ffebee; color: #c62828; }
.status-badge.delayed { background: #fff3e0; color: #ef6c00; }
.status-badge.online { background: #e8f5e8; color: #2e7d32; }
.status-badge.offline { background: #fafafa; color: #757575; }

@media (max-width: 768px) {
    .route-stats-grid {
        grid-template-columns: 1fr;
    }

    .alert-item {
        flex-direction: column;
        align-items: flex-start;
    }

    .alert-dismiss {
        align-self: flex-end;
        margin-top: 0.5rem;
    }
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', adminStyles);