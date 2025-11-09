import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, Alert, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { theme } from '../theme';
import { getCopernicusWeatherData } from '../src/services/copernicusService';

const { width, height } = Dimensions.get('window');

export default function LandingScreen({ onEnter }) {
  const [loading, setLoading] = useState(true);
  const [currentWeather, setCurrentWeather] = useState({
    location: 'Loading...',
    temp: 0,
    condition: 'Loading',
    humidity: 0,
    windSpeed: 0,
    co2: 0,
    feelsLike: 0,
  });

  const [location, setLocation] = useState(null);

  useEffect(() => {
    loadWeatherData();
  }, []);

  const loadWeatherData = async () => {
    try {
      setLoading(true);
      
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show weather data.');
        // Use default location (Berlin) if permission denied
        await fetchWeatherData(52.52, 13.405);
        return;
      }

      // Get current location
      const locationData = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = locationData.coords;
      setLocation({ latitude, longitude });
      
      await fetchWeatherData(latitude, longitude);
    } catch (error) {
      console.error('Error loading weather data:', error);
      // Fallback to Berlin
      await fetchWeatherData(52.52, 13.405);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherData = async (latitude, longitude) => {
    try {
      setLoading(true);
      const weatherData = await getCopernicusWeatherData(latitude, longitude);
      
      // Get location name (simplified - in production, use reverse geocoding)
      const locationName = await getLocationName(latitude, longitude);
      
      // Determine condition based on weather data
      const condition = getWeatherCondition(weatherData);
      
      setCurrentWeather({
        location: locationName,
        temp: Math.round(weatherData.temperature),
        condition: condition,
        humidity: Math.round(weatherData.humidity),
        windSpeed: Math.round(weatherData.windSpeed),
        co2: Math.round(weatherData.co2),
        feelsLike: Math.round(weatherData.temperature - (weatherData.windSpeed * 0.1)),
      });
    } catch (error) {
      console.error('Error fetching weather data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocationName = async (latitude, longitude) => {
    try {
      // Use Nominatim (OpenStreetMap) reverse geocoding API with English language
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1&accept-language=en`,
        {
          headers: {
            'User-Agent': 'Skyforge Weather App', // Required by Nominatim
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }
      
      const data = await response.json();
      
      // Extract location name from response
      if (data.address) {
        // Try to get city/town name first
        const city = data.address.city || 
                     data.address.town || 
                     data.address.village || 
                     data.address.municipality ||
                     data.address.county;
        
        // Get country (should be in English now)
        const country = data.address.country;
        
        if (city && country) {
          return `${city}, ${country}`;
        } else if (city) {
          return city;
        } else if (country) {
          return country;
        } else if (data.display_name) {
          // Fallback to full display name, but shorten it
          const parts = data.display_name.split(',');
          return parts.slice(0, 2).join(', ').trim();
        }
      }
      
      // Fallback to coordinates if geocoding fails
      return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
    } catch (error) {
      console.error('Error getting location name:', error);
      // Fallback to coordinates
      return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
    }
  };

  const getWeatherCondition = (data) => {
    if (data.humidity > 80) return 'Rainy';
    if (data.humidity > 60) return 'Cloudy';
    if (data.humidity > 40) return 'Partly Cloudy';
    return 'Sunny';
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
        style={styles.gradient}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Image 
              source={require('../assets/skylogo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* App Name */}
        <Text style={styles.appName}>SKYFORGE</Text>

        {/* Slogan */}
        <Text style={styles.slogan}>Forge the skies. Shape the storms.</Text>

        {/* Weather Data Section */}
        <View style={styles.weatherSection}>
          {loading && currentWeather.temp === 0 ? (
            <ActivityIndicator size="large" color="#FFF" />
          ) : (
            <>
              {/* Location */}
              <Text style={styles.locationText}>{currentWeather.location}</Text>

              {/* Main Temperature */}
              <View style={styles.mainWeather}>
                <Text style={styles.mainTemp}>{currentWeather.temp}°</Text>
                <Text style={styles.condition}>{currentWeather.condition}</Text>
              </View>

              {/* Weather Details */}
              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <DetailItem 
                    iconSource={require('../assets/fire.png')}
                    label="Temperature"
                    value={`${currentWeather.temp}°C`}
                  />
                  <DetailItem 
                    iconSource={require('../assets/water.png')}
                    label="Humidity"
                    value={`${currentWeather.humidity}%`}
                  />
                  <DetailItem 
                    iconSource={require('../assets/earth.png')}
                    label="CO₂"
                    value={`${currentWeather.co2} ppm`}
                  />
                </View>
              </View>

              {/* Copernicus Data Info */}
              <TouchableOpacity 
                style={styles.infoCard}
                onPress={() => {
                  if (location) {
                    fetchWeatherData(location.latitude, location.longitude);
                  } else {
                    loadWeatherData();
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.infoTitleContainer}>
                  <Image 
                    source={require('../assets/satellite.png')} 
                    style={styles.infoTitleIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.infoTitle}>Copernicus Data</Text>
                  {loading && (
                    <ActivityIndicator size="small" color="#FFF" style={{ marginLeft: theme.spacing.sm }} />
                  )}
                </View>
                <Text style={styles.infoText}>
                  Weather data powered by Copernicus Atmosphere Monitoring Service (CAMS)
                </Text>
                <Text style={styles.refreshHint}>Tap to refresh data</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Enter Button */}
        <TouchableOpacity 
          style={styles.enterButton}
          onPress={onEnter}
        >
          <Text style={styles.enterButtonText}>Enter Skyforge</Text>
          <Text style={styles.enterButtonArrow}>→</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Version 1.0.0 Beta</Text>
      </LinearGradient>
    </View>
  );
}

function DetailItem({ iconSource, label, value }) {
  return (
    <View style={styles.detailItem}>
      {iconSource ? (
        <Image 
          source={iconSource} 
          style={styles.detailIconImage}
          resizeMode="contain"
        />
      ) : null}
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    paddingHorizontal: theme.spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  logo: {
    width: 80,
    height: 80,
  },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFF',
    marginTop: theme.spacing.lg,
    letterSpacing: 2,
    textAlign: 'center',
    // Gradient text effect
    textShadowColor: 'rgba(59, 130, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  slogan: {
    fontSize: 16,
    color: '#87CEEB',
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  weatherSection: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
  },
  locationText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  mainWeather: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  mainTemp: {
    fontSize: 72,
    fontWeight: '200',
    color: '#FFF',
    letterSpacing: -2,
  },
  condition: {
    fontSize: 20,
    color: '#FFF',
    opacity: 0.9,
    marginTop: theme.spacing.xs,
  },
  detailsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailIconImage: {
    width: 36,
    height: 36,
    marginBottom: theme.spacing.xs,
  },
  detailLabel: {
    fontSize: 11,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 4,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    width: '100%',
    ...theme.shadows.md,
  },
  infoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    justifyContent: 'center',
  },
  infoTitleIcon: {
    width: 20,
    height: 20,
    marginRight: theme.spacing.xs,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  infoText: {
    fontSize: 11,
    color: '#FFF',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 16,
  },
  refreshHint: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
  },
  enterButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: theme.borderRadius.full,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.6)',
    ...theme.shadows.lg,
    minWidth: 200,
  },
  enterButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginRight: theme.spacing.sm,
  },
  enterButtonArrow: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  versionText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: theme.spacing.sm,
  },
});

