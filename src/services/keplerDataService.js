/**
 * Kepler.gl Data Service
 * Converts building and tree data to GeoJSON format for Kepler.gl visualization
 */

/**
 * Convert buildings and trees to GeoJSON format for Kepler.gl
 * @param {Array} existingBuildings - Existing buildings from OSM
 * @param {Array} userBuildings - User-added buildings and trees
 * @param {Array} removedBuildings - Removed buildings
 * @param {Object} location - Current location
 * @param {Array} existingTrees - Existing trees from OSM (optional)
 * @param {Array} existingCanals - Existing canals from OSM (optional)
 * @param {Array} existingStreets - Existing streets from OSM (optional)
 * @param {Array} removedTrees - Removed trees (optional)
 * @param {Array} removedCanals - Removed canals (optional)
 * @param {Array} removedStreets - Removed streets (optional)
 * @returns {Object} GeoJSON FeatureCollection
 */
export function convertToGeoJSON(
  existingBuildings, 
  userBuildings, 
  removedBuildings, 
  location, 
  existingTrees = [],
  existingCanals = [],
  existingStreets = [],
  removedTrees = [],
  removedCanals = [],
  removedStreets = []
) {
  const features = [];

  // Add existing buildings (not removed) - with polygons if available
  existingBuildings
    .filter(building => !removedBuildings.some(rb => rb.id === building.id))
    .forEach((building) => {
      if (building.polygon && building.polygon.length > 0) {
        // Use polygon geometry
        features.push({
          type: 'Feature',
          properties: {
            type: 'building',
            status: 'existing',
            buildingType: building.buildingType || 'building',
            name: building.name || null,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [building.polygon], // Polygon coordinates
          },
        });
      } else {
        // Fallback to point
        features.push({
          type: 'Feature',
          properties: {
            type: 'building',
            status: 'existing',
            buildingType: building.buildingType || 'building',
            name: building.name || null,
          },
          geometry: {
            type: 'Point',
            coordinates: [building.coordinate.longitude, building.coordinate.latitude],
          },
        });
      }
    });

  // Add user-added buildings - with polygons if available
  userBuildings
    .filter(b => b.type === 'building')
    .forEach((building) => {
      if (building.polygon && building.polygon.length > 0) {
        features.push({
          type: 'Feature',
          properties: {
            type: 'building',
            status: 'added',
            buildingType: 'user-added',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [building.polygon],
          },
        });
      } else {
        features.push({
          type: 'Feature',
          properties: {
            type: 'building',
            status: 'added',
            buildingType: 'user-added',
          },
          geometry: {
            type: 'Point',
            coordinates: [building.coordinate.longitude, building.coordinate.latitude],
          },
        });
      }
    });

  // Add existing trees from OSM (not removed)
  existingTrees
    .filter(tree => !removedTrees.some(rt => rt.id === tree.id))
    .forEach((tree) => {
      features.push({
        type: 'Feature',
        properties: {
          type: 'tree',
          status: 'existing',
          name: tree.name || null,
        },
        geometry: {
          type: 'Point',
          coordinates: [tree.coordinate.longitude, tree.coordinate.latitude],
        },
      });
    });

  // Add user-added trees
  userBuildings
    .filter(b => b.type === 'tree')
    .forEach((building) => {
      features.push({
        type: 'Feature',
        properties: {
          type: 'tree',
          status: 'added',
        },
        geometry: {
          type: 'Point',
          coordinates: [building.coordinate.longitude, building.coordinate.latitude],
        },
      });
    });

  // Add existing canals from OSM (not removed)
  existingCanals
    .filter(canal => !removedCanals.some(rc => rc.id === canal.id))
    .forEach((canal) => {
      if (canal.coordinates && canal.coordinates.length > 0) {
        features.push({
          type: 'Feature',
          properties: {
            type: 'canal',
            status: 'existing',
            waterwayType: canal.waterwayType || 'canal',
            name: canal.name || null,
          },
          geometry: {
            type: 'LineString',
            coordinates: canal.coordinates.map(coord => [coord.longitude, coord.latitude]),
          },
        });
      }
    });

  // Add user-added canals
  userBuildings
    .filter(b => b.type === 'canal')
    .forEach((canal) => {
      if (canal.coordinates && canal.coordinates.length > 0) {
        features.push({
          type: 'Feature',
          properties: {
            type: 'canal',
            status: 'added',
          },
          geometry: {
            type: 'LineString',
            coordinates: canal.coordinates.map(coord => [coord.longitude, coord.latitude]),
          },
        });
      }
    });

  // Add existing streets from OSM (not removed)
  existingStreets
    .filter(street => !removedStreets.some(rs => rs.id === street.id))
    .forEach((street) => {
      if (street.coordinates && street.coordinates.length > 0) {
        features.push({
          type: 'Feature',
          properties: {
            type: 'street',
            status: 'existing',
            highwayType: street.highwayType || 'street',
            name: street.name || null,
          },
          geometry: {
            type: 'LineString',
            coordinates: street.coordinates.map(coord => [coord.longitude, coord.latitude]),
          },
        });
      }
    });

  // Add user-added streets
  userBuildings
    .filter(b => b.type === 'street')
    .forEach((street) => {
      if (street.coordinates && street.coordinates.length > 0) {
        features.push({
          type: 'Feature',
          properties: {
            type: 'street',
            status: 'added',
          },
          geometry: {
            type: 'LineString',
            coordinates: street.coordinates.map(coord => [coord.longitude, coord.latitude]),
          },
        });
      }
    });

  // Add removed buildings (for visualization) - with polygons if available
  removedBuildings.forEach((building) => {
    if (building.polygon && building.polygon.length > 0) {
      features.push({
        type: 'Feature',
        properties: {
          type: 'building',
          status: 'removed',
          buildingType: building.buildingType || 'building',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [building.polygon],
        },
      });
    } else {
      features.push({
        type: 'Feature',
        properties: {
          type: 'building',
          status: 'removed',
          buildingType: building.buildingType || 'building',
        },
        geometry: {
          type: 'Point',
          coordinates: [building.coordinate.longitude, building.coordinate.latitude],
        },
      });
    }
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Generate Kepler.gl HTML with embedded visualization
 * @param {Object} geoJsonData - GeoJSON data
 * @param {Object} location - Center location
 * @returns {string} HTML string for WebView
 */
export function generateKeplerHTML(geoJsonData, location) {
  const dataString = JSON.stringify(geoJsonData);
  const centerLat = location?.latitude || 52.52;
  const centerLon = location?.longitude || 13.405;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Kepler.gl 3D Visualization</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #kepler-container {
      width: 100vw;
      height: 100vh;
    }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: #1a1a1a;
      color: white;
    }
  </style>
  <script src="https://unpkg.com/kepler.gl@3.0.0/dist/keplergl.min.js"></script>
  <link rel="stylesheet" href="https://unpkg.com/kepler.gl@3.0.0/dist/keplergl.min.css" />
</head>
<body>
  <div id="kepler-container">
    <div class="loading">Loading 3D visualization...</div>
  </div>
  <script>
    const data = ${dataString};
    const centerLat = ${centerLat};
    const centerLon = ${centerLon};

    // Initialize Kepler.gl
    const keplerGl = new KeplerGl({
      id: 'kepler-container',
      width: window.innerWidth,
      height: window.innerHeight,
      mapboxApiAccessToken: '', // Not needed for basic visualization
    });

    // Add data to Kepler.gl
    keplerGl.addDataToMap({
      datasets: {
        info: {
          label: 'Buildings and Trees',
          id: 'buildings-trees',
        },
        data: data,
      },
      option: {
        centerMap: true,
        readOnly: false,
      },
      config: {
        version: 'v1',
        config: {
          visState: {
            filters: [],
            layers: [
              {
                id: 'buildings-layer',
                type: 'point',
                config: {
                  dataId: 'buildings-trees',
                  label: 'Buildings',
                  color: [59, 130, 246],
                  columns: {
                    lat: 'coordinates[1]',
                    lng: 'coordinates[0]',
                  },
                  isVisible: true,
                  visConfig: {
                    radius: 50,
                    fixedRadius: false,
                    opacity: 0.8,
                    outline: true,
                    thickness: 2,
                    strokeColor: [255, 255, 255],
                    colorRange: {
                      name: 'Global Warming',
                      type: 'sequential',
                      category: 'Uber',
                      colors: ['#5A1846', '#900C3F', '#C70039', '#FF5733', '#FFC300'],
                    },
                    radiusRange: [1, 100],
                    'hi-precision': false,
                    enable3d: true,
                    elevationScale: 5,
                    '3d': true,
                  },
                },
              },
            ],
            interactionConfig: {
              tooltip: {
                fieldsToShow: {
                  'buildings-trees': ['type', 'status', 'buildingType'],
                },
                enabled: true,
              },
            },
          },
          mapState: {
            latitude: centerLat,
            longitude: centerLon,
            zoom: 15,
            pitch: 45,
            bearing: 0,
            dragRotate: true,
          },
          mapStyle: {
            styleType: 'dark',
            topLayerGroups: {},
            visibleLayerGroups: {
              label: true,
              road: true,
              border: false,
              building: true,
              water: true,
              land: true,
              '3d building': true,
            },
            threeDBuildingColor: [200, 200, 200],
          },
        },
      },
    });

    // Update container size
    window.addEventListener('resize', () => {
      keplerGl.updateContainer({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    });
  </script>
</body>
</html>
  `;
}

/**
 * Generate simplified 3D visualization using deck.gl with proper base map
 */
export function generateDeckGLHTML(geoJsonData, location, weatherData = null, mapRegion = null, showHeat = true, showWind = true) {
  const dataString = JSON.stringify(geoJsonData);
  // Use map region if available, otherwise use location
  const centerLat = mapRegion?.latitude || location?.latitude || 52.52;
  const centerLon = mapRegion?.longitude || location?.longitude || 13.405;
  const weatherString = weatherData ? JSON.stringify(weatherData) : 'null';
  
  // Calculate zoom from region delta if available
  let initialZoom = 15;
  if (mapRegion?.latitudeDelta) {
    // Convert delta to approximate zoom level
    const delta = Math.max(mapRegion.latitudeDelta, mapRegion.longitudeDelta);
    if (delta > 0.1) initialZoom = 10;
    else if (delta > 0.05) initialZoom = 11;
    else if (delta > 0.02) initialZoom = 12;
    else if (delta > 0.01) initialZoom = 13;
    else if (delta > 0.005) initialZoom = 14;
    else initialZoom = 15;
  }
  
  console.log('Weather data being passed:', weatherData);
  console.log('Map region:', mapRegion);
  console.log('Initial zoom:', initialZoom);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>3D Map Visualization</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
    }
    #deck-container {
      width: 100vw;
      height: 100vh;
      position: relative;
      background: transparent;
    }
    .info {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 1000;
      line-height: 1.6;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .error {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      text-align: center;
      z-index: 1001;
    }
  </style>
  <script src="https://unpkg.com/deck.gl@9.0.0/dist.min.js"></script>
</head>
<body>
  <div id="deck-container"></div>
  <div class="info">
    <div style="font-weight: bold; margin-bottom: 6px; font-size: 14px;">🌐 3D Visualization</div>
    <div style="margin-bottom: 4px;">Drag to rotate • Pinch to zoom</div>
    <div style="margin-top: 8px; font-size: 11px; opacity: 0.9; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
      <div>🔵 Blue: Existing Buildings/Canals</div>
      <div>🟢 Green: Added Items</div>
      <div>🌳 Dark Green: OSM Trees</div>
      <div>🛣️ Gray: Existing Streets</div>
      <div>🔴 Red: Removed Items</div>
      <div style="margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
        <div>🌡️ Heat Map: Temperature overlay</div>
        <div>💨 Blue Lines: Wind direction & speed</div>
      </div>
    </div>
  </div>
  <div id="error" class="error" style="display: none;"></div>
  <div id="loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; z-index: 999;">Loading 3D visualization...</div>
  <script>
    (function() {
      function showError(msg) {
        const errorDiv = document.getElementById('error');
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (errorDiv) {
          errorDiv.style.display = 'block';
          errorDiv.innerHTML = msg;
        }
        console.error(msg);
      }

      function initVisualization() {
        try {
          const data = ${dataString};
          const centerLat = ${centerLat};
          const centerLon = ${centerLon};
          const weather = ${weatherString};
          
          console.log('Weather data in visualization:', weather);
          console.log('Weather temperature:', weather?.temperature);
          console.log('Weather windSpeed:', weather?.windSpeed);
          console.log('Weather windDirection:', weather?.windDirection);

          // Check if deck.gl is loaded
          if (typeof deck === 'undefined' || !deck.DeckGL) {
            showError('Deck.gl library failed to load. Please check your internet connection.');
            return;
          }

          if (!data || !data.features || data.features.length === 0) {
            showError('No data to visualize. Add some buildings or trees first.');
            return;
          }

          // Convert GeoJSON to 3D building/tree/canal/street shapes
          const buildingPolygons = [];
          const buildingPoints = [];
          const trees = [];
          const canals = [];
          const streets = [];
          
          data.features.forEach(f => {
            const isRemoved = f.properties.status === 'removed';
            const isTree = f.properties.type === 'tree';
            const isCanal = f.properties.type === 'canal';
            const isStreet = f.properties.type === 'street';
            const isAdded = f.properties.status === 'added';
            
            if (isTree) {
              // Trees as 3D cylinders with realistic proportions
              // Skip removed trees (height 0) to avoid green floor effect
              if (!isRemoved) {
                const isExisting = f.properties.status === 'existing';
                trees.push({
                  position: f.geometry.coordinates,
                  color: isAdded ? [34, 197, 94, 255] : // Bright green for user-added trees
                         isExisting ? [22, 163, 74, 255] : // Medium green for OSM trees
                         [34, 139, 34, 255], // Dark green fallback
                  radius: 3.0, // meters - tree canopy radius (slightly larger for better visibility)
                  height: isAdded ? 15 : 12, // meters - tree height (added trees slightly taller)
                  type: 'tree',
                  status: f.properties.status,
                });
              }
            } else if (isCanal && f.geometry.type === 'LineString') {
              // Canals as 3D water channels
              // Skip removed canals to avoid clutter
              if (!isRemoved) {
                canals.push({
                  path: f.geometry.coordinates,
                  color: isAdded ? [34, 197, 94, 220] : // Bright green/cyan for user-added canals
                         [59, 130, 246, 240], // Blue for existing canals (water color)
                  width: isAdded ? 10 : 8, // meters - canal width (wider for visibility)
                  type: 'canal',
                  status: f.properties.status,
                  elevation: -0.5, // Slightly below ground to show as channel
                });
              }
            } else if (isStreet && f.geometry.type === 'LineString') {
              // Streets as 3D road surfaces
              streets.push({
                path: f.geometry.coordinates,
                color: isAdded ? [16, 185, 129, 240] : // Green for user-added streets
                       isRemoved ? [239, 68, 68, 180] : // Red for removed streets
                       [120, 120, 120, 240], // Dark gray for existing streets (road color)
                width: isAdded ? 8 : 6, // meters - street width (wider for visibility)
                type: 'street',
                status: f.properties.status,
                elevation: 0.3, // Slightly above ground to show as road surface
              });
            } else if (f.properties.type === 'building') {
              // Buildings - check geometry type to determine rendering method
              if (f.geometry.type === 'Polygon' && f.geometry.coordinates && f.geometry.coordinates[0]) {
                // Buildings with polygon geometry - render as 3D extruded polygons
                // Skip removed buildings (height 0) to avoid green floor effect
                if (!isRemoved) {
                  const buildingHeight = isAdded ? 25 : 30; // meters
                  buildingPolygons.push({
                    polygon: f.geometry.coordinates[0], // First ring of polygon
                    color: isAdded ? [16, 185, 129, 240] : [59, 130, 246, 240],
                    height: buildingHeight,
                    type: 'building',
                    status: f.properties.status,
                  });
                }
              } else if (f.geometry.type === 'Point') {
                // Buildings as points - render as 3D columns
                // Skip removed buildings (height 0) to avoid green floor effect
                if (!isRemoved) {
                  const buildingHeight = isAdded ? 25 : 30; // meters
                  buildingPoints.push({
                    position: f.geometry.coordinates,
                    color: isAdded ? [16, 185, 129, 240] : [59, 130, 246, 240],
                    width: 20, // meters
                    height: buildingHeight,
                    type: 'building',
                    status: f.properties.status,
                  });
                }
              }
            }
          });

          console.log('Initializing deck.gl with', buildingPolygons.length, 'building polygons,', buildingPoints.length, 'building points,', trees.length, 'trees,', canals.length, 'canals, and', streets.length, 'streets');

          // Calculate bounds from all data to center the view properly
          let minLat = Infinity, maxLat = -Infinity;
          let minLon = Infinity, maxLon = -Infinity;
          
          function updateBounds(coords) {
            if (Array.isArray(coords[0])) {
              // Array of coordinates (polygon or linestring)
              coords.forEach(coord => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const lon = coord[0];
                  const lat = coord[1];
                  minLat = Math.min(minLat, lat);
                  maxLat = Math.max(maxLat, lat);
                  minLon = Math.min(minLon, lon);
                  maxLon = Math.max(maxLon, lon);
                }
              });
            } else if (coords.length >= 2) {
              // Single coordinate [lon, lat]
              const lon = coords[0];
              const lat = coords[1];
              minLat = Math.min(minLat, lat);
              maxLat = Math.max(maxLat, lat);
              minLon = Math.min(minLon, lon);
              maxLon = Math.max(maxLon, lon);
            }
          }
          
          data.features.forEach(f => {
            if (f.geometry.type === 'Point') {
              updateBounds(f.geometry.coordinates);
            } else if (f.geometry.type === 'LineString') {
              updateBounds(f.geometry.coordinates);
            } else if (f.geometry.type === 'Polygon') {
              f.geometry.coordinates.forEach(ring => updateBounds(ring));
            }
          });
          
          // Use calculated bounds or fallback to location center
          const viewLat = (minLat !== Infinity && maxLat !== -Infinity) ? (minLat + maxLat) / 2 : centerLat;
          const viewLon = (minLon !== Infinity && maxLon !== -Infinity) ? (minLon + maxLon) / 2 : centerLon;
          
          // Calculate zoom level - prefer map region zoom, then bounds, then default
          let viewZoom = ${initialZoom};
          if (minLat !== Infinity && maxLat !== -Infinity && minLon !== Infinity && maxLon !== -Infinity) {
            const latRange = maxLat - minLat;
            const lonRange = maxLon - minLon;
            const maxRange = Math.max(latRange, lonRange);
            // Only use bounds-based zoom if we don't have a map region
            if (!${mapRegion ? 'true' : 'false'}) {
              // Approximate zoom calculation from bounds
              if (maxRange > 0.1) viewZoom = 10;
              else if (maxRange > 0.05) viewZoom = 11;
              else if (maxRange > 0.02) viewZoom = 12;
              else if (maxRange > 0.01) viewZoom = 13;
              else if (maxRange > 0.005) viewZoom = 14;
              else viewZoom = 15;
            }
          }
          
          // Weather layer visibility state
          let showHeatLayer = ${showHeat};
          let showWindLayer = ${showWind};
          
          // Prepare weather visualizations
          const weatherLayers = [];
          
          // Heat map layer (temperature visualization) - always create, visibility controlled by toggle
          if (weather && weather.temperature !== undefined && weather.temperature !== null) {
            console.log('Creating heat map with temperature:', weather.temperature);
            const heatPoints = [];
            const gridSize = 30; // Increased grid size for better coverage
            const latRange = (maxLat !== -Infinity && minLat !== Infinity) ? Math.max(0.01, maxLat - minLat) : 0.01;
            const lonRange = (maxLon !== -Infinity && minLon !== Infinity) ? Math.max(0.01, maxLon - minLon) : 0.01;
            
            // Temperature color mapping (blue = cold, red = hot)
            const temp = weather.temperature || 10;
            const minTemp = 0;
            const maxTemp = 40;
            const normalizedTemp = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
            
            for (let i = 0; i < gridSize; i++) {
              for (let j = 0; j < gridSize; j++) {
                const lat = viewLat + (i / gridSize - 0.5) * latRange;
                const lon = viewLon + (j / gridSize - 0.5) * lonRange;
                heatPoints.push({
                  position: [lon, lat],
                  temperature: temp,
                });
              }
            }
            
            console.log('Heat points created:', heatPoints.length);
            
            weatherLayers.push(
              new deck.HeatmapLayer({
                id: 'heat-map',
                data: heatPoints,
                getPosition: d => d.position,
                getWeight: d => d.temperature,
                radiusPixels: 80,
                intensity: 1.5,
                threshold: 0.03,
                colorRange: [
                  [0, 0, 255, 0],      // Blue (cold)
                  [0, 255, 255, 100],  // Cyan
                  [0, 255, 0, 150],    // Green
                  [255, 255, 0, 200],  // Yellow
                  [255, 0, 0, 255],     // Red (hot)
                ],
                opacity: 0.6,
                visible: showHeatLayer,
              })
            );
          } else {
            console.log('No temperature data available:', weather);
          }
          
          // Wind visualization (arrows showing direction and speed) - always create, visibility controlled by toggle
          if (weather && weather.windSpeed !== undefined && weather.windSpeed !== null && weather.windDirection !== undefined && weather.windDirection !== null) {
            console.log('Creating wind visualization with speed:', weather.windSpeed, 'direction:', weather.windDirection);
            const windArrows = [];
            const gridSize = 20; // Increased grid size
            const latRange = (maxLat !== -Infinity && minLat !== Infinity) ? Math.max(0.01, maxLat - minLat) : 0.01;
            const lonRange = (maxLon !== -Infinity && minLon !== Infinity) ? Math.max(0.01, maxLon - minLon) : 0.01;
            
            const windSpeed = weather.windSpeed || 10;
            const windDir = (weather.windDirection || 0) * Math.PI / 180; // Convert to radians
            // Make arrows more visible - scale by wind speed in meters
            const arrowLengthMeters = Math.min(100, Math.max(20, windSpeed * 3));
            const arrowLength = arrowLengthMeters / 111000; // Convert meters to degrees
            
            // Wind speed color: light blue (calm) -> dark blue (strong)
            const windIntensity = Math.min(1, windSpeed / 30);
            const windColor = [
              Math.floor(100 + windIntensity * 100),
              Math.floor(150 + windIntensity * 50),
              Math.floor(255 - windIntensity * 50),
              255 // Fully opaque for visibility
            ];
            
            for (let i = 0; i < gridSize; i++) {
              for (let j = 0; j < gridSize; j++) {
                const lat = viewLat + (i / gridSize - 0.5) * latRange;
                const lon = viewLon + (j / gridSize - 0.5) * lonRange;
                
                // Create arrow path (line from center pointing in wind direction)
                const endLat = lat + arrowLength * Math.cos(windDir);
                const endLon = lon + arrowLength * Math.sin(windDir) / Math.cos(lat * Math.PI / 180);
                
                windArrows.push({
                  path: [[lon, lat], [endLon, endLat]],
                  speed: windSpeed,
                  direction: windDir,
                  color: windColor,
                });
              }
            }
            
            console.log('Wind arrows created:', windArrows.length);
            
            weatherLayers.push(
              new deck.PathLayer({
                id: 'wind-arrows',
                data: windArrows,
                pickable: true,
                widthMinPixels: 3,
                widthMaxPixels: 6,
                getPath: d => d.path,
                getColor: d => d.color,
                getWidth: 4,
                widthUnits: 'pixels',
                rounded: false,
                billboard: false,
                capRounded: true,
                jointRounded: true,
                visible: showWindLayer,
              })
            );
          } else {
            console.log('No wind data available:', weather);
          }
          
          console.log('Weather layers created:', weatherLayers.length);

          // Store deck instance globally for toggle updates
          let deckInstance = null;
          
          // Function to update layer visibility - expose globally for React Native
          window.updateLayerVisibility = function(layerId, visible) {
            if (deckInstance) {
              const currentLayers = deckInstance.props.layers;
              const updatedLayers = currentLayers.map(layer => {
                if (layer.id === layerId) {
                  // Create a new layer with updated visibility
                  return layer.clone({ visible: visible });
                }
                return layer;
              });
              deckInstance.setProps({ layers: updatedLayers });
            }
          };
          
          // Create deck.gl visualization with 3D shapes and base map
          deckInstance = new deck.DeckGL({
            container: 'deck-container',
            initialViewState: {
              longitude: viewLon,
              latitude: viewLat,
              zoom: viewZoom,
              pitch: 60,
              bearing: -17.6,
              minZoom: 8,
              maxZoom: 20,
            },
            controller: true,
            layers: [
              // Add weather visualizations FIRST (heat map and wind) so they render on the ground
              ...weatherLayers,
              // Buildings with polygon geometry - render as 3D extruded polygons
              new deck.PolygonLayer({
                id: 'buildings-polygons-3d',
                data: buildingPolygons,
                pickable: true,
                opacity: 0.9,
                extruded: true,
                elevationScale: 1,
                getPolygon: d => d.polygon,
                getFillColor: d => d.color,
                getLineColor: [255, 255, 255, 220],
                getElevation: d => d.height,
                lineWidthMinPixels: 2,
                wireframe: false,
                stroked: true,
                filled: true,
              }),
              // Buildings as points - render as 3D columns
              new deck.ColumnLayer({
                id: 'buildings-points-3d',
                data: buildingPoints,
                pickable: true,
                opacity: 0.9,
                diskResolution: 4, // Makes rectangular buildings (4 sides = square)
                extruded: true,
                elevationScale: 1,
                getPosition: d => d.position,
                getRadius: d => d.width / 2, // Use building width for radius
                getFillColor: d => d.color,
                getLineColor: [255, 255, 255, 220],
                getElevation: d => d.height,
                radiusUnits: 'meters',
                lineWidthMinPixels: 2,
                wireframe: false,
              }),
              // Trees as 3D cylinders (canopy representation) - rendered on top of buildings
              new deck.ColumnLayer({
                id: 'trees-3d',
                data: trees,
                pickable: true,
                opacity: 0.85,
                diskResolution: 16, // More sides for smoother tree appearance
                extruded: true,
                elevationScale: 1,
                getPosition: d => d.position,
                getRadius: d => d.radius || 3.0, // Tree canopy radius (slightly larger for visibility)
                getFillColor: d => d.color, // Green canopy color
                getLineColor: d => {
                  // Darker green outline for tree definition
                  return [Math.max(0, d.color[0] - 30), Math.max(0, d.color[1] - 20), Math.max(0, d.color[2] - 10), 255];
                },
                getElevation: d => d.height || 12,
                radiusUnits: 'meters',
                lineWidthMinPixels: 2,
                wireframe: false,
              }),
              // Canals as 3D extruded paths (water channels with depth)
              new deck.PathLayer({
                id: 'canals-3d',
                data: canals,
                pickable: true,
                widthMinPixels: 3,
                getPath: d => d.path,
                getColor: d => d.color,
                getWidth: d => d.width,
                widthUnits: 'meters',
                rounded: true,
                billboard: false,
                // Add slight depth to show as water channels
                getElevation: d => d.elevation || -0.5, // Below ground to show as channel
                elevationScale: 1,
                extruded: true,
                capRounded: true,
                jointRounded: true,
                // Add a subtle outline to make canals more visible
                getTilt: 0,
              }),
              // Streets as 3D extruded paths (road surface with slight elevation)
              new deck.PathLayer({
                id: 'streets-3d',
                data: streets,
                pickable: true,
                widthMinPixels: 3,
                getPath: d => d.path,
                getColor: d => d.color,
                getWidth: d => d.width,
                widthUnits: 'meters',
                rounded: true,
                billboard: false,
                // Add slight elevation to show as road surface
                getElevation: d => d.elevation || 0.3, // Above ground to show as road
                elevationScale: 1,
                extruded: true,
                capRounded: true,
                jointRounded: true,
                // Add a subtle outline to make streets more visible
                getTilt: 0,
              }),
            ],
            onError: (error) => {
              console.error('Deck.gl error:', error);
              showError('Deck.gl error: ' + (error.message || 'Unknown error'));
            },
          });

          // Verify initialization
          if (!deckInstance) {
            throw new Error('Failed to initialize deck.gl');
          }

          // Hide loading indicator
          const loadingDiv = document.getElementById('loading');
          if (loadingDiv) loadingDiv.style.display = 'none';
          
          // Send ready message to React Native
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
          }

          // Handle window resize
          const handleResize = () => {
            if (deckInstance) {
              deckInstance.setProps({
                width: window.innerWidth,
                height: window.innerHeight,
              });
            }
          };
          window.addEventListener('resize', handleResize);
          
          // Log success
          console.log('Deck.gl 3D visualization initialized successfully');
          console.log('Rendering', buildingPolygons.length, 'building polygons,', buildingPoints.length, 'building points, and', trees.length, 'trees as 3D shapes');

        } catch (error) {
          showError('Error: ' + error.message + '<br>Check console for details');
        }
      }

      // Wait for deck.gl to load, then initialize
      if (typeof deck !== 'undefined' && deck.DeckGL) {
        initVisualization();
      } else {
        // Wait a bit for the script to load
        setTimeout(() => {
          if (typeof deck !== 'undefined' && deck.DeckGL) {
            initVisualization();
          } else {
            showError('Deck.gl library is taking too long to load. Please check your internet connection and try again.');
          }
        }, 2000);
      }
    })();
  </script>
</body>
</html>
  `;
}

