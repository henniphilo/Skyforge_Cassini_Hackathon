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
 * @returns {Object} GeoJSON FeatureCollection
 */
export function convertToGeoJSON(existingBuildings, userBuildings, removedBuildings, location) {
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
export function generateDeckGLHTML(geoJsonData, location) {
  const dataString = JSON.stringify(geoJsonData);
  const centerLat = location?.latitude || 52.52;
  const centerLon = location?.longitude || 13.405;

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
      background: #000;
    }
    #deck-container {
      width: 100vw;
      height: 100vh;
      position: relative;
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
      <div>🔵 Blue: Existing Buildings</div>
      <div>🟢 Green: Added Buildings/Trees</div>
      <div>🔴 Red: Removed Buildings</div>
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

          // Check if deck.gl is loaded
          if (typeof deck === 'undefined' || !deck.DeckGL) {
            showError('Deck.gl library failed to load. Please check your internet connection.');
            return;
          }

          if (!data || !data.features || data.features.length === 0) {
            showError('No data to visualize. Add some buildings or trees first.');
            return;
          }

          // Convert GeoJSON to 3D building/tree shapes
          const buildingPolygons = [];
          const buildingPoints = [];
          const trees = [];
          
          data.features.forEach(f => {
            const isRemoved = f.properties.status === 'removed';
            const isTree = f.properties.type === 'tree';
            const isAdded = f.properties.status === 'added';
            
            if (isTree) {
              // Trees as 3D cylinders
              trees.push({
                position: f.geometry.coordinates,
                color: isAdded ? [34, 197, 94, 240] : [34, 139, 34, 240],
                radius: 15, // meters
                height: isRemoved ? 0 : 20, // meters - tree height
                type: 'tree',
                status: f.properties.status,
              });
            } else if (f.geometry.type === 'Polygon' && f.geometry.coordinates && f.geometry.coordinates[0]) {
              // Buildings with polygon geometry - render as 3D extruded polygons
              const buildingHeight = isRemoved ? 0 : (isAdded ? 25 : 30); // meters
              buildingPolygons.push({
                polygon: f.geometry.coordinates[0], // First ring of polygon
                color: isRemoved ? [239, 68, 68, 200] :
                       isAdded ? [16, 185, 129, 240] : [59, 130, 246, 240],
                height: buildingHeight,
                type: 'building',
                status: f.properties.status,
              });
            } else {
              // Buildings as points - render as 3D columns
              const buildingHeight = isRemoved ? 0 : (isAdded ? 25 : 30); // meters
              buildingPoints.push({
                position: f.geometry.coordinates,
                color: isRemoved ? [239, 68, 68, 200] :
                       isAdded ? [16, 185, 129, 240] : [59, 130, 246, 240],
                width: 20, // meters
                height: buildingHeight,
                type: 'building',
                status: f.properties.status,
              });
            }
          });

          console.log('Initializing deck.gl with', buildingPolygons.length, 'building polygons,', buildingPoints.length, 'building points, and', trees.length, 'trees');

          // Create deck.gl visualization with 3D shapes
          const deckInstance = new deck.DeckGL({
            container: 'deck-container',
            initialViewState: {
              longitude: centerLon,
              latitude: centerLat,
              zoom: 15,
              pitch: 60,
              bearing: -17.6,
              minZoom: 10,
              maxZoom: 20,
            },
            controller: true,
            layers: [
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
              // Trees as 3D cylinders (circular columns)
              new deck.ColumnLayer({
                id: 'trees-3d',
                data: trees,
                pickable: true,
                opacity: 0.85,
                diskResolution: 16, // Smooth circular cylinders
                extruded: true,
                elevationScale: 1,
                getPosition: d => d.position,
                getRadius: d => d.radius, // Use tree radius
                getFillColor: d => d.color,
                getLineColor: [34, 139, 34, 255],
                getElevation: d => d.height,
                radiusUnits: 'meters',
                lineWidthMinPixels: 1,
                wireframe: false,
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

