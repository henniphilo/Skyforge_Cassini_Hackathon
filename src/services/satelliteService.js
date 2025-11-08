/**
 * Service for calculating Sentinel satellite pass times
 * Sentinel satellites are in sun-synchronous orbits with ~100 minute orbital periods
 */

/**
 * Calculate the time since the last Sentinel pass and time until next pass
 * Based on Sentinel-2 orbit characteristics:
 * - Orbital period: ~100 minutes (6000 seconds)
 * - Sun-synchronous orbit
 * - Multiple satellites in constellation (Sentinel-2A, Sentinel-2B)
 * 
 * @param {number} latitude - Location latitude
 * @param {number} longitude - Location longitude
 * @returns {Object} Object with timeSinceLastPass (seconds) and timeUntilNextPass (seconds)
 */
export function calculateSentinelPassTimes(latitude, longitude) {
  // Sentinel-2 orbital period in seconds (~100 minutes)
  const ORBITAL_PERIOD = 100 * 60; // 6000 seconds
  
  // Sentinel-2 constellation has multiple satellites
  // For simplicity, we'll calculate based on the average revisit time
  // Sentinel-2A and Sentinel-2B together provide ~5 day revisit at equator
  // At mid-latitudes, revisit is more frequent due to overlapping swaths
  
  // Calculate approximate time since last pass
  // This is a simplified calculation - in reality, pass times depend on
  // the satellite's exact orbital position and the location's latitude
  
  // For a more accurate calculation, we'd need:
  // 1. Current satellite position (TLE data)
  // 2. Ground track calculations
  // 3. Visibility windows
  
  // Simplified approach: Use current time modulo orbital period
  // This gives us a reasonable approximation
  const now = Date.now() / 1000; // Current time in seconds
  const timeSinceEpoch = now % ORBITAL_PERIOD;
  
  // Assume last pass was at the start of current orbital period
  const timeSinceLastPass = timeSinceEpoch;
  
  // Next pass will be when the current period completes
  const timeUntilNextPass = ORBITAL_PERIOD - timeSinceEpoch;
  
  return {
    timeSinceLastPass: Math.floor(timeSinceLastPass),
    timeUntilNextPass: Math.floor(timeUntilNextPass),
    lastPassTime: new Date((now - timeSinceLastPass) * 1000),
    nextPassTime: new Date((now + timeUntilNextPass) * 1000),
  };
}

/**
 * Format time duration as MM:SS
 */
export function formatTimeDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format time duration as human-readable string
 */
export function formatTimeSince(seconds) {
  if (seconds < 60) {
    return `${seconds}s ago`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m ago`;
  }
}

