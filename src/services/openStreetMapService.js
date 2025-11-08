/**
 * OpenStreetMap Service
 * Fetches building data from OpenStreetMap using Overpass API
 */

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

/**
 * Fetch buildings from OpenStreetMap in a bounding box
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radius - Radius in degrees (default 0.01, ~1km)
 * @returns {Promise<Array>} Array of building objects
 */
export async function fetchBuildingsFromOSM(latitude, longitude, radius = 0.01) {
  try {
    // Calculate bounding box
    const minLat = latitude - radius;
    const maxLat = latitude + radius;
    const minLon = longitude - radius;
    const maxLon = longitude + radius;

    // Overpass QL query to get buildings
    const query = `
      [out:json][timeout:25];
      (
        way["building"](${minLat},${minLon},${maxLat},${maxLon});
        relation["building"](${minLat},${minLon},${maxLat},${maxLon});
      );
      out center;
      >;
      out skel qt;
    `;

    // For now, we'll use a simplified approach with Overpass Turbo API
    // or generate mock building data based on the area
    // Real Overpass API requires proper encoding
    
    // Simplified: Use Overpass Turbo endpoint with encoded query
    const encodedQuery = encodeURIComponent(query);
    const url = `${OVERPASS_API}?data=${encodedQuery}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodedQuery}`,
      });

      if (!response.ok) {
        throw new Error('Overpass API request failed');
      }

      const data = await response.json();
      return parseOSMBuildings(data, latitude, longitude);
    } catch (error) {
      console.warn('Overpass API failed, using mock data:', error);
      // Fallback to mock building data
      return generateMockBuildings(latitude, longitude, radius);
    }
  } catch (error) {
    console.error('Error fetching buildings from OSM:', error);
    return generateMockBuildings(latitude, longitude, radius);
  }
}

/**
 * Parse OSM data into building objects
 */
function parseOSMBuildings(osmData, centerLat, centerLon) {
  const buildings = [];
  
  if (!osmData || !osmData.elements) {
    return generateMockBuildings(centerLat, centerLon);
  }

  osmData.elements.forEach((element) => {
    if (element.type === 'way' && element.tags && element.tags.building) {
      // Calculate center point for the building
      let lat = centerLat;
      let lon = centerLon;
      
      if (element.center) {
        lat = element.center.lat;
        lon = element.center.lon;
      } else if (element.geometry && element.geometry.length > 0) {
        // Calculate centroid from geometry
        const coords = element.geometry;
        let sumLat = 0;
        let sumLon = 0;
        coords.forEach(coord => {
          sumLat += coord.lat;
          sumLon += coord.lon;
        });
        lat = sumLat / coords.length;
        lon = sumLon / coords.length;
      }

      buildings.push({
        id: `osm_${element.id}`,
        coordinate: { latitude: lat, longitude: lon },
        type: 'building',
        osmId: element.id,
        buildingType: element.tags.building || 'yes',
        name: element.tags.name || null,
        isReal: true, // Mark as real OSM building
        isUserAdded: false,
      });
    }
  });

  return buildings.length > 0 ? buildings : generateMockBuildings(centerLat, centerLon);
}

/**
 * Generate mock building data for areas without OSM data
 */
function generateMockBuildings(centerLat, centerLon, radius = 0.01) {
  const buildings = [];
  const buildingCount = 15 + Math.floor(Math.random() * 20); // 15-35 buildings

  for (let i = 0; i < buildingCount; i++) {
    // Generate random positions within the radius
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radius;
    const latOffset = distance * Math.cos(angle);
    const lonOffset = distance * Math.sin(angle);

    buildings.push({
      id: `mock_building_${i}`,
      coordinate: {
        latitude: centerLat + latOffset,
        longitude: centerLon + lonOffset,
      },
      type: 'building',
      buildingType: ['residential', 'commercial', 'industrial'][Math.floor(Math.random() * 3)],
      name: null,
      isReal: true, // Mark as real (even if mock, treat as existing building)
      isUserAdded: false,
    });
  }

  return buildings;
}

/**
 * Fetch buildings using a simpler bounding box query with full geometry
 */
export async function fetchBuildingsSimple(latitude, longitude, radius = 0.01) {
  const minLat = latitude - radius;
  const maxLat = latitude + radius;
  const minLon = longitude - radius;
  const maxLon = longitude + radius;

  // Overpass query to get buildings with full geometry (polygons)
  // Only get ways tagged as buildings, exclude other features
  const query = `[out:json][timeout:15];
(
  way["building"](${minLat},${minLon},${maxLat},${maxLon});
);
(._;>;);
out geom;`;

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (response.ok) {
      const data = await response.json();
      return parseOSMBuildingsWithGeometry(data, latitude, longitude);
    } else {
      return generateMockBuildingsWithGeometry(latitude, longitude, radius);
    }
  } catch (error) {
    console.warn('OSM API error, using mock data:', error);
    return generateMockBuildingsWithGeometry(latitude, longitude, radius);
  }
}

/**
 * Parse OSM buildings with full geometry (polygons)
 */
function parseOSMBuildingsWithGeometry(osmData, centerLat, centerLon) {
  const buildings = [];
  
  if (!osmData || !osmData.elements) {
    return generateMockBuildingsWithGeometry(centerLat, centerLon);
  }

  osmData.elements.forEach((element) => {
    // Only process ways that are explicitly tagged as buildings
    // Exclude if also tagged as highway or waterway
    if (element.type === 'way' && 
        element.tags && 
        element.tags.building &&
        !element.tags.highway &&
        !element.tags.waterway) {
      // Get building polygon coordinates
      let polygon = null;
      let center = { latitude: centerLat, longitude: centerLon };
      
      if (element.geometry && element.geometry.length > 0) {
        // Convert OSM geometry to lat/lng coordinates [lon, lat] format
        polygon = element.geometry.map(coord => [coord.lon, coord.lat]);
        
        // Ensure polygon is closed (first point = last point)
        if (polygon.length > 0) {
          const first = polygon[0];
          const last = polygon[polygon.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            polygon.push([first[0], first[1]]);
          }
        }
        
        // Calculate center from polygon
        let sumLat = 0;
        let sumLon = 0;
        element.geometry.forEach(coord => {
          sumLat += coord.lat;
          sumLon += coord.lon;
        });
        center = {
          latitude: sumLat / element.geometry.length,
          longitude: sumLon / element.geometry.length,
        };
      } else if (element.center) {
        center = {
          latitude: element.center.lat,
          longitude: element.center.lon,
        };
        // Create a simple square polygon if no geometry
        const size = 0.0001;
        polygon = [
          [center.longitude - size, center.latitude - size],
          [center.longitude + size, center.latitude - size],
          [center.longitude + size, center.latitude + size],
          [center.longitude - size, center.latitude + size],
          [center.longitude - size, center.latitude - size], // Close polygon
        ];
      } else {
        // Fallback: create simple square
        const size = 0.0001;
        polygon = [
          [center.longitude - size, center.latitude - size],
          [center.longitude + size, center.latitude - size],
          [center.longitude + size, center.latitude + size],
          [center.longitude - size, center.latitude + size],
          [center.longitude - size, center.latitude - size],
        ];
      }

      buildings.push({
        id: `osm_building_${element.id}`,
        coordinate: center,
        polygon: polygon, // Full polygon coordinates [lon, lat]
        type: 'building',
        osmId: element.id,
        buildingType: element.tags.building || 'yes',
        name: element.tags.name || null,
        isReal: true,
        isUserAdded: false,
      });
    }
  });

  return buildings.length > 0 ? buildings : generateMockBuildingsWithGeometry(centerLat, centerLon);
}

/**
 * Generate mock buildings with polygon geometry
 */
function generateMockBuildingsWithGeometry(centerLat, centerLon, radius = 0.01) {
  const buildings = [];
  const buildingCount = 15 + Math.floor(Math.random() * 20);

  for (let i = 0; i < buildingCount; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radius;
    const latOffset = distance * Math.cos(angle);
    const lonOffset = distance * Math.sin(angle);
    
    const center = {
      latitude: centerLat + latOffset,
      longitude: centerLon + lonOffset,
    };
    
    // Create a square polygon
    const size = 0.00008 + Math.random() * 0.00004; // Vary building sizes
    const polygon = [
      [center.longitude - size, center.latitude - size],
      [center.longitude + size, center.latitude - size],
      [center.longitude + size, center.latitude + size],
      [center.longitude - size, center.latitude + size],
      [center.longitude - size, center.latitude - size], // Close polygon
    ];

    buildings.push({
      id: `mock_building_${i}`,
      coordinate: center,
      polygon: polygon,
      type: 'building',
      buildingType: ['residential', 'commercial', 'industrial'][Math.floor(Math.random() * 3)],
      name: null,
      isReal: true,
      isUserAdded: false,
    });
  }

  return buildings;
}

/**
 * Fetch trees from OpenStreetMap in a bounding box
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radius - Radius in degrees (default 0.01, ~1km)
 * @returns {Promise<Array>} Array of tree objects
 */
export async function fetchTreesFromOSM(latitude, longitude, radius = 0.01) {
  const minLat = latitude - radius;
  const maxLat = latitude + radius;
  const minLon = longitude - radius;
  const maxLon = longitude + radius;

  // Overpass query to get trees (natural=tree) and tree areas (landuse=forest, natural=wood)
  // We'll get individual trees as nodes and tree areas as ways
  const query = `[out:json][timeout:15];
(
  node["natural"="tree"](${minLat},${minLon},${maxLat},${maxLon});
  node["natural"="tree_row"](${minLat},${minLon},${maxLat},${maxLon});
  way["landuse"="forest"](${minLat},${minLon},${maxLat},${maxLon});
  way["natural"="wood"](${minLat},${minLon},${maxLat},${maxLon});
);
(._;>;);
out geom;`;

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (response.ok) {
      const data = await response.json();
      return parseOSMTrees(data, latitude, longitude);
    } else {
      return generateMockTrees(latitude, longitude, radius);
    }
  } catch (error) {
    console.warn('OSM trees API error, using mock data:', error);
    return generateMockTrees(latitude, longitude, radius);
  }
}

/**
 * Parse OSM tree data into tree objects
 */
function parseOSMTrees(osmData, centerLat, centerLon) {
  const trees = [];
  
  if (!osmData || !osmData.elements) {
    return generateMockTrees(centerLat, centerLon);
  }

  osmData.elements.forEach((element) => {
    // Handle individual tree nodes
    if (element.type === 'node' && element.tags && (element.tags.natural === 'tree' || element.tags.natural === 'tree_row')) {
      trees.push({
        id: `osm_tree_${element.id}`,
        coordinate: {
          latitude: element.lat,
          longitude: element.lon,
        },
        type: 'tree',
        osmId: element.id,
        name: element.tags.name || null,
        isReal: true,
        isUserAdded: false,
      });
    }
    // Handle forest/wood areas - sample points within the area
    else if (element.type === 'way' && element.tags && (element.tags.landuse === 'forest' || element.tags.natural === 'wood')) {
      // For forest areas, we'll sample a few points to represent trees
      if (element.geometry && element.geometry.length > 0) {
        // Calculate center of the forest area
        let sumLat = 0;
        let sumLon = 0;
        element.geometry.forEach(coord => {
          sumLat += coord.lat;
          sumLon += coord.lon;
        });
        const center = {
          latitude: sumLat / element.geometry.length,
          longitude: sumLon / element.geometry.length,
        };
        
        // Add a few representative trees for the forest area
        const treeCount = Math.min(5, Math.floor(element.geometry.length / 4)); // Up to 5 trees per forest area
        for (let i = 0; i < treeCount; i++) {
          const angle = (i / treeCount) * 2 * Math.PI;
          const distance = 0.00005 * (0.5 + Math.random() * 0.5); // Small random offset
          trees.push({
            id: `osm_forest_${element.id}_${i}`,
            coordinate: {
              latitude: center.latitude + distance * Math.cos(angle),
              longitude: center.longitude + distance * Math.sin(angle),
            },
            type: 'tree',
            osmId: element.id,
            name: element.tags.name || null,
            isReal: true,
            isUserAdded: false,
          });
        }
      }
    }
  });

  return trees.length > 0 ? trees : generateMockTrees(centerLat, centerLon);
}

/**
 * Generate mock tree data for areas without OSM tree data
 */
function generateMockTrees(centerLat, centerLon, radius = 0.01) {
  const trees = [];
  const treeCount = 5 + Math.floor(Math.random() * 10); // 5-15 trees

  for (let i = 0; i < treeCount; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radius;
    const latOffset = distance * Math.cos(angle);
    const lonOffset = distance * Math.sin(angle);

    trees.push({
      id: `mock_tree_${i}`,
      coordinate: {
        latitude: centerLat + latOffset,
        longitude: centerLon + lonOffset,
      },
      type: 'tree',
      name: null,
      isReal: true,
      isUserAdded: false,
    });
  }

  return trees;
}

/**
 * Fetch canals from OpenStreetMap in a bounding box
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radius - Radius in degrees (default 0.01, ~1km)
 * @returns {Promise<Array>} Array of canal objects
 */
export async function fetchCanalsFromOSM(latitude, longitude, radius = 0.01) {
  const minLat = latitude - radius;
  const maxLat = latitude + radius;
  const minLon = longitude - radius;
  const maxLon = longitude + radius;

  // Overpass query to get canals (waterway=canal, waterway=ditch, waterway=river)
  // Exclude ways that are also tagged as buildings or highways
  const query = `[out:json][timeout:15];
(
  way["waterway"="canal"][!"building"][!"highway"](${minLat},${minLon},${maxLat},${maxLon});
  way["waterway"="ditch"][!"building"][!"highway"](${minLat},${minLon},${maxLat},${maxLon});
  way["waterway"="river"][!"building"][!"highway"](${minLat},${minLon},${maxLat},${maxLon});
);
(._;>;);
out geom;`;

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (response.ok) {
      const data = await response.json();
      return parseOSMCanals(data, latitude, longitude);
    } else {
      return generateMockCanals(latitude, longitude, radius);
    }
  } catch (error) {
    console.warn('OSM canals API error, using mock data:', error);
    return generateMockCanals(latitude, longitude, radius);
  }
}

/**
 * Parse OSM canal data into canal objects
 */
function parseOSMCanals(osmData, centerLat, centerLon) {
  const canals = [];
  
  if (!osmData || !osmData.elements) {
    return generateMockCanals(centerLat, centerLon);
  }

  osmData.elements.forEach((element) => {
    // Only process ways that are waterways, exclude if also tagged as building or highway
    if (element.type === 'way' && 
        element.tags && 
        element.tags.waterway &&
        !element.tags.building &&
        !element.tags.highway) {
      if (element.geometry && element.geometry.length > 0) {
        // Convert geometry to coordinates array
        const coordinates = element.geometry.map(coord => ({
          latitude: coord.lat,
          longitude: coord.lon,
        }));

        canals.push({
          id: `osm_canal_${element.id}`,
          coordinates: coordinates,
          type: 'canal',
          waterwayType: element.tags.waterway,
          name: element.tags.name || null,
          isReal: true,
          isUserAdded: false,
        });
      }
    }
  });

  return canals.length > 0 ? canals : generateMockCanals(centerLat, centerLon);
}

/**
 * Generate mock canal data
 */
function generateMockCanals(centerLat, centerLon, radius = 0.01) {
  const canals = [];
  const canalCount = 2 + Math.floor(Math.random() * 3); // 2-4 canals

  for (let i = 0; i < canalCount; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radius;
    const startLat = centerLat + distance * Math.cos(angle);
    const startLon = centerLon + distance * Math.sin(angle);
    
    // Create a simple straight canal
    const length = 0.002; // ~200 meters
    const endLat = startLat + length * Math.cos(angle + Math.PI / 2);
    const endLon = startLon + length * Math.sin(angle + Math.PI / 2);

    canals.push({
      id: `mock_canal_${i}`,
      coordinates: [
        { latitude: startLat, longitude: startLon },
        { latitude: endLat, longitude: endLon },
      ],
      type: 'canal',
      waterwayType: 'canal',
      name: null,
      isReal: true,
      isUserAdded: false,
    });
  }

  return canals;
}

/**
 * Fetch streets/roads from OpenStreetMap in a bounding box
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radius - Radius in degrees (default 0.01, ~1km)
 * @returns {Promise<Array>} Array of street objects
 */
export async function fetchStreetsFromOSM(latitude, longitude, radius = 0.01) {
  const minLat = latitude - radius;
  const maxLat = latitude + radius;
  const minLon = longitude - radius;
  const maxLon = longitude + radius;

  // Overpass query to get streets (highway=primary, secondary, tertiary, residential, etc.)
  // Exclude ways that are also tagged as buildings or waterways
  const query = `[out:json][timeout:15];
(
  way["highway"="primary"][!"building"][!"waterway"](${minLat},${minLon},${maxLat},${maxLon});
  way["highway"="secondary"][!"building"][!"waterway"](${minLat},${minLon},${maxLat},${maxLon});
  way["highway"="tertiary"][!"building"][!"waterway"](${minLat},${minLon},${maxLat},${maxLon});
  way["highway"="residential"][!"building"][!"waterway"](${minLat},${minLon},${maxLat},${maxLon});
  way["highway"="service"][!"building"][!"waterway"](${minLat},${minLon},${maxLat},${maxLon});
);
(._;>;);
out geom;`;

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (response.ok) {
      const data = await response.json();
      return parseOSMStreets(data, latitude, longitude);
    } else {
      return generateMockStreets(latitude, longitude, radius);
    }
  } catch (error) {
    console.warn('OSM streets API error, using mock data:', error);
    return generateMockStreets(latitude, longitude, radius);
  }
}

/**
 * Parse OSM street data into street objects
 */
function parseOSMStreets(osmData, centerLat, centerLon) {
  const streets = [];
  
  if (!osmData || !osmData.elements) {
    return generateMockStreets(centerLat, centerLon);
  }

  osmData.elements.forEach((element) => {
    // Only process ways that are highways, exclude if also tagged as building or waterway
    if (element.type === 'way' && 
        element.tags && 
        element.tags.highway &&
        !element.tags.building &&
        !element.tags.waterway) {
      if (element.geometry && element.geometry.length > 0) {
        // Convert geometry to coordinates array
        const coordinates = element.geometry.map(coord => ({
          latitude: coord.lat,
          longitude: coord.lon,
        }));

        streets.push({
          id: `osm_street_${element.id}`,
          coordinates: coordinates,
          type: 'street',
          highwayType: element.tags.highway,
          name: element.tags.name || null,
          isReal: true,
          isUserAdded: false,
        });
      }
    }
  });

  return streets.length > 0 ? streets : generateMockStreets(centerLat, centerLon);
}

/**
 * Generate mock street data
 */
function generateMockStreets(centerLat, centerLon, radius = 0.01) {
  const streets = [];
  const streetCount = 3 + Math.floor(Math.random() * 4); // 3-6 streets

  for (let i = 0; i < streetCount; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radius;
    const startLat = centerLat + distance * Math.cos(angle);
    const startLon = centerLon + distance * Math.sin(angle);
    
    // Create a simple straight street
    const length = 0.003; // ~300 meters
    const endLat = startLat + length * Math.cos(angle + Math.PI / 2);
    const endLon = startLon + length * Math.sin(angle + Math.PI / 2);

    streets.push({
      id: `mock_street_${i}`,
      coordinates: [
        { latitude: startLat, longitude: startLon },
        { latitude: endLat, longitude: endLon },
      ],
      type: 'street',
      highwayType: ['residential', 'tertiary', 'secondary'][Math.floor(Math.random() * 3)],
      name: null,
      isReal: true,
      isUserAdded: false,
    });
  }

  return streets;
}

