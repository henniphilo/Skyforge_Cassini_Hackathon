import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, Alert, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polygon, Circle, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { theme } from '../theme';
import { getCopernicusWeatherData, calculateWeatherImpact } from '../src/services/copernicusService';
import { fetchBuildingsSimple, fetchTreesFromOSM, fetchCanalsFromOSM, fetchStreetsFromOSM } from '../src/services/openStreetMapService';
import OpenStreetMapTile from '../components/OpenStreetMapTile';
import KeplerGLView from '../components/KeplerGLView';

const { width, height } = Dimensions.get('window');

export default function WeatherGameScreen() {
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [baseWeather, setBaseWeather] = useState(null);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [existingBuildings, setExistingBuildings] = useState([]); // Buildings from OSM
  const [existingTrees, setExistingTrees] = useState([]); // Trees from OSM
  const [existingCanals, setExistingCanals] = useState([]); // Canals from OSM
  const [existingStreets, setExistingStreets] = useState([]); // Streets from OSM
  const [userBuildings, setUserBuildings] = useState([]); // User-added buildings/trees/canals/streets
  const [removedBuildings, setRemovedBuildings] = useState([]); // Buildings that were removed
  const [removedTrees, setRemovedTrees] = useState([]); // Trees that were removed
  const [removedCanals, setRemovedCanals] = useState([]); // Canals that were removed
  const [removedStreets, setRemovedStreets] = useState([]); // Streets that were removed
  const [mode, setMode] = useState('view'); // 'view', 'add-building', 'add-tree', 'add-canal', 'add-street', 'remove'
  const [showMarkers, setShowMarkers] = useState(false); // Toggle markers visibility for editing
  const [showKepler, setShowKepler] = useState(false); // Toggle Kepler.gl 3D visualization
  const [showBuildMenu, setShowBuildMenu] = useState(false); // Toggle build dropdown menu
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
      // Load weather data, buildings, trees, canals, and streets in parallel
      const [weatherData, buildingsData, treesData, canalsData, streetsData] = await Promise.all([
        getCopernicusWeatherData(coords.latitude, coords.longitude),
        fetchBuildingsSimple(coords.latitude, coords.longitude, 0.01),
        fetchTreesFromOSM(coords.latitude, coords.longitude, 0.01),
        fetchCanalsFromOSM(coords.latitude, coords.longitude, 0.01),
        fetchStreetsFromOSM(coords.latitude, coords.longitude, 0.01)
      ]);
      
      setBaseWeather(weatherData);
      setCurrentWeather(weatherData);
      setExistingBuildings(buildingsData);
      setExistingTrees(treesData);
      setExistingCanals(canalsData);
      setExistingStreets(streetsData);
    } catch (error) {
      console.error('Error loading weather data:', error);
      // Still try to load weather data even if other data fails
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
    const { coordinate } = event.nativeEvent;

    if (mode === 'add-building' || mode === 'add-tree') {
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
    } else if (mode === 'add-canal' || mode === 'add-street') {
      // For canals and streets, create a short straight line segment
      const itemType = mode === 'add-canal' ? 'canal' : 'street';
      const length = 0.002; // ~200 meters
      const angle = Math.random() * 2 * Math.PI; // Random direction
      
      const endCoordinate = {
        latitude: coordinate.latitude + length * Math.cos(angle),
        longitude: coordinate.longitude + length * Math.sin(angle),
      };

      const newItem = {
        id: `user_${Date.now()}`,
        coordinates: [coordinate, endCoordinate],
        type: itemType,
        isUserAdded: true,
      };
      setUserBuildings([...userBuildings, newItem]);
    } else if (mode === 'remove') {
      // Find nearest existing building (not already removed, not user-added)
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
        setRemovedBuildings([...removedBuildings, nearestBuilding]);
      }
    } else if (mode === 'remove') {
      // Unified remove mode - finds and removes the nearest item of any type
      const allItems = [];
      
      // Add buildings
      existingBuildings
        .filter(b => !removedBuildings.some(rb => rb.id === b.id))
        .forEach(b => allItems.push({ ...b, itemType: 'building', isUserAdded: false }));
      
      // Add trees
      existingTrees
        .filter(t => !removedTrees.some(rt => rt.id === t.id))
        .forEach(t => allItems.push({ ...t, itemType: 'tree', isUserAdded: false }));
      
      userBuildings
        .filter(b => b.type === 'tree')
        .forEach(t => allItems.push({ ...t, itemType: 'tree', isUserAdded: true }));
      
      // Add canals
      existingCanals
        .filter(c => !removedCanals.some(rc => rc.id === c.id))
        .forEach(c => allItems.push({ ...c, itemType: 'canal', isUserAdded: false }));
      
      userBuildings
        .filter(b => b.type === 'canal')
        .forEach(c => allItems.push({ ...c, itemType: 'canal', isUserAdded: true }));
      
      // Add streets
      existingStreets
        .filter(s => !removedStreets.some(rs => rs.id === s.id))
        .forEach(s => allItems.push({ ...s, itemType: 'street', isUserAdded: false }));
      
      userBuildings
        .filter(b => b.type === 'street')
        .forEach(s => allItems.push({ ...s, itemType: 'street', isUserAdded: true }));
      
      if (allItems.length === 0) {
        Alert.alert('No Items', 'No items to remove in this area.');
        return;
      }

      // Find nearest item
      const nearestItem = allItems.reduce((nearest, item) => {
        let itemCoord = null;
        let minDist = Infinity;
        
        if (item.coordinate) {
          itemCoord = item.coordinate;
        } else if (item.coordinates && item.coordinates.length > 0) {
          // For lines (canals/streets), find closest point on line
          item.coordinates.forEach(coord => {
            const dist = Math.sqrt(
              Math.pow(coord.latitude - coordinate.latitude, 2) +
              Math.pow(coord.longitude - coordinate.longitude, 2)
            );
            if (dist < minDist) {
              minDist = dist;
              itemCoord = coord;
            }
          });
        }
        
        if (!itemCoord) return nearest;
        
        const dist = Math.sqrt(
          Math.pow(itemCoord.latitude - coordinate.latitude, 2) +
          Math.pow(itemCoord.longitude - coordinate.longitude, 2)
        );
        
        const nearestDist = nearest ? (() => {
          const nearestCoord = nearest.coordinate || (nearest.coordinates && nearest.coordinates[0]);
          if (!nearestCoord) return Infinity;
          return Math.sqrt(
            Math.pow(nearestCoord.latitude - coordinate.latitude, 2) +
            Math.pow(nearestCoord.longitude - coordinate.longitude, 2)
          );
        })() : Infinity;
        
        return dist < nearestDist ? { ...item, itemCoord, dist } : nearest;
      }, null);

      if (nearestItem) {
        if (nearestItem.isUserAdded) {
          // Remove user-added item
          setUserBuildings(userBuildings.filter(b => b.id !== nearestItem.id));
        } else {
          // Remove OSM item
          const itemType = nearestItem.itemType;
          if (itemType === 'building') {
            setRemovedBuildings([...removedBuildings, nearestItem]);
          } else if (itemType === 'tree') {
            setRemovedTrees([...removedTrees, nearestItem]);
          } else if (itemType === 'canal') {
            setRemovedCanals([...removedCanals, nearestItem]);
          } else if (itemType === 'street') {
            setRemovedStreets([...removedStreets, nearestItem]);
          }
        }
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
            
            {/* Always show canals on the map */}
            {/* Existing canals from OSM (not removed) */}
            {existingCanals
              .filter(canal => !removedCanals.some(rc => rc.id === canal.id))
              .map((canal) => (
                <Polyline
                  key={canal.id}
                  coordinates={canal.coordinates}
                  strokeColor="rgba(59, 130, 246, 0.8)"
                  strokeWidth={4}
                  tappable={true}
                  onPress={() => handleMarkerPress(canal)}
                />
              ))}
            
            {/* User-added canals */}
            {userBuildings
              .filter(b => b.type === 'canal')
              .map((canal) => (
                <Polyline
                  key={canal.id}
                  coordinates={canal.coordinates}
                  strokeColor="rgba(34, 197, 94, 0.9)"
                  strokeWidth={5}
                  tappable={true}
                  onPress={() => handleMarkerPress(canal)}
                />
              ))}
            
            {/* Removed canals (shown in red) */}
            {removedCanals.map((canal) => (
              <Polyline
                key={`removed_${canal.id}`}
                coordinates={canal.coordinates}
                strokeColor="rgba(239, 68, 68, 0.6)"
                strokeWidth={4}
                lineDashPattern={[5, 5]}
                tappable={true}
                onPress={() => handleMarkerPress(canal)}
              />
            ))}
            
            {/* Always show streets on the map */}
            {/* Existing streets from OSM (not removed) */}
            {existingStreets
              .filter(street => !removedStreets.some(rs => rs.id === street.id))
              .map((street) => (
                <Polyline
                  key={street.id}
                  coordinates={street.coordinates}
                  strokeColor="rgba(100, 100, 100, 0.7)"
                  strokeWidth={3}
                  tappable={true}
                  onPress={() => handleMarkerPress(street)}
                />
              ))}
            
            {/* User-added streets */}
            {userBuildings
              .filter(b => b.type === 'street')
              .map((street) => (
                <Polyline
                  key={street.id}
                  coordinates={street.coordinates}
                  strokeColor="rgba(16, 185, 129, 0.9)"
                  strokeWidth={4}
                  tappable={true}
                  onPress={() => handleMarkerPress(street)}
                />
              ))}
            
            {/* Removed streets (shown in red) */}
            {removedStreets.map((street) => (
              <Polyline
                key={`removed_${street.id}`}
                coordinates={street.coordinates}
                strokeColor="rgba(239, 68, 68, 0.6)"
                strokeWidth={3}
                lineDashPattern={[5, 5]}
                tappable={true}
                onPress={() => handleMarkerPress(street)}
              />
            ))}
            
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
              style={[styles.controlButton, styles.keplerButton]}
              onPress={() => setShowKepler(true)}
            >
              <Text style={styles.controlButtonText}>
                🌐 3D View
              </Text>
            </TouchableOpacity>
            
            {/* Build Button with Dropdown */}
            <View style={styles.buildButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.controlButton, 
                  styles.buildButton,
                  (mode.startsWith('add-') || showBuildMenu) && styles.controlButtonActive
                ]}
                onPress={() => {
                  setShowBuildMenu(!showBuildMenu);
                  if (showBuildMenu) {
                    setMode('view');
                  }
                }}
              >
                <Text style={[
                  styles.controlButtonText, 
                  (mode.startsWith('add-') || showBuildMenu) && styles.controlButtonTextActive
                ]}>
                  🏗️ Build {showBuildMenu ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>
              
              {showBuildMenu && (
                <View style={styles.buildMenu}>
                  <TouchableOpacity
                    style={[styles.buildMenuItem, mode === 'add-building' && styles.buildMenuItemActive]}
                    onPress={() => {
                      setMode(mode === 'add-building' ? 'view' : 'add-building');
                      setShowBuildMenu(false);
                      if (mode !== 'add-building') setShowMarkers(true);
                    }}
                  >
                    <Text style={[styles.buildMenuText, mode === 'add-building' && styles.buildMenuTextActive]}>
                      🏢 Building
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.buildMenuItem, mode === 'add-tree' && styles.buildMenuItemActive]}
                    onPress={() => {
                      setMode(mode === 'add-tree' ? 'view' : 'add-tree');
                      setShowBuildMenu(false);
                      if (mode !== 'add-tree') setShowMarkers(true);
                    }}
                  >
                    <Text style={[styles.buildMenuText, mode === 'add-tree' && styles.buildMenuTextActive]}>
                      🌳 Tree
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.buildMenuItem, mode === 'add-canal' && styles.buildMenuItemActive]}
                    onPress={() => {
                      setMode(mode === 'add-canal' ? 'view' : 'add-canal');
                      setShowBuildMenu(false);
                      if (mode !== 'add-canal') setShowMarkers(true);
                    }}
                  >
                    <Text style={[styles.buildMenuText, mode === 'add-canal' && styles.buildMenuTextActive]}>
                      🚣 Canal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.buildMenuItem, styles.buildMenuItemLast, mode === 'add-street' && styles.buildMenuItemActive]}
                    onPress={() => {
                      setMode(mode === 'add-street' ? 'view' : 'add-street');
                      setShowBuildMenu(false);
                      if (mode !== 'add-street') setShowMarkers(true);
                    }}
                  >
                    <Text style={[styles.buildMenuText, mode === 'add-street' && styles.buildMenuTextActive]}>
                      🛣️ Street
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            {/* Unified Remove Button */}
            <TouchableOpacity
              style={[styles.controlButton, styles.removeButton, mode === 'remove' && styles.controlButtonActive]}
              onPress={() => {
                setMode(mode === 'remove' ? 'view' : 'remove');
                setShowBuildMenu(false);
                if (mode !== 'remove') setShowMarkers(true);
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
                setRemovedTrees([]);
                setRemovedCanals([]);
                setRemovedStreets([]);
                setMode('view');
                setShowBuildMenu(false);
                setShowMarkers(false);
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
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.weatherScrollContainer}
            style={styles.weatherScrollView}
          >
            <StatCard
              icon="🌡️"
              label="Temperature"
              value={`${currentWeather.temperature.toFixed(1)}°C`}
              change={impact?.temp}
              baseValue={baseWeather?.temperature}
            />
            <StatCard
              icon="💨"
              label="Wind Speed"
              value={`${currentWeather.windSpeed.toFixed(1)} km/h`}
              change={impact?.wind}
              baseValue={baseWeather?.windSpeed}
            />
            <StatCard
              icon="💧"
              label="Humidity"
              value={`${currentWeather.humidity.toFixed(1)}%`}
              change={impact?.humidity}
              baseValue={baseWeather?.humidity}
            />
            <StatCard
              icon="🌍"
              label="CO₂"
              value={`${currentWeather.co2.toFixed(1)} ppm`}
              change={impact?.co2}
              baseValue={baseWeather?.co2}
            />
          </ScrollView>
        </View>

        {/* Kepler.gl 3D Visualization Modal */}
        <KeplerGLView
          visible={showKepler}
          onClose={() => setShowKepler(false)}
          existingBuildings={existingBuildings}
          existingTrees={existingTrees}
          existingCanals={existingCanals}
          existingStreets={existingStreets}
          userBuildings={userBuildings}
          removedBuildings={removedBuildings}
          removedTrees={removedTrees}
          removedCanals={removedCanals}
          removedStreets={removedStreets}
          location={location}
        />
      </LinearGradient>
    </View>
  );
}

function StatCard({ icon, label, value, change, baseValue }) {
  const changeValue = parseFloat(change || 0);
  const isPositive = changeValue > 0;
  const isNegative = changeValue < 0;
  const hasChange = changeValue !== 0;

  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hasChange ? (
        <View style={styles.changeContainer}>
          <Text style={[
            styles.statChange,
            isPositive && styles.statChangePositive,
            isNegative && styles.statChangeNegative,
          ]}>
            {isPositive ? '↑' : '↓'} {Math.abs(changeValue).toFixed(1)}
          </Text>
          {baseValue && (
            <Text style={styles.baseValue}>
              Base: {baseValue.toFixed(1)}
            </Text>
          )}
        </View>
      ) : (
        <Text style={styles.noChange}>No change</Text>
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
  keplerButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.9)', // Purple for 3D view
  },
  buildButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)', // Green for build
  },
  removeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)', // Red for remove
  },
  buildButtonContainer: {
    position: 'relative',
  },
  buildMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: theme.borderRadius.md,
    minWidth: 140,
    ...theme.shadows.lg,
    zIndex: 1000,
    overflow: 'hidden',
  },
  buildMenuItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  buildMenuItemLast: {
    borderBottomWidth: 0,
  },
  buildMenuItemActive: {
    backgroundColor: theme.colors.primary,
  },
  buildMenuText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  buildMenuTextActive: {
    color: '#FFF',
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
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 50 : 40,
    maxHeight: height * 0.25,
  },
  statsHeader: {
    marginBottom: theme.spacing.sm,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  weatherScrollView: {
    marginBottom: theme.spacing.sm,
  },
  weatherScrollContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    width: 140,
    marginRight: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
    minHeight: 120,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  changeContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  statChange: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  statChangePositive: {
    color: theme.colors.error,
  },
  statChangeNegative: {
    color: theme.colors.success,
  },
  baseValue: {
    fontSize: 9,
    color: theme.colors.textSecondary,
    opacity: 0.7,
  },
  noChange: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
