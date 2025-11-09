import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, Alert, Dimensions, ScrollView, Image, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polygon, Circle, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { theme } from '../theme';
import { getCopernicusWeatherData, calculateWeatherImpact } from '../src/services/copernicusService';
import { fetchBuildingsSimple, fetchTreesFromOSM, fetchCanalsFromOSM, fetchStreetsFromOSM } from '../src/services/openStreetMapService';
import { calculateSentinelPassTimes, formatTimeSince } from '../src/services/satelliteService';
import OpenStreetMapTile from '../components/OpenStreetMapTile';
import KeplerGLView from '../components/KeplerGLView';

const { width, height } = Dimensions.get('window');

// Pre-load icons at module level for better performance
const LIFE_ICON = require('../assets/life.png');
const SOCIAL_ICON = require('../assets/social.png');
const ENERGY_ICON = require('../assets/energy.png');
const FIRE_ICON = require('../assets/fire.png');
const WIND_ICON = require('../assets/wind.png');
const WATER_ICON = require('../assets/water.png');
const EARTH_ICON = require('../assets/earth.png');
const SATELLITE_ICON = require('../assets/satellite.png');

export default function WeatherGameScreen({ onBackToLanding }) {
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
  const [mapRegion, setMapRegion] = useState(null); // Current map region for 3D view
  const [currentMapRegion, setCurrentMapRegion] = useState(null); // Track current map region
  const [infoModalVisible, setInfoModalVisible] = useState(false); // Info modal visibility
  const [selectedStat, setSelectedStat] = useState(null); // Selected stat for info modal
  const [rankModalVisible, setRankModalVisible] = useState(false); // Rank modal visibility
  const mapRef = useRef(null);
  
  // Game mechanics state
  const SENTINEL_ORBIT_TIME = 100 * 60; // 100 minutes in seconds (Sentinel orbit time)
  const [satelliteTimeRemaining, setSatelliteTimeRemaining] = useState(SENTINEL_ORBIT_TIME); // Time until next Sentinel pass
  const [timeSinceLastPass, setTimeSinceLastPass] = useState(0); // Time since last Sentinel pass
  const [gameIteration, setGameIteration] = useState(0); // Current game iteration
  const [tokenCharges, setTokenCharges] = useState({
    life: 13,     // Trees planted (mockup: 22% of 60 = 13.2 ≈ 13)
    social: 39,   // Buildings added/removed (mockup: 55% of 70 = 38.5 ≈ 39)
    energy: 6,    // Streets built (mockup: 12% of 50 = 6)
  });

  // Rank requirements for calculating percentages
  const kiezGuardianRequirements = {
    life: 60,
    social: 70,
    energy: 50,
  };

  // Calculate percentage for token charges
  const getTokenPercentage = (tokenType, currentValue) => {
    const required = kiezGuardianRequirements[tokenType];
    return Math.min(100, Math.round((currentValue / required) * 100));
  };

  useEffect(() => {
    initializeLocation();
  }, []);

  useEffect(() => {
    if (baseWeather) {
      updateWeatherWithModifications();
    }
  }, [userBuildings, removedBuildings, baseWeather]);

  // Calculate actual Sentinel pass times when location is available
  useEffect(() => {
    if (location) {
      const passTimes = calculateSentinelPassTimes(location.latitude, location.longitude);
      setSatelliteTimeRemaining(passTimes.timeUntilNextPass);
      setTimeSinceLastPass(passTimes.timeSinceLastPass);
    }
  }, [location]);

  // Satellite orbit timer - update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSatelliteTimeRemaining((prev) => {
        if (prev <= 1) {
          // Sentinel completed orbit - advance game iteration
          setGameIteration((prevIter) => prevIter + 1);
          // Evaluate rank at end of iteration
          evaluateRank();
          // Recalculate pass times
          if (location) {
            const passTimes = calculateSentinelPassTimes(location.latitude, location.longitude);
            setTimeSinceLastPass(0);
            return passTimes.timeUntilNextPass;
          }
          return SENTINEL_ORBIT_TIME;
        }
        return prev - 1;
      });
      
      // Update time since last pass
      setTimeSinceLastPass((prev) => prev + 1);
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, [location, tokenCharges]);

  // Update token charges based on actions
  useEffect(() => {
    const treesCount = userBuildings.filter(b => b.type === 'tree').length;
    const buildingsCount = userBuildings.filter(b => b.type === 'building').length;
    const streetsCount = userBuildings.filter(b => b.type === 'street').length;
    
    // Base mockup values (starting from previous iterations)
    const BASE_LIFE = 13;     // 22% of 60
    const BASE_SOCIAL = 39;   // 56% of 70 (closest to 55%)
    const BASE_ENERGY = 6;    // 12% of 50
    
    // Life token: based on trees planted, add to base (max 100)
    const lifeCharge = Math.min(100, BASE_LIFE + (treesCount * 10));
    
    // Social token: based on buildings (added increases, removed decreases)
    // Start from base, +5 per building added, -5 per building removed
    const socialCharge = Math.max(0, Math.min(100, BASE_SOCIAL + (buildingsCount * 5) - (removedBuildings.length * 5)));
    
    // Energy token: based on streets built, add to base (max 100)
    const energyCharge = Math.min(100, BASE_ENERGY + (streetsCount * 12));
    
    setTokenCharges({
      life: lifeCharge,
      social: socialCharge,
      energy: energyCharge,
    });
  }, [userBuildings, removedBuildings]);

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
      // Unified remove mode - finds and removes the nearest item of any type
      const allItems = [];
      
      // Add buildings (with null checks)
      if (Array.isArray(existingBuildings) && Array.isArray(removedBuildings)) {
        existingBuildings
          .filter(b => b && b.id && b.coordinate && !removedBuildings.some(rb => rb && rb.id === b.id))
          .forEach(b => {
            if (b && b.coordinate) {
              allItems.push({ ...b, itemType: 'building', isUserAdded: false });
            }
          });
      }
      
      // Add trees (with null checks)
      if (Array.isArray(existingTrees) && Array.isArray(removedTrees)) {
        existingTrees
          .filter(t => t && t.id && t.coordinate && !removedTrees.some(rt => rt && rt.id === t.id))
          .forEach(t => {
            if (t && t.coordinate) {
              allItems.push({ ...t, itemType: 'tree', isUserAdded: false });
            }
          });
      }
      
      if (Array.isArray(userBuildings)) {
        userBuildings
          .filter(b => b && b.type === 'tree' && b.coordinate)
          .forEach(t => {
            if (t && t.coordinate) {
              allItems.push({ ...t, itemType: 'tree', isUserAdded: true });
            }
          });
      }
      
      // Add canals (with null checks)
      if (Array.isArray(existingCanals) && Array.isArray(removedCanals)) {
        existingCanals
          .filter(c => c && c.id && c.coordinates && !removedCanals.some(rc => rc && rc.id === c.id))
          .forEach(c => {
            if (c && c.coordinates) {
              allItems.push({ ...c, itemType: 'canal', isUserAdded: false });
            }
          });
      }
      
      if (Array.isArray(userBuildings)) {
        userBuildings
          .filter(b => b && b.type === 'canal' && b.coordinates)
          .forEach(c => {
            if (c && c.coordinates) {
              allItems.push({ ...c, itemType: 'canal', isUserAdded: true });
            }
          });
      }
      
      // Add streets (with null checks)
      if (Array.isArray(existingStreets) && Array.isArray(removedStreets)) {
        existingStreets
          .filter(s => s && s.id && s.coordinates && !removedStreets.some(rs => rs && rs.id === s.id))
          .forEach(s => {
            if (s && s.coordinates) {
              allItems.push({ ...s, itemType: 'street', isUserAdded: false });
            }
          });
      }
      
      if (Array.isArray(userBuildings)) {
        userBuildings
          .filter(b => b && b.type === 'street' && b.coordinates)
          .forEach(s => {
            if (s && s.coordinates) {
              allItems.push({ ...s, itemType: 'street', isUserAdded: true });
            }
          });
      }
      
      if (allItems.length === 0) {
        Alert.alert('No Items', 'No items to remove in this area.');
        return;
      }

      // Find nearest item (with safety checks)
      const nearestItem = allItems.reduce((nearest, item) => {
        if (!item) return nearest;
        
        let itemCoord = null;
        let minDist = Infinity;
        
        try {
          if (item.coordinate && item.coordinate.latitude !== undefined && item.coordinate.longitude !== undefined) {
            itemCoord = item.coordinate;
          } else if (item.coordinates && Array.isArray(item.coordinates) && item.coordinates.length > 0) {
            // For lines (canals/streets), find closest point on line
            item.coordinates.forEach(coord => {
              if (coord && coord.latitude !== undefined && coord.longitude !== undefined) {
                const dist = Math.sqrt(
                  Math.pow(coord.latitude - coordinate.latitude, 2) +
                  Math.pow(coord.longitude - coordinate.longitude, 2)
                );
                if (dist < minDist) {
                  minDist = dist;
                  itemCoord = coord;
                }
              }
            });
          }
          
          if (!itemCoord || itemCoord.latitude === undefined || itemCoord.longitude === undefined) {
            return nearest;
          }
          
          const dist = Math.sqrt(
            Math.pow(itemCoord.latitude - coordinate.latitude, 2) +
            Math.pow(itemCoord.longitude - coordinate.longitude, 2)
          );
          
          const nearestDist = nearest ? (() => {
            const nearestCoord = nearest.coordinate || (nearest.coordinates && Array.isArray(nearest.coordinates) && nearest.coordinates[0]);
            if (!nearestCoord || nearestCoord.latitude === undefined || nearestCoord.longitude === undefined) {
              return Infinity;
            }
            return Math.sqrt(
              Math.pow(nearestCoord.latitude - coordinate.latitude, 2) +
              Math.pow(nearestCoord.longitude - coordinate.longitude, 2)
            );
          })() : Infinity;
          
          return dist < nearestDist ? { ...item, itemCoord, dist } : nearest;
        } catch (error) {
          console.error('Error calculating distance:', error);
          return nearest;
        }
      }, null);

      if (nearestItem && nearestItem.id) {
        try {
          if (nearestItem.isUserAdded) {
            // Remove user-added item
            if (Array.isArray(userBuildings)) {
              setUserBuildings(userBuildings.filter(b => b && b.id !== nearestItem.id));
            }
          } else {
            // Remove OSM item - ensure we have the correct item structure
            const itemType = nearestItem.itemType;
            if (itemType === 'building' && nearestItem.coordinate) {
              if (Array.isArray(removedBuildings)) {
                setRemovedBuildings([...removedBuildings, nearestItem]);
              }
            } else if (itemType === 'tree' && nearestItem.coordinate) {
              // Ensure tree has the correct structure
              const treeToRemove = {
                id: nearestItem.id,
                coordinate: nearestItem.coordinate,
                name: nearestItem.name || null,
                type: 'tree',
              };
              if (Array.isArray(removedTrees)) {
                setRemovedTrees([...removedTrees, treeToRemove]);
              }
            } else if (itemType === 'canal' && nearestItem.coordinates) {
              if (Array.isArray(removedCanals)) {
                setRemovedCanals([...removedCanals, nearestItem]);
              }
            } else if (itemType === 'street' && nearestItem.coordinates) {
              if (Array.isArray(removedStreets)) {
                setRemovedStreets([...removedStreets, nearestItem]);
              }
            }
          }
        } catch (error) {
          console.error('Error removing item:', error);
          Alert.alert('Error', 'Failed to remove item. Please try again.');
        }
      }
    }
  };

  const handleMarkerPress = (item) => {
    if (!item || !item.id) {
      console.warn('Invalid item in handleMarkerPress');
      return;
    }

    try {
      if (mode === 'remove') {
        // Check if it's a user-added item
        if (item.isUserAdded) {
          // Remove user-added item
          if (Array.isArray(userBuildings)) {
            setUserBuildings(userBuildings.filter(b => b && b.id !== item.id));
          }
        } else {
          // Remove OSM item - determine type (with null checks)
          const isTree = Array.isArray(existingTrees) && existingTrees.some(t => t && t.id === item.id);
          const isBuilding = Array.isArray(existingBuildings) && existingBuildings.some(b => b && b.id === item.id);
          const isCanal = Array.isArray(existingCanals) && existingCanals.some(c => c && c.id === item.id);
          const isStreet = Array.isArray(existingStreets) && existingStreets.some(s => s && s.id === item.id);
          
          if (isTree && item.coordinate && Array.isArray(removedTrees) && !removedTrees.some(rt => rt && rt.id === item.id)) {
            setRemovedTrees([...removedTrees, {
              id: item.id,
              coordinate: item.coordinate,
              name: item.name || null,
              type: 'tree',
            }]);
          } else if (isBuilding && Array.isArray(removedBuildings) && !removedBuildings.some(rb => rb && rb.id === item.id)) {
            setRemovedBuildings([...removedBuildings, item]);
          } else if (isCanal && Array.isArray(removedCanals) && !removedCanals.some(rc => rc && rc.id === item.id)) {
            setRemovedCanals([...removedCanals, item]);
          } else if (isStreet && Array.isArray(removedStreets) && !removedStreets.some(rs => rs && rs.id === item.id)) {
            setRemovedStreets([...removedStreets, item]);
          }
        }
      } else if (item.isUserAdded) {
        // Remove user-added building/tree/canal/street (works in any mode)
        if (Array.isArray(userBuildings)) {
          setUserBuildings(userBuildings.filter(b => b && b.id !== item.id));
        }
      }
    } catch (error) {
      console.error('Error in handleMarkerPress:', error);
      Alert.alert('Error', 'Failed to process marker. Please try again.');
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
    // Match landing page color scheme: dark blue to dark purple gradient
    return ['#1a1a2e', '#16213e', '#0f3460', '#533483'];
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

  // Evaluate rank at end of sentinel iteration
  const evaluateRank = () => {
    // Rank requirements
    // Check if player meets requirements for Kiez Guardian
    const meetsRequirements = 
      tokenCharges.life >= kiezGuardianRequirements.life &&
      tokenCharges.social >= kiezGuardianRequirements.social &&
      tokenCharges.energy >= kiezGuardianRequirements.energy;

    if (meetsRequirements) {
      // Player has leveled up to Kiez Guardian
      Alert.alert(
        '🎉 Level Up!',
        'Congratulations! You have achieved the rank: Kiez Guardian',
        [{ text: 'OK' }]
      );
    }
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
        <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']} style={styles.gradient}>
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
            initialRegion={location ? {
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            } : {
              latitude: 52.52,
              longitude: 13.405,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            pitchEnabled={true}
            rotateEnabled={true}
            showsUserLocation={true}
            showsMyLocationButton={false}
            onPress={handleMapPress}
            mapType="none"
            onRegionChangeComplete={(region) => {
              setCurrentMapRegion(region);
            }}
          >
            {/* OpenStreetMap Tile Layer */}
            <OpenStreetMapTile />
            
            {/* Always show canals on the map */}
            {/* Existing canals from OSM (not removed) */}
            {Array.isArray(existingCanals) && Array.isArray(removedCanals) && existingCanals
              .filter(canal => canal && canal.id && canal.coordinates && !removedCanals.some(rc => rc && rc.id === canal.id))
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
            {Array.isArray(userBuildings) && userBuildings
              .filter(b => b && b.type === 'canal' && b.coordinates)
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
            {Array.isArray(removedCanals) && removedCanals
              .filter(canal => canal && canal.coordinates)
              .map((canal) => (
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
            {Array.isArray(existingStreets) && Array.isArray(removedStreets) && existingStreets
              .filter(street => street && street.id && street.coordinates && !removedStreets.some(rs => rs && rs.id === street.id))
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
            {Array.isArray(userBuildings) && userBuildings
              .filter(b => b && b.type === 'street' && b.coordinates)
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
            {Array.isArray(removedStreets) && removedStreets
              .filter(street => street && street.coordinates)
              .map((street) => (
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
                {/* Existing trees from OSM - Show with life token icons */}
                {Array.isArray(existingTrees) && Array.isArray(removedTrees) && existingTrees
                  .filter(tree => tree && tree.id && tree.coordinate && !removedTrees.some(rt => rt && rt.id === tree.id))
                  .map((tree) => (
                    <Marker
                      key={tree.id}
                      coordinate={tree.coordinate}
                      title={tree.name || 'Tree'}
                      description={mode === 'remove' ? 'Tap to remove' : 'Existing tree'}
                      onPress={() => handleMarkerPress(tree)}
                    >
                      <View style={[styles.markerContainer, styles.treeMarker]}>
                        <Image 
                          source={LIFE_ICON} 
                          style={styles.treeTokenIcon}
                          resizeMode="contain"
                        />
                      </View>
                    </Marker>
                  ))}

                {/* Existing buildings from OSM - Markers */}
                {Array.isArray(existingBuildings) && Array.isArray(removedBuildings) && existingBuildings
                  .filter(building => building && building.id && building.coordinate && !removedBuildings.some(rb => rb && rb.id === building.id))
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
                {Array.isArray(removedBuildings) && removedBuildings
                  .filter(building => building && building.coordinate)
                  .map((building) => (
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
                {Array.isArray(userBuildings) && userBuildings
                  .filter(building => building && building.id && (building.coordinate || building.coordinates))
                  .map((building) => (
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
              onPress={() => {
                // Always ensure map region is set before opening 3D view
                // Use current map region if available (most accurate)
                if (currentMapRegion) {
                  setMapRegion(currentMapRegion);
                  setShowKepler(true);
                } else if (mapRef.current) {
                  // Try to get camera position from map
                  mapRef.current.getCamera().then((camera) => {
                    const region = {
                      latitude: camera.center.latitude,
                      longitude: camera.center.longitude,
                      // Calculate delta from altitude (more accurate, ensure closer zoom)
                      latitudeDelta: Math.max(0.002, Math.min(0.02, camera.altitude / 111000 * 2)),
                      longitudeDelta: Math.max(0.002, Math.min(0.02, camera.altitude / 111000 * 2)),
                    };
                    setMapRegion(region);
                    setShowKepler(true);
                  }).catch(() => {
                    // Fallback: use current location with close zoom
                    if (location) {
                      setMapRegion({
                        latitude: location.latitude,
                        longitude: location.longitude,
                        latitudeDelta: 0.005, // Closer zoom
                        longitudeDelta: 0.005,
                      });
                    }
                    setShowKepler(true);
                  });
                } else if (location) {
                  // Fallback: use current location with close zoom
                  setMapRegion({
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.005, // Closer zoom
                    longitudeDelta: 0.005,
                  });
                  setShowKepler(true);
                } else {
                  setShowKepler(true);
                }
              }}
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
                try {
                  // Reset all user modifications
                  setUserBuildings([]);
                  setRemovedBuildings([]);
                  setRemovedTrees([]);
                  setRemovedCanals([]);
                  setRemovedStreets([]);
                  
                  // Reset UI state
                  setMode('view');
                  setShowBuildMenu(false);
                  setShowMarkers(false);
                  
                  // Reset game state with safety checks
                  try {
                    if (location && location.latitude !== undefined && location.longitude !== undefined) {
                      const passTimes = calculateSentinelPassTimes(location.latitude, location.longitude);
                      if (passTimes && passTimes.timeUntilNextPass !== undefined) {
                        setSatelliteTimeRemaining(passTimes.timeUntilNextPass);
                      } else {
                        setSatelliteTimeRemaining(SENTINEL_ORBIT_TIME);
                      }
                      if (passTimes && passTimes.timeSinceLastPass !== undefined) {
                        setTimeSinceLastPass(passTimes.timeSinceLastPass);
                      } else {
                        setTimeSinceLastPass(0);
                      }
                    } else {
                      setSatelliteTimeRemaining(SENTINEL_ORBIT_TIME);
                      setTimeSinceLastPass(0);
                    }
                  } catch (error) {
                    console.error('Error resetting satellite timer:', error);
                    setSatelliteTimeRemaining(SENTINEL_ORBIT_TIME);
                    setTimeSinceLastPass(0);
                  }
                  
                  setGameIteration(0);
                setTokenCharges({
                  life: 13,     // Trees planted (mockup: 22% of 60 = 13.2 ≈ 13)
                  social: 39,   // Buildings added/removed (mockup: 55% of 70 = 38.5 ≈ 39)
                  energy: 6,    // Streets built (mockup: 12% of 50 = 6)
                });
                } catch (error) {
                  console.error('Error in reset handler:', error);
                  Alert.alert('Error', 'Failed to reset map. Please try again.');
                }
              }}
            >
              <Text style={styles.controlButtonText}>🔄 Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Weather Stats Panel */}
        <View style={styles.statsPanel}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.weatherScrollContainer}
            style={styles.weatherScrollView}
          >
            <StatCard
              iconSource={FIRE_ICON}
              label="Temperature"
              value={`${currentWeather.temperature.toFixed(1)}°C`}
              change={impact?.temp}
              baseValue={baseWeather?.temperature}
              onPress={() => {
                setSelectedStat('temperature');
                setInfoModalVisible(true);
              }}
            />
            <StatCard
              iconSource={WIND_ICON}
              label="Wind Speed"
              value={`${currentWeather.windSpeed.toFixed(1)} km/h`}
              change={impact?.wind}
              baseValue={baseWeather?.windSpeed}
              onPress={() => {
                setSelectedStat('wind');
                setInfoModalVisible(true);
              }}
            />
            <StatCard
              iconSource={WATER_ICON}
              label="Humidity"
              value={`${currentWeather.humidity.toFixed(1)}%`}
              change={impact?.humidity}
              baseValue={baseWeather?.humidity}
              onPress={() => {
                setSelectedStat('humidity');
                setInfoModalVisible(true);
              }}
            />
            <StatCard
              iconSource={EARTH_ICON}
              label="CO₂"
              value={`${currentWeather.co2.toFixed(1)} ppm`}
              change={impact?.co2}
              baseValue={baseWeather?.co2}
              onPress={() => {
                setSelectedStat('co2');
                setInfoModalVisible(true);
              }}
            />
          </ScrollView>
        </View>

        {/* Sentinel Pass Timer - Upper Left Corner (Compact) */}
        <View style={styles.sentinelPassCompact}>
          <Image 
            source={SATELLITE_ICON} 
            style={styles.sentinelIconCompact}
            resizeMode="contain"
          />
          <View style={styles.sentinelInfoCompact}>
            <Text style={styles.sentinelLabelCompact}>Sentinel</Text>
            <Text style={styles.sentinelTimerCompact}>
              {Math.floor(satelliteTimeRemaining / 60)}:{(satelliteTimeRemaining % 60).toString().padStart(2, '0')}
            </Text>
            <Text style={styles.sentinelTimeSinceCompact}>
              {formatTimeSince(timeSinceLastPass)}
            </Text>
          </View>
        </View>

        {/* Target Button - Under Sentinel */}
        <TouchableOpacity
          style={styles.targetButton}
          onPress={() => setRankModalVisible(true)}
        >
          <Text style={styles.targetButtonText}>Target: Kiez Guardian</Text>
        </TouchableOpacity>

        {/* Token Charge Bars - At bottom */}
        <View style={styles.tokensPanel}>
          <View style={styles.tokensContainer}>
            <TokenBar 
              icon={LIFE_ICON}
              label="Life"
              charge={getTokenPercentage('life', tokenCharges.life)}
              color="#22c55e"
            />
            <TokenBar 
              icon={SOCIAL_ICON}
              label="Social"
              charge={getTokenPercentage('social', tokenCharges.social)}
              color="#3b82f6"
            />
            <TokenBar 
              icon={ENERGY_ICON}
              label="Energy"
              charge={getTokenPercentage('energy', tokenCharges.energy)}
              color="#f59e0b"
            />
          </View>
        </View>

        {/* Back to Landing Button - Lower Left Corner */}
        {onBackToLanding && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackToLanding}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}

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
          weatherData={currentWeather}
          mapRegion={mapRegion}
        />

        {/* Environmental Info Modal */}
        <InfoModal
          visible={infoModalVisible}
          statType={selectedStat}
          onClose={() => {
            setInfoModalVisible(false);
            setSelectedStat(null);
          }}
          change={impact}
        />

        {/* Rank Modal */}
        <RankModal
          visible={rankModalVisible}
          tokenCharges={tokenCharges}
          onClose={() => setRankModalVisible(false)}
        />
      </LinearGradient>
    </View>
  );
}

function StatCard({ iconSource, label, value, change, baseValue, onPress }) {
  const changeValue = parseFloat(change || 0);
  const isPositive = changeValue > 0;
  const isNegative = changeValue < 0;
  const hasChange = changeValue !== 0;

  return (
    <TouchableOpacity 
      style={styles.statCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {iconSource ? (
        <Image 
          source={iconSource} 
          style={styles.statIconImage}
          resizeMode="contain"
        />
      ) : null}
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
      <Text style={styles.infoHint}>Tap for info</Text>
    </TouchableOpacity>
  );
}

function TokenBar({ icon, label, charge, color }) {
  return (
    <View style={styles.tokenBar}>
      <Image source={icon} style={styles.tokenIcon} resizeMode="contain" />
      <View style={styles.tokenInfo}>
        <Text style={styles.tokenLabel}>{label}</Text>
        <View style={styles.tokenChargeContainer}>
          <View 
            style={[
              styles.tokenChargeBar, 
              { width: `${charge}%`, backgroundColor: color }
            ]} 
          />
        </View>
        <Text style={styles.tokenChargeText}>{charge}%</Text>
      </View>
    </View>
  );
}

function RankModal({ visible, tokenCharges, onClose }) {
  // Rank requirements for Kiez Guardian
  const kiezGuardianRequirements = {
    life: 60,
    social: 70,
    energy: 50,
  };

  // Current rank is always Good Neighbor (until they level up)
  const currentRank = 'Good Neighbor';
  const targetRank = 'Kiez Guardian';

  // Calculate percentage to level up for each charge
  const getLevelUpPercentage = (tokenType, required) => {
    const current = tokenCharges[tokenType];
    return Math.min(100, Math.round((current / required) * 100));
  };

  // Use mockup percentages for display
  const lifePercentage = 22;
  const socialPercentage = 55;
  const energyPercentage = 12;

  // Use pre-loaded icons from module level
  const lifeIcon = LIFE_ICON;
  const socialIcon = SOCIAL_ICON;
  const energyIcon = ENERGY_ICON;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
            style={styles.modalGradient}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Game Target</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={onClose}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Current Rank */}
            <View style={styles.rankSection}>
              <Text style={styles.rankSectionTitle}>You are:</Text>
              <View style={styles.currentRankCard}>
                <Text style={styles.currentRankName}>{currentRank}</Text>
              </View>
            </View>

            {/* Target Rank */}
            <View style={styles.rankSection}>
              <Text style={styles.rankSectionTitle}>Become:</Text>
              <View style={styles.targetRankCard}>
                <Text style={styles.targetRankName}>{targetRank}</Text>
              </View>
            </View>

            {/* Charge Up Goals */}
            <View style={styles.rankSection}>
              <View style={styles.chargeUpIconsContainer}>
                {/* Life Icon */}
                <View style={styles.chargeUpIconItem}>
                  <Image 
                    source={lifeIcon} 
                    style={styles.chargeUpIconLarge}
                    resizeMode="contain"
                  />
                  <Text style={styles.chargeUpGoalText}>Aiming for</Text>
                  <Text style={styles.chargeUpIconPercentage}>{lifePercentage}%</Text>
                </View>

                {/* Social Icon */}
                <View style={styles.chargeUpIconItem}>
                  <Image 
                    source={socialIcon} 
                    style={styles.chargeUpIconLarge}
                    resizeMode="contain"
                  />
                  <Text style={styles.chargeUpGoalText}>Aiming for</Text>
                  <Text style={styles.chargeUpIconPercentage}>{socialPercentage}%</Text>
                </View>

                {/* Energy Icon */}
                <View style={styles.chargeUpIconItem}>
                  <Image 
                    source={energyIcon} 
                    style={styles.chargeUpIconLarge}
                    resizeMode="contain"
                  />
                  <Text style={styles.chargeUpGoalText}>Aiming for</Text>
                  <Text style={styles.chargeUpIconPercentage}>{energyPercentage}%</Text>
                </View>
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={onClose}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

function InfoModal({ visible, statType, onClose, change }) {
  const getStatInfo = () => {
    if (!statType) return null;
    
    let changeKey = '';
    if (statType === 'temperature') changeKey = 'temp';
    else if (statType === 'wind') changeKey = 'wind';
    else if (statType === 'humidity') changeKey = 'humidity';
    else if (statType === 'co2') changeKey = 'co2';
    
    const changeValue = change && change[changeKey] ? parseFloat(change[changeKey]) : 0;
    const isPositive = changeValue > 0;
    const isNegative = changeValue < 0;

    switch (statType) {
      case 'temperature':
        return {
          title: 'Temperature Impact',
          icon: FIRE_ICON,
          description: 'Urban development significantly affects local temperature through the Urban Heat Island (UHI) effect.',
          impacts: [
            {
              action: '🏢 Buildings Added',
              effect: 'Increases temperature',
              explanation: 'Concrete and asphalt absorb and retain heat, creating "heat islands" that can be 1-3°C warmer than surrounding rural areas. Buildings block cooling winds and reduce natural ventilation.',
            },
            {
              action: '🌳 Trees Planted',
              effect: 'Decreases temperature',
              explanation: 'Trees provide shade and release water vapor through transpiration, cooling the air. Urban forests can reduce temperatures by 2-8°C in their immediate vicinity.',
            },
            {
              action: '🛣️ Streets Built',
              effect: 'Increases temperature',
              explanation: 'Asphalt roads absorb up to 95% of solar radiation, heating up during the day and releasing heat at night, contributing to elevated nighttime temperatures.',
            },
          ],
          changeValue,
          isPositive,
          isNegative,
        };
      case 'wind':
        return {
          title: 'Wind Speed Impact',
          icon: WIND_ICON,
          description: 'Urban structures alter wind patterns by creating obstacles and channeling airflow.',
          impacts: [
            {
              action: '🏢 Buildings Added',
              effect: 'Decreases wind speed',
              explanation: 'Buildings act as barriers, disrupting wind flow and creating turbulence. Tall structures can reduce wind speeds by 20-40% in their immediate area, affecting natural ventilation.',
            },
            {
              action: '🌳 Trees Planted',
              effect: 'Decreases wind speed',
              explanation: 'Trees create drag and slow down wind currents. While this reduces wind speed, it also helps protect areas from strong gusts and creates more stable microclimates.',
            },
            {
              action: '🛣️ Streets Built',
              effect: 'Can channel or block wind',
              explanation: 'Street canyons (narrow streets between tall buildings) can either channel wind, increasing speed, or create wind shadows that reduce airflow, depending on orientation.',
            },
          ],
          changeValue,
          isPositive,
          isNegative,
        };
      case 'humidity':
        return {
          title: 'Humidity Impact',
          icon: WATER_ICON,
          description: 'Human modifications to the landscape directly affect local moisture levels and atmospheric humidity.',
          impacts: [
            {
              action: '🏢 Buildings Added',
              effect: 'Decreases humidity',
              explanation: 'Impervious surfaces like concrete and asphalt prevent water from infiltrating the ground. This reduces evaporation and transpiration, leading to lower humidity levels in urban areas.',
            },
            {
              action: '🌳 Trees Planted',
              effect: 'Increases humidity',
              explanation: 'Trees release large amounts of water vapor through transpiration. A single mature tree can release hundreds of liters of water daily, significantly increasing local humidity and improving air quality.',
            },
            {
              action: '🚣 Canals Built',
              effect: 'Increases humidity',
              explanation: 'Water bodies increase evaporation rates, adding moisture to the air. Canals and waterways can raise local humidity by 5-15%, creating more comfortable microclimates.',
            },
          ],
          changeValue,
          isPositive,
          isNegative,
        };
      case 'co2':
        return {
          title: 'CO₂ Concentration Impact',
          icon: EARTH_ICON,
          description: 'Carbon dioxide levels are directly influenced by human activities and natural processes in urban environments.',
          impacts: [
            {
              action: '🏢 Buildings Added',
              effect: 'Increases CO₂',
              explanation: 'Buildings contribute to CO₂ through construction materials (cement production), energy consumption for heating/cooling, and reduced carbon sinks. Urban areas typically have 10-20% higher CO₂ concentrations.',
            },
            {
              action: '🌳 Trees Planted',
              effect: 'Decreases CO₂',
              explanation: 'Trees absorb CO₂ through photosynthesis, storing carbon in their biomass. A single mature tree can sequester 20-50 kg of CO₂ annually, making urban forests crucial for carbon capture.',
            },
            {
              action: '🛣️ Streets Built',
              effect: 'Increases CO₂',
              explanation: 'Roads increase vehicle traffic and associated emissions. Asphalt production also releases CO₂. More streets typically mean more transportation-related carbon emissions.',
            },
          ],
          changeValue,
          isPositive,
          isNegative,
        };
      default:
        return null;
    }
  };

  const info = getStatInfo();
  if (!info || !visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
            style={styles.modalGradient}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Image 
                source={info.icon} 
                style={styles.modalIcon}
                resizeMode="contain"
              />
              <Text style={styles.modalTitle}>{info.title}</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={onClose}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={true}
            >
              {/* Description */}
              <Text style={styles.modalDescription}>{info.description}</Text>

              {/* Current Change Indicator */}
              {(info.isPositive || info.isNegative) && (
                <View style={styles.changeIndicator}>
                  <Text style={styles.changeIndicatorLabel}>Current Change:</Text>
                  <Text style={[
                    styles.changeIndicatorValue,
                    info.isPositive && styles.changeIndicatorPositive,
                    info.isNegative && styles.changeIndicatorNegative,
                  ]}>
                    {info.isPositive ? '↑' : '↓'} {Math.abs(info.changeValue).toFixed(1)}
                  </Text>
                </View>
              )}

              {/* Impact List */}
              <View style={styles.impactsContainer}>
                <Text style={styles.impactsTitle}>How Your Actions Affect {info.title.split(' ')[0]}:</Text>
                {info.impacts.map((impact, index) => (
                  <View key={index} style={styles.impactItem}>
                    <View style={styles.impactHeader}>
                      <Text style={styles.impactAction}>{impact.action}</Text>
                      <Text style={[
                        styles.impactEffect,
                        impact.effect.includes('Increases') && styles.impactEffectPositive,
                        impact.effect.includes('Decreases') && styles.impactEffectNegative,
                      ]}>
                        {impact.effect}
                      </Text>
                    </View>
                    <Text style={styles.impactExplanation}>{impact.explanation}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={onClose}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
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
    backgroundColor: 'rgba(26, 26, 46, 0.9)', // Dark blue matching landing page
  },
  keplerButton: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)', // Dark blue matching landing page
  },
  buildButton: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)', // Dark blue matching landing page
  },
  removeButton: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)', // Dark blue matching landing page
  },
  buildButtonContainer: {
    position: 'relative',
  },
  buildMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    backgroundColor: 'rgba(26, 26, 46, 0.95)', // Dark blue matching landing page
    borderRadius: theme.borderRadius.md,
    minWidth: 140,
    ...theme.shadows.lg,
    zIndex: 1000,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(83, 52, 131, 0.5)', // Purple accent
  },
  buildMenuItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  buildMenuItemLast: {
    borderBottomWidth: 0,
  },
  buildMenuItemActive: {
    backgroundColor: 'rgba(83, 52, 131, 0.7)', // Purple matching landing page
  },
  buildMenuText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  buildMenuTextActive: {
    color: '#FFF',
  },
  controlButton: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)', // Dark blue matching landing page
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.md,
    borderWidth: 1,
    borderColor: 'rgba(83, 52, 131, 0.5)', // Purple accent
  },
  controlButtonActive: {
    backgroundColor: 'rgba(83, 52, 131, 0.9)', // Purple matching landing page
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  controlButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
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
  treeMarker: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    borderWidth: 1,
    borderColor: '#FFF',
    padding: 2,
  },
  treeTokenIcon: {
    width: 20,
    height: 20,
  },
  sentinelPassCompact: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: theme.spacing.md,
    backgroundColor: 'rgba(26, 26, 46, 0.9)', // Dark blue matching landing page
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.md,
    zIndex: 10,
    minWidth: 120,
    borderWidth: 1,
    borderColor: 'rgba(83, 52, 131, 0.5)', // Purple accent
  },
  targetButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 100, // Directly under Sentinel bar
    left: theme.spacing.md,
    backgroundColor: 'rgba(26, 26, 46, 0.9)', // Dark blue matching landing page
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    ...theme.shadows.md,
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(83, 52, 131, 0.5)', // Purple accent
    maxWidth: 120, // Align with Sentinel bar width
  },
  targetButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  backButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 40,
    left: theme.spacing.md,
    backgroundColor: 'rgba(26, 26, 46, 0.9)', // Dark blue matching landing page
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    ...theme.shadows.md,
    zIndex: 11,
    borderWidth: 1,
    borderColor: 'rgba(83, 52, 131, 0.5)', // Purple accent
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  sentinelIconCompact: {
    width: 24,
    height: 24,
    marginRight: theme.spacing.xs,
  },
  sentinelInfoCompact: {
    flex: 1,
  },
  sentinelLabelCompact: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 1,
    fontWeight: '600',
  },
  sentinelTimerCompact: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 1,
  },
  sentinelTimeSinceCompact: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.7)',
    opacity: 0.7,
  },
  tokensPanel: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 200 : 190,
    left: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: 'rgba(26, 26, 46, 0.95)', // Dark blue matching landing page
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.lg,
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(83, 52, 131, 0.5)', // Purple accent
  },
  tokensContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  tokenBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
  },
  tokenIcon: {
    width: 24,
    height: 24,
    marginRight: theme.spacing.xs,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    fontWeight: '600',
  },
  tokenChargeContainer: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  tokenChargeBar: {
    height: '100%',
    borderRadius: 3,
  },
  tokenChargeText: {
    fontSize: 9,
    color: '#FFF',
    fontWeight: '600',
  },
  statsPanel: {
    backgroundColor: 'rgba(26, 26, 46, 0.95)', // Dark blue matching landing page
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 50 : 40,
    maxHeight: height * 0.25,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(83, 52, 131, 0.5)', // Purple accent
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
    backgroundColor: 'rgba(22, 33, 62, 0.8)', // Darker blue matching landing page
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    width: 140,
    marginRight: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
    minHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(83, 52, 131, 0.3)', // Purple accent
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  statIconImage: {
    width: 32,
    height: 32,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
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
    color: 'rgba(255, 255, 255, 0.6)',
    opacity: 0.7,
  },
  noChange: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
    marginTop: 4,
  },
  infoHint: {
    fontSize: 8,
    color: 'rgba(83, 52, 131, 1)', // Purple accent
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Info Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.xl,
  },
  modalGradient: {
    padding: theme.spacing.lg,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalIcon: {
    width: 32,
    height: 32,
    marginRight: theme.spacing.sm,
    tintColor: '#FFF',
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: '700',
  },
  modalScrollView: {
    flex: 1,
    marginBottom: theme.spacing.md,
    minHeight: 200,
  },
  modalDescription: {
    fontSize: 14,
    color: '#FFF',
    lineHeight: 20,
    marginBottom: theme.spacing.md,
    opacity: 0.9,
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  changeIndicatorLabel: {
    fontSize: 12,
    color: '#FFF',
    marginRight: theme.spacing.sm,
    opacity: 0.8,
  },
  changeIndicatorValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  changeIndicatorPositive: {
    color: '#ef4444',
  },
  changeIndicatorNegative: {
    color: '#22c55e',
  },
  impactsContainer: {
    marginTop: theme.spacing.sm,
  },
  impactsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: theme.spacing.md,
  },
  impactItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  impactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  impactAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  impactEffect: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  impactEffectPositive: {
    color: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  impactEffectNegative: {
    color: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  impactExplanation: {
    fontSize: 12,
    color: '#FFF',
    lineHeight: 18,
    opacity: 0.85,
    marginTop: theme.spacing.xs,
  },
  modalButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  // Rank Modal Styles
  rankSection: {
    marginBottom: theme.spacing.lg,
  },
  rankSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: theme.spacing.sm,
  },
  currentRankCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  currentRankName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  targetRankCard: {
    backgroundColor: 'rgba(83, 52, 131, 0.3)', // Purple tint for target
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  targetRankName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  chargeUpGoalsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  currentRankLevel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: theme.spacing.xs,
  },
  currentRankDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
  },
  nextRankDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  requirementsContainer: {
    marginTop: theme.spacing.sm,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: theme.spacing.md,
  },
  requirementItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  requirementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  requirementIcon: {
    width: 20,
    height: 20,
    marginRight: theme.spacing.xs,
    tintColor: '#FFF',
  },
  requirementLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  requirementValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  requirementNeeded: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
  },
  maxRankContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  maxRankText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  chargeUpIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  chargeUpIconItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  chargeUpIconLarge: {
    width: 56,
    height: 56,
    marginBottom: theme.spacing.xs,
  },
  chargeUpGoalText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  chargeUpIconPercentage: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
});
