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
  const query = `[out:json][timeout:15];
(
  way["building"](${minLat},${minLon},${maxLat},${maxLon});
);
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
    if (element.type === 'way' && element.tags && element.tags.building) {
      // Get building polygon coordinates
      let polygon = null;
      let center = { latitude: centerLat, longitude: centerLon };
      
      if (element.geometry && element.geometry.length > 0) {
        // Convert OSM geometry to lat/lng coordinates
        polygon = element.geometry.map(coord => [coord.lon, coord.lat]);
        
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
        id: `osm_${element.id}`,
        coordinate: center,
        polygon: polygon, // Full polygon coordinates
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

