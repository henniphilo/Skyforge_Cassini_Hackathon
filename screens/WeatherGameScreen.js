import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polygon, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { theme } from '../theme';
import { getCopernicusWeatherData, calculateWeatherImpact } from '../src/services/copernicusService';
import { fetchBuildingsSimple } from '../src/services/openStreetMapService';
import OpenStreetMapTile from '../components/OpenStreetMapTile';
import KeplerGLView from '../components/KeplerGLView';

const { width, height } = Dimensions.get('window');

export default function WeatherGameScreen() {
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [baseWeather, setBaseWeather] = useState(null);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [existingBuildings, setExistingBuildings] = useState([]); // Buildings from OSM
  const [userBuildings, setUserBuildings] = useState([]); // User-added buildings/trees
  const [removedBuildings, setRemovedBuildings] = useState([]); // Buildings that were removed
  const [mode, setMode] = useState('view'); // 'view', 'add-building', 'add-tree', 'remove'
  const [showMarkers, setShowMarkers] = useState(false); // Toggle markers visibility for editing
  const [showRendered, setShowRendered] = useState(false); // Toggle rendered changes on map
  const [showKepler, setShowKepler] = useState(false); // Toggle Kepler.gl 3D visualization
  const mapRef = useRef(null);

  useEffect(() => {
    initializeLocation();
  }, []);

  useEffect(() => {
    if (baseWeather) {
      updateWeatherWithModifications();
    }
  }, [userBuildings, removedBuildings, baseWeather]);

  const initializeLocation = async () => {
    try {
      setLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        // Default to Berlin
        const defaultLocation = { latitude: 52.52, longitude: 13.405 };
        setLocation(defaultLocation);
        await loadWeatherData(defaultLocation);
        return;
      }

      const locationData = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      };
      setLocation(coords);
      await loadWeatherData(coords);
    } catch (error) {
      console.error('Error initializing location:', error);
      const defaultLocation = { latitude: 52.52, longitude: 13.405 };
      setLocation(defaultLocation);
      await loadWeatherData(defaultLocation);
    } finally {
      setLoading(false);
    }
  };

  const loadWeatherData = async (coords) => {
    try {
      // Load weather data and buildings in parallel
      const [weatherData, buildingsData] = await Promise.all([
        getCopernicusWeatherData(coords.latitude, coords.longitude),
        fetchBuildingsSimple(coords.latitude, coords.longitude, 0.01)
      ]);
      
      setBaseWeather(weatherData);
      setCurrentWeather(weatherData);
      setExistingBuildings(buildingsData);
    } catch (error) {
      console.error('Error loading weather data:', error);
      // Still try to load weather data even if buildings fail
      const weatherData = await getCopernicusWeatherData(coords.latitude, coords.longitude);
      setBaseWeather(weatherData);
      setCurrentWeather(weatherData);
    }
  };

  const updateWeatherWithModifications = () => {
    if (!baseWeather) return;

    const modifications = {
      buildingsAdded: userBuildings.filter(b => b.type === 'building').length,
      buildingsRemoved: removedBuildings.length, // Count removed buildings
      treesAdded: userBuildings.filter(b => b.type === 'tree').length,
      treesRemoved: 0,
    };

    const modifiedWeather = calculateWeatherImpact(baseWeather, modifications);
    setCurrentWeather(modifiedWeather);
  };

  const handleMapPress = (event) => {
    if (mode === 'add-building' || mode === 'add-tree') {
      const { coordinate } = event.nativeEvent;
      const buildingType = mode === 'add-building' ? 'building' : 'tree';
      
      // Create polygon for buildings
      let polygon = null;
      if (buildingType === 'building') {
        const size = 0.0001; // Building size in degrees
        polygon = [
          [coordinate.longitude - size, coordinate.latitude - size],
          [coordinate.longitude + size, coordinate.latitude - size],
          [coordinate.longitude + size, coordinate.latitude + size],
          [coordinate.longitude - size, coordinate.latitude + size],
          [coordinate.longitude - size, coordinate.latitude - size], // Close polygon
        ];
      }
      
      const newBuilding = {
        id: `user_${Date.now()}`,
        coordinate,
        polygon: polygon, // Add polygon for buildings
        type: buildingType,
        isUserAdded: true,
      };
      setUserBuildings([...userBuildings, newBuilding]);
    } else if (mode === 'remove') {
      // Find nearest existing building (not already removed, not user-added)
      const { coordinate } = event.nativeEvent;
      const availableBuildings = existingBuildings.filter(
        b => !removedBuildings.some(rb => rb.id === b.id)
      );
      
      if (availableBuildings.length === 0) {
        Alert.alert('No Buildings', 'No more buildings to remove in this area.');
        return;
      }

      const nearestBuilding = availableBuildings.reduce((nearest, building) => {
        const dist = Math.sqrt(
          Math.pow(building.coordinate.latitude - coordinate.latitude, 2) +
          Math.pow(building.coordinate.longitude - coordinate.longitude, 2)
        );
        const nearestDist = nearest ? Math.sqrt(
          Math.pow(nearest.coordinate.latitude - coordinate.latitude, 2) +
          Math.pow(nearest.coordinate.longitude - coordinate.longitude, 2)
        ) : Infinity;
        return dist < nearestDist ? building : nearest;
      }, null);

      if (nearestBuilding) {
        // Mark building as removed
        setRemovedBuildings([...removedBuildings, nearestBuilding]);
      }
    }
  };

  const handleMarkerPress = (building) => {
    if (mode === 'remove') {
      // Check if it's an existing building (not user-added)
      if (!building.isUserAdded && !removedBuildings.some(rb => rb.id === building.id)) {
        // Remove existing building
        setRemovedBuildings([...removedBuildings, building]);
      }
    } else if (building.isUserAdded) {
      // Remove user-added building/tree (works in any mode)
      setUserBuildings(userBuildings.filter(b => b.id !== building.id));
    }
  };

  const getWeatherEmoji = () => {
    if (!currentWeather) return '🌤️';
    const humidity = currentWeather.humidity;
    if (humidity > 80) return '🌧️';
    if (humidity > 60) return '☁️';
    if (humidity > 40) return '⛅';
    return '☀️';
  };

  const getGradientColors = () => {
    if (!currentWeather) return ['#87CEEB', '#4A90E2'];
    const humidity = currentWeather.humidity;
    if (humidity > 80) return ['#4A5568', '#2D3748'];
    if (humidity > 60) return ['#A0AEC0', '#718096'];
    if (humidity > 40) return ['#7BB5F0', '#4A90E2'];
    return ['#FDB813', '#F59E0B'];
  };

  const getWeatherImpact = () => {
    if (!baseWeather || !currentWeather) return null;
    return {
      temp: (currentWeather.temperature - baseWeather.temperature).toFixed(1),
      wind: (currentWeather.windSpeed - baseWeather.windSpeed).toFixed(1),
      humidity: (currentWeather.humidity - baseWeather.humidity).toFixed(1),
      co2: (currentWeather.co2 - baseWeather.co2).toFixed(1),
    };
  };

  // Generate building polygon coordinates (square building)
  const generateBuildingPolygon = (center, size = 0.0001) => {
    return [
      { latitude: center.latitude - size, longitude: center.longitude - size },
      { latitude: center.latitude - size, longitude: center.longitude + size },
      { latitude: center.latitude + size, longitude: center.longitude + size },
      { latitude: center.latitude + size, longitude: center.longitude - size },
    ];
  };

  // Generate tree circle coordinates
  const generateTreeCircle = (center, radius = 0.00008) => {
    return {
      center,
      radius: radius * 111000, // Convert degrees to meters (approximate)
    };
  };

  if (loading || !location || !currentWeather) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#87CEEB', '#4A90E2']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.loadingText}>Loading 3D map and weather data...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const impact = getWeatherImpact();

  return (
    <View style={styles.container}>
      <LinearGradient colors={getGradientColors()} style={styles.gradient}>
        {/* Map Container */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            pitchEnabled={true}
            rotateEnabled={true}
            showsUserLocation={true}
            showsMyLocationButton={false}
            onPress={handleMapPress}
            mapType="none"
          >
            {/* OpenStreetMap Tile Layer */}
            <OpenStreetMapTile />
            
            {/* Rendered Changes - Show actual buildings and trees on the map */}
            {showRendered && (
              <>
                {/* Existing buildings from OSM - Rendered as Polygons (OSM style) */}
                {existingBuildings
                  .filter(building => !removedBuildings.some(rb => rb.id === building.id))
                  .map((building) => (
                    <Polygon
                      key={building.id}
                      coordinates={generateBuildingPolygon(building.coordinate, 0.00012)}
                      fillColor="rgba(200, 200, 200, 0.7)"
                      strokeColor="rgba(150, 150, 150, 0.9)"
                      strokeWidth={1}
                      tappable={true}
                      onPress={() => handleMarkerPress(building)}
                    />
                  ))}
                
                {/* User-added buildings - Rendered as Polygons (OSM style) */}
                {userBuildings
                  .filter(b => b.type === 'building')
                  .map((building) => (
                    <Polygon
                      key={building.id}
                      coordinates={generateBuildingPolygon(building.coordinate, 0.00012)}
                      fillColor="rgba(200, 200, 200, 0.7)"
                      strokeColor="rgba(150, 150, 150, 0.9)"
                      strokeWidth={1}
                      tappable={true}
                      onPress={() => handleMarkerPress(building)}
                    />
                  ))}
                
                {/* User-added trees - Rendered as Circles (OSM style - green areas) */}
                {userBuildings
                  .filter(b => b.type === 'tree')
                  .map((building) => {
                    const circle = generateTreeCircle(building.coordinate, 0.0001);
                    return (
                      <Circle
                        key={building.id}
                        center={circle.center}
                        radius={circle.radius}
                        fillColor="rgba(152, 251, 152, 0.6)"
                        strokeColor="rgba(34, 139, 34, 0.8)"
                        strokeWidth={1}
                        tappable={true}
                        onPress={() => handleMarkerPress(building)}
                      />
                    );
                  })}
              </>
            )}
            
            {/* Markers - Only shown when editing (showMarkers = true) */}
            {showMarkers && (
              <>
                {/* Existing buildings from OSM - Markers */}
                {existingBuildings
                  .filter(building => !removedBuildings.some(rb => rb.id === building.id))
                  .map((building) => (
                    <Marker
                      key={building.id}
                      coordinate={building.coordinate}
                      title={building.name || 'Building'}
                      description={mode === 'remove' ? 'Tap to remove' : 'Existing building'}
                      onPress={() => handleMarkerPress(building)}
                    >
                      <View style={[styles.markerContainer, styles.existingBuildingMarker]}>
                        <Text style={styles.markerIcon}>🏢</Text>
                      </View>
                    </Marker>
                  ))}
                
                {/* Removed buildings - Markers */}
                {removedBuildings.map((building) => (
                  <Marker
                    key={`removed_${building.id}`}
                    coordinate={building.coordinate}
                    title="Removed Building"
                    description="This building was removed"
                  >
                    <View style={[styles.markerContainer, styles.removedBuildingMarker]}>
                      <Text style={styles.markerIcon}>❌</Text>
                    </View>
                  </Marker>
                ))}
                
                {/* User-added buildings and trees - Markers */}
                {userBuildings.map((building) => (
                  <Marker
                    key={building.id}
                    coordinate={building.coordinate}
                    title={building.type === 'building' ? 'Added Building' : 'Added Tree'}
                    description="Tap to remove"
                    onPress={() => handleMarkerPress(building)}
                  >
                    <View style={[styles.markerContainer, styles.userAddedMarker]}>
                      <Text style={styles.markerIcon}>
                        {building.type === 'building' ? '🏗️' : '🌳'}
                      </Text>
                    </View>
                  </Marker>
                ))}
              </>
            )}
          </MapView>

          {/* OpenStreetMap Attribution */}
          <View style={styles.attribution}>
            <Text style={styles.attributionText}>
              © OpenStreetMap contributors
            </Text>
          </View>

          {/* Map Controls Overlay */}
          <View style={styles.mapControls}>
            <TouchableOpacity
              style={[styles.controlButton, styles.showMarkersButton, showMarkers && styles.controlButtonActive]}
              onPress={() => setShowMarkers(!showMarkers)}
            >
              <Text style={[styles.controlButtonText, showMarkers && styles.controlButtonTextActive]}>
                {showMarkers ? '👁️ Hide Markers' : '📍 Show Markers'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.renderButton, showRendered && styles.controlButtonActive]}
              onPress={() => setShowRendered(!showRendered)}
            >
              <Text style={[styles.controlButtonText, showRendered && styles.controlButtonTextActive]}>
                {showRendered ? '🗺️ Hide Changes' : '🏗️ Render Changes'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.keplerButton]}
              onPress={() => setShowKepler(true)}
            >
              <Text style={styles.controlButtonText}>
                🌐 3D View
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, mode === 'add-building' && styles.controlButtonActive]}
              onPress={() => {
                setMode(mode === 'add-building' ? 'view' : 'add-building');
                if (mode !== 'add-building') setShowMarkers(true); // Auto-show markers when adding
              }}
            >
              <Text style={[styles.controlButtonText, mode === 'add-building' && styles.controlButtonTextActive]}>
                🏢 Add Building
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, mode === 'add-tree' && styles.controlButtonActive]}
              onPress={() => {
                setMode(mode === 'add-tree' ? 'view' : 'add-tree');
                if (mode !== 'add-tree') setShowMarkers(true); // Auto-show markers when adding
              }}
            >
              <Text style={[styles.controlButtonText, mode === 'add-tree' && styles.controlButtonTextActive]}>
                🌳 Add Tree
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, mode === 'remove' && styles.controlButtonActive]}
              onPress={() => {
                setMode(mode === 'remove' ? 'view' : 'remove');
                if (mode !== 'remove') setShowMarkers(true); // Auto-show markers when removing
              }}
            >
              <Text style={[styles.controlButtonText, mode === 'remove' && styles.controlButtonTextActive]}>
                ➖ Remove
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {
                setUserBuildings([]);
                setRemovedBuildings([]);
                setMode('view');
                setShowRendered(false);
              }}
            >
              <Text style={styles.controlButtonText}>🔄 Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Weather Stats Panel */}
        <View style={styles.statsPanel}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>🌍 Weather Impact</Text>
            <Text style={styles.modeIndicator}>
              {showRendered ? '🏗️ Changes Rendered' : showMarkers ? '📍 Markers Visible' : '🗺️ OSM Map'} | {' '}
              {mode === 'add-building' ? 'Tap map to add buildings' : 
               mode === 'add-tree' ? 'Tap map to add trees' :
               mode === 'remove' ? `Tap buildings to remove (${existingBuildings.length - removedBuildings.length} available)` : 
               `Buildings: ${existingBuildings.length - removedBuildings.length}/${existingBuildings.length} remaining`}
            </Text>
          </View>

          <View style={styles.weatherGrid}>
            <StatCard
              icon="🌡️"
              label="Temperature"
              value={`${currentWeather.temperature.toFixed(1)}°C`}
              change={impact?.temp}
            />
            <StatCard
              icon="💨"
              label="Wind Speed"
              value={`${currentWeather.windSpeed.toFixed(1)} km/h`}
              change={impact?.wind}
            />
            <StatCard
              icon="💧"
              label="Humidity"
              value={`${currentWeather.humidity.toFixed(1)}%`}
              change={impact?.humidity}
            />
            <StatCard
              icon="🌍"
              label="CO₂"
              value={`${currentWeather.co2.toFixed(1)} ppm`}
              change={impact?.co2}
            />
          </View>

          <View style={styles.buildingsInfo}>
            <Text style={styles.buildingsCount}>
              Existing: {existingBuildings.length - removedBuildings.length}/{existingBuildings.length} buildings | 
              Removed: {removedBuildings.length} | 
              Added: {userBuildings.filter(b => b.type === 'building').length} buildings, {userBuildings.filter(b => b.type === 'tree').length} trees
            </Text>
          </View>
        </View>

        {/* Kepler.gl 3D Visualization Modal */}
        <KeplerGLView
          visible={showKepler}
          onClose={() => setShowKepler(false)}
          existingBuildings={existingBuildings}
          userBuildings={userBuildings}
          removedBuildings={removedBuildings}
          location={location}
        />
      </LinearGradient>
    </View>
  );
}

function StatCard({ icon, label, value, change }) {
  const changeValue = parseFloat(change || 0);
  const isPositive = changeValue > 0;
  const isNegative = changeValue < 0;

  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {changeValue !== 0 && (
        <Text style={[
          styles.statChange,
          isPositive && styles.statChangePositive,
          isNegative && styles.statChangeNegative,
        ]}>
          {isPositive ? '↑' : '↓'} {Math.abs(changeValue).toFixed(1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: theme.spacing.md,
    fontSize: 16,
  },
  mapContainer: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 50 : 40,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  map: {
    flex: 1,
  },
  attribution: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    ...theme.shadows.sm,
  },
  attributionText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  mapControls: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  showMarkersButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)', // Blue for markers
  },
  renderButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)', // Green for render
  },
  keplerButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.9)', // Purple for 3D view
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.md,
  },
  controlButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  controlButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000',
  },
  controlButtonTextActive: {
    color: '#FFF',
  },
  markerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 4,
    ...theme.shadows.sm,
  },
  existingBuildingMarker: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)', // Blue for existing buildings
    borderWidth: 2,
    borderColor: '#FFF',
  },
  removedBuildingMarker: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)', // Red for removed buildings
    borderWidth: 2,
    borderColor: '#FFF',
    opacity: 0.7,
  },
  userAddedMarker: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)', // Green for user-added
    borderWidth: 2,
    borderColor: '#FFF',
  },
  markerIcon: {
    fontSize: 24,
  },
  statsPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    maxHeight: height * 0.4,
  },
  statsHeader: {
    marginBottom: theme.spacing.md,
  },
  statsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  modeIndicator: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    width: '48%',
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  statIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  statChange: {
    fontSize: 11,
    fontWeight: '600',
  },
  statChangePositive: {
    color: theme.colors.error,
  },
  statChangeNegative: {
    color: theme.colors.success,
  },
  buildingsInfo: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  buildingsCount: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
