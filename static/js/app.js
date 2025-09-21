document.addEventListener('DOMContentLoaded', () => {
    // Map initialization
    var map = L.map('map').setView([17.385, 78.4867], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Tab navigation
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            contents.forEach(c => c.classList.remove('active'));
            document.getElementById(`${target}-tab`).classList.add('active');
        });
    });

    // Search form submission handling
    const searchForm = document.getElementById('search-form');
    const searchResults = document.getElementById('search-results');

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const start = document.getElementById('start-stop').value.trim();
        const end = document.getElementById('end-stop').value.trim();

        if (!start || !end) {
            alert('Please enter both start and end stops.');
            return;
        }

        try {
            const response = await fetch(`/api/search_routes?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            searchResults.innerHTML = '';
            if (data.routes && data.routes.length > 0) {
                data.routes.forEach(route => {
                    const div = document.createElement('div');
                    div.textContent = `Route: ${route.route_name}, Stops: ${route.stops.join(', ')}`;
                    searchResults.appendChild(div);
                });
            } else {
                searchResults.textContent = 'No routes found.';
            }
        } catch (error) {
            searchResults.textContent = `Error fetching routes: ${error.message}`;
        }
    });
});
