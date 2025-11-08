import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { theme } from '../theme';
import { getCopernicusWeatherData } from '../src/services/copernicusService';

export default function WeatherScreen() {
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
    }
  };

  const getLocationName = async (latitude, longitude) => {
    // Simplified - in production, use a geocoding service
    // For now, return coordinates or a default name
    return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  };

  const getWeatherCondition = (data) => {
    if (data.humidity > 80) return 'Rainy';
    if (data.humidity > 60) return 'Cloudy';
    if (data.humidity > 40) return 'Partly Cloudy';
    return 'Sunny';
  };

  const getGradientColors = () => {
    const condition = currentWeather.condition.toLowerCase();
    if (condition.includes('rain') || condition.includes('storm')) {
      return ['#4A5568', '#2D3748'];
    } else if (condition.includes('cloud')) {
      return ['#7BB5F0', '#4A90E2'];
    } else {
      return ['#87CEEB', '#4A90E2'];
    }
  };

  if (loading && currentWeather.temp === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={getGradientColors()} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.loadingText}>Loading weather data...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={getGradientColors()} style={styles.gradient}>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.location}>{currentWeather.location}</Text>
            <TouchableOpacity style={styles.gameButton}>
              <Text style={styles.gameButtonText}>🎮 Weather Game</Text>
            </TouchableOpacity>
          </View>

          {/* Main Temperature */}
          <View style={styles.mainWeather}>
            <Text style={styles.mainTemp}>{currentWeather.temp}°</Text>
            <Text style={styles.condition}>{currentWeather.condition}</Text>
            <Text style={styles.feelsLike}>Feels like {currentWeather.feelsLike}°</Text>
          </View>

          {/* Weather Details */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <DetailItem icon="💧" label="Humidity" value={`${currentWeather.humidity}%`} />
              <DetailItem icon="💨" label="Wind" value={`${currentWeather.windSpeed} km/h`} />
              <DetailItem icon="🌍" label="CO₂" value={`${currentWeather.co2} ppm`} />
            </View>
          </View>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFF" />
              <Text style={styles.loadingText}>Loading Copernicus data...</Text>
            </View>
          )}

          {/* Copernicus Data Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>🌍 Copernicus Data</Text>
            <Text style={styles.infoText}>
              Weather data powered by Copernicus Atmosphere Monitoring Service (CAMS)
            </Text>
            <TouchableOpacity style={styles.refreshButton} onPress={loadWeatherData}>
              <Text style={styles.refreshButtonText}>🔄 Refresh Data</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailIcon}>{icon}</Text>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  location: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFF',
  },
  gameButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  gameButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  mainWeather: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  mainTemp: {
    fontSize: 96,
    fontWeight: '200',
    color: '#FFF',
    letterSpacing: -4,
  },
  condition: {
    fontSize: 24,
    color: '#FFF',
    opacity: 0.95,
  },
  feelsLike: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.8,
    marginTop: theme.spacing.sm,
  },
  detailsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.xs,
  },
  detailLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  hourlyScroll: {
    paddingLeft: theme.spacing.lg,
  },
  hourlyItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginRight: theme.spacing.sm,
    alignItems: 'center',
    width: 70,
  },
  hourlyTime: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: theme.spacing.sm,
  },
  hourlyIcon: {
    fontSize: 28,
    marginBottom: theme.spacing.sm,
  },
  hourlyTemp: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  weeklyContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  weeklyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  weeklyDay: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
    flex: 1,
  },
  weeklyIcon: {
    fontSize: 24,
    marginHorizontal: theme.spacing.md,
  },
  weeklyTempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  weeklyTempHigh: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    minWidth: 35,
  },
  weeklyTempLow: {
    fontSize: 16,
    color: '#FFF',
    opacity: 0.6,
    minWidth: 35,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    color: '#FFF',
    marginTop: theme.spacing.md,
    fontSize: 16,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start',
  },
  refreshButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
