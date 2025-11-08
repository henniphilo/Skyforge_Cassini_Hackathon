/**
 * Copernicus Data Service
 * Fetches weather data from Copernicus Atmosphere Monitoring Service (CAMS)
 * and other Copernicus services for temperature, wind, CO2, and humidity
 */

const COPERNICUS_API_BASE = 'https://ads.atmosphere.copernicus.eu/api/v2';

/**
 * Get current weather data from Copernicus services
 * Note: Copernicus APIs typically require authentication
 * This is a simplified version that can be extended with actual API keys
 * 
 * @param {number} latitude - Latitude of the location
 * @param {number} longitude - Longitude of the location
 * @returns {Promise<Object>} Weather data object
 */
export async function getCopernicusWeatherData(latitude, longitude) {
  try {
    // For now, we'll use a mock implementation that simulates Copernicus data
    // In production, you would replace this with actual Copernicus API calls
    // You'll need to register at https://ads.atmosphere.copernicus.eu/ to get API access
    
    // Simulated delay to mimic API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock data structure based on Copernicus data format
    // In production, parse actual API responses
    const mockData = {
      temperature: 9 + Math.random() * 5, // 9-14°C
      windSpeed: 10 + Math.random() * 10, // 10-20 km/h
      windDirection: Math.random() * 360, // 0-360 degrees
      humidity: 60 + Math.random() * 25, // 60-85%
      co2: 410 + Math.random() * 20, // 410-430 ppm (typical atmospheric CO2)
      pressure: 1013 + Math.random() * 20, // 1013-1033 hPa
      timestamp: new Date().toISOString(),
      location: {
        latitude,
        longitude,
      },
    };
    
    return mockData;
  } catch (error) {
    console.error('Error fetching Copernicus data:', error);
    // Return fallback data
    return {
      temperature: 10,
      windSpeed: 15,
      windDirection: 180,
      humidity: 70,
      co2: 415,
      pressure: 1013,
      timestamp: new Date().toISOString(),
      location: { latitude, longitude },
    };
  }
}

/**
 * Calculate weather impact based on building modifications
 * @param {Object} baseWeather - Base weather data from Copernicus
 * @param {Object} modifications - Building modifications (buildings added/removed)
 * @returns {Object} Modified weather data
 */
export function calculateWeatherImpact(baseWeather, modifications) {
  const { buildingsAdded = 0, buildingsRemoved = 0, treesAdded = 0, treesRemoved = 0 } = modifications;
  
  const netBuildings = buildingsAdded - buildingsRemoved;
  const netTrees = treesAdded - treesRemoved;
  
  // Calculate impacts
  // Buildings increase temperature (urban heat island effect)
  const tempChange = netBuildings * 0.15 - netTrees * 0.1;
  
  // Buildings block wind, trees slow it
  const windChange = -(netBuildings * 0.2) - (netTrees * 0.1);
  
  // Buildings reduce humidity, trees increase it
  const humidityChange = -netBuildings * 0.3 + netTrees * 0.4;
  
  // Buildings increase CO2 (more emissions), trees reduce it
  const co2Change = netBuildings * 0.5 - netTrees * 0.3;
  
  return {
    temperature: Math.max(-20, Math.min(50, baseWeather.temperature + tempChange)),
    windSpeed: Math.max(0, Math.min(100, baseWeather.windSpeed + windChange)),
    humidity: Math.max(0, Math.min(100, baseWeather.humidity + humidityChange)),
    co2: Math.max(300, baseWeather.co2 + co2Change),
    pressure: baseWeather.pressure, // Less affected by local changes
    windDirection: baseWeather.windDirection,
  };
}

/**
 * Get historical weather data (for trends)
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {number} days - Number of days to fetch
 */
export async function getHistoricalWeatherData(latitude, longitude, days = 7) {
  // This would fetch historical data from Copernicus
  // For now, return mock data
  const data = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      temperature: 8 + Math.random() * 6,
      humidity: 65 + Math.random() * 20,
      co2: 410 + Math.random() * 15,
    });
  }
  return data.reverse();
}

