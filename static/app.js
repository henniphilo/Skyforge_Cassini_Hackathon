// Urban Climate Simulator - Frontend JavaScript

const API_BASE = window.location.origin;

// Initialize map centered on Neukölln/Kreuzberg
const map = L.map('map').setView([52.48, 13.43], 14);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// State
let currentActionType = 'ADD_PARK';
let heatLayer = null;
let windLayer = null;
let reliefLayer = null;
let contourLayer = null;
let interventionMarkers = [];
let simulationData = null;
let reliefData = null;

// Initialize UI
document.querySelectorAll('.btn[data-type]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.btn[data-type]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentActionType = this.dataset.type;
    });
});

document.getElementById('btn-reset').addEventListener('click', resetSimulation);
document.getElementById('show-wind').addEventListener('change', updateVisualization);
document.getElementById('show-heatmap').addEventListener('change', updateVisualization);
document.getElementById('show-relief').addEventListener('change', updateReliefVisualization);

// Map click handler
map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    
    applyIntervention(currentActionType, lat, lon);
});

// Apply intervention
async function applyIntervention(type, lat, lon) {
    try {
        const response = await fetch(`${API_BASE}/api/intervene`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type, lat, lon })
        });
        
        if (!response.ok) {
            throw new Error('Failed to apply intervention');
        }
        
        const data = await response.json();
        simulationData = data;
        
        // Add marker for intervention
        const icon = getIconForType(type);
        const marker = L.marker([lat, lon], { icon }).addTo(map);
        marker.bindPopup(`<b>${getTypeName(type)}</b><br>Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`);
        interventionMarkers.push(marker);
        
        updateVisualization();
        updateFeedback(data);
        updateStats(data);
        
    } catch (error) {
        console.error('Error applying intervention:', error);
        document.getElementById('feedback-box').innerHTML = 
            `<p style="color: #dc3545;">Fehler: ${error.message}</p>`;
    }
}

// Get icon for intervention type
function getIconForType(type) {
    const icons = {
        'ADD_PARK': L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="green">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
            `),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        'ADD_WATER': L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="blue">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                </svg>
            `),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        'ADD_BUILDING': L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="red">
                    <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                </svg>
            `),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    };
    
    return icons[type] || L.divIcon({
        className: 'custom-marker',
        html: '📍',
        iconSize: [24, 24]
    });
}

function getTypeName(type) {
    const names = {
        'ADD_PARK': 'Park hinzugefügt',
        'ADD_WATER': 'Wasserfläche hinzugefügt',
        'REMOVE_ASPHALT': 'Asphalt entfernt',
        'ADD_ASPHALT': 'Asphalt hinzugefügt',
        'ADD_BUILDING': 'Gebäude hinzugefügt',
        'REMOVE_BUILDING': 'Gebäude entfernt'
    };
    return names[type] || type;
}

// Update visualization
function updateVisualization() {
    if (!simulationData) {
        loadInitialState();
        return;
    }
    
    const showHeatmap = document.getElementById('show-heatmap').checked;
    const showWind = document.getElementById('show-wind').checked;
    
    // Update heatmap
    if (showHeatmap) {
        if (heatLayer) {
            map.removeLayer(heatLayer);
        }
        
        const heatData = simulationData.temperature_data.map(point => [point[0], point[1], point[2]]);
        heatLayer = L.heatLayer(heatData, {
            radius: 20,
            blur: 15,
            maxZoom: 17,
            gradient: {
                0.0: 'blue',
                0.3: 'cyan',
                0.5: 'lime',
                0.7: 'yellow',
                1.0: 'red'
            },
            minOpacity: 0.5
        }).addTo(map);
    } else {
        if (heatLayer) {
            map.removeLayer(heatLayer);
            heatLayer = null;
        }
    }
    
    // Update wind vectors
    if (showWind) {
        if (windLayer) {
            map.removeLayer(windLayer);
        }
        
        const windGroup = L.layerGroup();
        
        simulationData.wind_data.forEach(point => {
            const [lat, lon, u, v, magnitude] = point;
            
            if (magnitude > 0.1) { // Only show significant wind
                // Calculate arrow direction
                const angle = Math.atan2(v, u);
                const arrowLength = Math.min(magnitude * 5, 50); // Scale for visibility
                
                // Create arrow using polyline
                const endLat = lat + (arrowLength / 111000) * Math.sin(angle);
                const endLon = lon + (arrowLength / (111000 * Math.cos(lat * Math.PI / 180))) * Math.cos(angle);
                
                const arrow = L.polyline(
                    [[lat, lon], [endLat, endLon]],
                    {
                        color: magnitude > 2 ? '#ff0000' : magnitude > 1 ? '#ff8800' : '#0088ff',
                        weight: Math.min(magnitude, 3),
                        opacity: 0.7
                    }
                ).addTo(windGroup);
                
                // Add arrowhead (simplified)
                const arrowhead = L.circleMarker([endLat, endLon], {
                    radius: 3,
                    fillColor: arrow.options.color,
                    fillOpacity: 0.8,
                    color: arrow.options.color
                }).addTo(windGroup);
            }
        });
        
        windLayer = windGroup.addTo(map);
    } else {
        if (windLayer) {
            map.removeLayer(windLayer);
            windLayer = null;
        }
    }
}

// Update feedback box
function updateFeedback(data) {
    const hotspot = data.hotspot;
    const tempDiff = data.current_avg_temp - data.base_temp;
    const tempDiffStr = tempDiff >= 0 ? `+${tempDiff.toFixed(1)}` : tempDiff.toFixed(1);
    
    document.getElementById('feedback-box').innerHTML = `
        <p>
            <strong>Hotspot:</strong> ${hotspot.temp.toFixed(1)}°C bei ${hotspot.lat.toFixed(4)}, ${hotspot.lon.toFixed(4)} | 
            <strong>Durchschnitt:</strong> ${data.current_avg_temp.toFixed(1)}°C 
            (${tempDiffStr}°C vs. Basis)
        </p>
    `;
}

// Update statistics
function updateStats(data) {
    document.getElementById('avg-temp').textContent = data.current_avg_temp.toFixed(1);
    document.getElementById('base-temp').textContent = data.base_temp.toFixed(1);
    document.getElementById('intervention-count').textContent = data.interventions.length;
}

// Reset simulation
async function resetSimulation() {
    try {
        const response = await fetch(`${API_BASE}/api/reset`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Failed to reset simulation');
        }
        
        const data = await response.json();
        simulationData = data;
        
        // Remove all markers
        interventionMarkers.forEach(marker => map.removeLayer(marker));
        interventionMarkers = [];
        
        updateVisualization();
        updateFeedback(data);
        updateStats(data);
        
        document.getElementById('feedback-box').innerHTML = 
            '<p>Simulation zurückgesetzt. Klicke auf die Karte, um neue Interventionen hinzuzufügen.</p>';
        
    } catch (error) {
        console.error('Error resetting simulation:', error);
        document.getElementById('feedback-box').innerHTML = 
            `<p style="color: #dc3545;">Fehler beim Zurücksetzen: ${error.message}</p>`;
    }
}

// Load initial state
async function loadInitialState() {
    try {
        const response = await fetch(`${API_BASE}/api/state`);
        if (!response.ok) {
            throw new Error('Failed to load initial state');
        }
        
        const data = await response.json();
        simulationData = data;
        updateVisualization();
        updateFeedback(data);
        updateStats(data);
        
    } catch (error) {
        console.error('Error loading initial state:', error);
    }
}

// Load relief data
async function loadReliefData() {
    try {
        console.log('Loading relief data...');
        const response = await fetch(`${API_BASE}/api/relief/hillshade?sample_rate=3`);
        if (!response.ok) {
            throw new Error(`Failed to load relief data: ${response.status}`);
        }
        const data = await response.json();
        console.log('Relief data loaded:', data.hillshade_data.length, 'points');
        reliefData = data;
        updateReliefVisualization();
    } catch (error) {
        console.error('Error loading relief data:', error);
        // Show error in feedback box
        document.getElementById('feedback-box').innerHTML = 
            `<p style="color: #dc3545;">Fehler beim Laden der Relief-Daten: ${error.message}</p>`;
    }
}

// Update relief visualization
function updateReliefVisualization() {
    const showRelief = document.getElementById('show-relief').checked;
    
    if (!showRelief) {
        if (reliefLayer) {
            map.removeLayer(reliefLayer);
            reliefLayer = null;
        }
        if (contourLayer) {
            map.removeLayer(contourLayer);
            contourLayer = null;
        }
        return;
    }
    
    if (!reliefData) {
        console.log('No relief data, loading...');
        loadReliefData();
        return;
    }
    
    console.log('Updating relief visualization...');
    
    // Remove existing layers
    if (reliefLayer) {
        map.removeLayer(reliefLayer);
        reliefLayer = null;
    }
    if (contourLayer) {
        map.removeLayer(contourLayer);
        contourLayer = null;
    }
    
    // Create elevation heatmap using Leaflet heat plugin
    if (!reliefData.hillshade_data || reliefData.hillshade_data.length === 0) {
        console.error('No hillshade data available');
        return;
    }
    
    const elevationData = reliefData.hillshade_data.map(point => {
        const [lat, lon, shade] = point;
        // Convert shade (0-255) to intensity for heatmap
        // Higher elevation = brighter shade
        const intensity = shade / 255;
        return [lat, lon, intensity];
    });
    
    console.log('Creating heat layer with', elevationData.length, 'points');
    
    // Use heat layer for relief visualization
    try {
        reliefLayer = L.heatLayer(elevationData, {
            radius: 30,
            blur: 25,
            maxZoom: 17,
            gradient: {
                0.0: 'rgba(0, 0, 0, 0)',
                0.2: 'rgba(50, 50, 50, 0.4)',
                0.4: 'rgba(100, 100, 100, 0.5)',
                0.6: 'rgba(150, 150, 150, 0.6)',
                0.8: 'rgba(200, 200, 200, 0.7)',
                1.0: 'rgba(255, 255, 255, 0.8)'
            },
            minOpacity: 0.4
        });
        
        reliefLayer.addTo(map);
        console.log('Relief layer successfully added to map');
    } catch (error) {
        console.error('Error creating relief layer:', error);
        // Fallback: create simple markers
        const markerGroup = L.layerGroup();
        elevationData.slice(0, 100).forEach(point => {
            const [lat, lon, intensity] = point;
            const gray = Math.round(intensity * 255);
            L.circleMarker([lat, lon], {
                radius: 3,
                fillColor: `rgb(${gray}, ${gray}, ${gray})`,
                color: `rgb(${gray}, ${gray}, ${gray})`,
                fillOpacity: 0.6,
                weight: 1
            }).addTo(markerGroup);
        });
        reliefLayer = markerGroup.addTo(map);
        console.log('Using fallback marker visualization');
    }
    
    // Load and draw contour lines
    loadContourLines();
}

// Load contour lines
async function loadContourLines() {
    try {
        console.log('Loading contour lines...');
        const response = await fetch(`${API_BASE}/api/relief/contours`);
        if (!response.ok) {
            throw new Error(`Failed to load contour lines: ${response.status}`);
        }
        const data = await response.json();
        console.log('Contour data loaded:', data.contours.length, 'contours');
        
        const contourGroup = L.layerGroup();
        
        data.contours.forEach((contour, idx) => {
            if (contour.points && contour.points.length > 0) {
                const polyline = L.polyline(contour.points, {
                    color: '#666666',
                    weight: 1.5,
                    opacity: 0.6,
                    dashArray: '5, 5'
                }).addTo(contourGroup);
                
                // Add elevation label at midpoint (only for some contours to avoid clutter)
                if (contour.points.length > 10 && idx % 2 === 0) {
                    const midIdx = Math.floor(contour.points.length / 2);
                    const [lat, lon] = contour.points[midIdx];
                    L.marker([lat, lon], {
                        icon: L.divIcon({
                            className: 'contour-label',
                            html: `<span style="background: rgba(255,255,255,0.8); padding: 2px 4px; border-radius: 2px; font-size: 10px; border: 1px solid #ccc;">${Math.round(contour.elevation)}m</span>`,
                            iconSize: [50, 20],
                            iconAnchor: [25, 10]
                        })
                    }).addTo(contourGroup);
                }
            }
        });
        
        contourLayer = contourGroup.addTo(map);
        console.log('Contour layer added to map');
    } catch (error) {
        console.error('Error loading contour lines:', error);
    }
}

// Initialize on page load
loadInitialState();
loadReliefData();

