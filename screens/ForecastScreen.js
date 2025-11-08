import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

export default function ForecastScreen() {
  const [selectedDay, setSelectedDay] = useState(0);

  const weeklyData = [
    {
      day: 'Monday',
      date: 'Dec 18',
      high: 12,
      low: 6,
      condition: 'Partly Cloudy',
      icon: '🌤️',
      rain: 20,
      wind: 15,
      humidity: 65,
      hourly: [
        { time: '06:00', temp: 7, icon: '🌤️' },
        { time: '09:00', temp: 9, icon: '⛅' },
        { time: '12:00', temp: 11, icon: '☀️' },
        { time: '15:00', temp: 12, icon: '🌤️' },
        { time: '18:00', temp: 9, icon: '🌙' },
        { time: '21:00', temp: 7, icon: '🌙' },
      ],
    },
    {
      day: 'Tuesday',
      date: 'Dec 19',
      high: 14,
      low: 8,
      condition: 'Sunny',
      icon: '☀️',
      rain: 5,
      wind: 12,
      humidity: 55,
      hourly: [
        { time: '06:00', temp: 8, icon: '🌤️' },
        { time: '09:00', temp: 11, icon: '☀️' },
        { time: '12:00', temp: 13, icon: '☀️' },
        { time: '15:00', temp: 14, icon: '☀️' },
        { time: '18:00', temp: 11, icon: '🌙' },
        { time: '21:00', temp: 9, icon: '🌙' },
      ],
    },
    {
      day: 'Wednesday',
      date: 'Dec 20',
      high: 11,
      low: 7,
      condition: 'Rainy',
      icon: '🌧️',
      rain: 80,
      wind: 22,
      humidity: 85,
      hourly: [
        { time: '06:00', temp: 8, icon: '🌧️' },
        { time: '09:00', temp: 9, icon: '🌧️' },
        { time: '12:00', temp: 10, icon: '🌧️' },
        { time: '15:00', temp: 11, icon: '🌦️' },
        { time: '18:00', temp: 9, icon: '🌙' },
        { time: '21:00', temp: 8, icon: '🌙' },
      ],
    },
    {
      day: 'Thursday',
      date: 'Dec 21',
      high: 13,
      low: 9,
      condition: 'Cloudy',
      icon: '☁️',
      rain: 35,
      wind: 18,
      humidity: 72,
      hourly: [
        { time: '06:00', temp: 9, icon: '☁️' },
        { time: '09:00', temp: 11, icon: '☁️' },
        { time: '12:00', temp: 12, icon: '⛅' },
        { time: '15:00', temp: 13, icon: '⛅' },
        { time: '18:00', temp: 11, icon: '🌙' },
        { time: '21:00', temp: 9, icon: '🌙' },
      ],
    },
    {
      day: 'Friday',
      date: 'Dec 22',
      high: 15,
      low: 10,
      condition: 'Sunny',
      icon: '☀️',
      rain: 10,
      wind: 14,
      humidity: 58,
      hourly: [
        { time: '06:00', temp: 10, icon: '🌤️' },
        { time: '09:00', temp: 12, icon: '☀️' },
        { time: '12:00', temp: 14, icon: '☀️' },
        { time: '15:00', temp: 15, icon: '☀️' },
        { time: '18:00', temp: 12, icon: '🌙' },
        { time: '21:00', temp: 11, icon: '🌙' },
      ],
    },
  ];

  const selectedDayData = weeklyData[selectedDay];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#4A90E2', '#7BB5F0']} style={styles.gradient}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Header */}
            <Text style={styles.title}>10-Day Forecast</Text>

            {/* Day Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daySelector}>
              {weeklyData.map((day, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.dayCard, selectedDay === index && styles.dayCardActive]}
                  onPress={() => setSelectedDay(index)}
                >
                  <Text style={[styles.dayName, selectedDay === index && styles.dayNameActive]}>
                    {day.day.substring(0, 3)}
                  </Text>
                  <Text style={styles.dayIcon}>{day.icon}</Text>
                  <Text style={[styles.dayTemp, selectedDay === index && styles.dayTempActive]}>
                    {day.high}°
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Selected Day Details */}
            <View style={styles.detailsCard}>
              <View style={styles.detailsHeader}>
                <View>
                  <Text style={styles.detailsDay}>{selectedDayData.day}</Text>
                  <Text style={styles.detailsDate}>{selectedDayData.date}</Text>
                </View>
                <Text style={styles.detailsIcon}>{selectedDayData.icon}</Text>
              </View>

              <View style={styles.tempRow}>
                <Text style={styles.detailsCondition}>{selectedDayData.condition}</Text>
                <View style={styles.tempRange}>
                  <Text style={styles.tempHigh}>{selectedDayData.high}°</Text>
                  <Text style={styles.tempSeparator}>/</Text>
                  <Text style={styles.tempLow}>{selectedDayData.low}°</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <StatItem icon="🌧️" label="Rain" value={`${selectedDayData.rain}%`} />
                <StatItem icon="💨" label="Wind" value={`${selectedDayData.wind} km/h`} />
                <StatItem icon="💧" label="Humidity" value={`${selectedDayData.humidity}%`} />
              </View>
            </View>

            {/* Hourly Breakdown */}
            <View style={styles.hourlySection}>
              <Text style={styles.hourlyTitle}>Hourly Breakdown</Text>
              {selectedDayData.hourly.map((hour, index) => (
                <View key={index} style={styles.hourlyItem}>
                  <Text style={styles.hourlyTime}>{hour.time}</Text>
                  <Text style={styles.hourlyIcon}>{hour.icon}</Text>
                  <Text style={styles.hourlyTemp}>{hour.temp}°</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

function StatItem({ icon, label, value }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
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
  content: {
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: theme.spacing.xl,
  },
  daySelector: {
    marginBottom: theme.spacing.xl,
  },
  dayCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginRight: theme.spacing.sm,
    alignItems: 'center',
    minWidth: 70,
  },
  dayCardActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dayName: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: theme.spacing.xs,
  },
  dayNameActive: {
    fontWeight: '600',
    opacity: 1,
  },
  dayIcon: {
    fontSize: 28,
    marginVertical: theme.spacing.xs,
  },
  dayTemp: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
  },
  dayTempActive: {
    fontWeight: '700',
  },
  detailsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  detailsDay: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  detailsDate: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.8,
    marginTop: 2,
  },
  detailsIcon: {
    fontSize: 64,
  },
  tempRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  detailsCondition: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  tempRange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tempHigh: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
  },
  tempSeparator: {
    fontSize: 24,
    color: '#FFF',
    opacity: 0.5,
    marginHorizontal: 4,
  },
  tempLow: {
    fontSize: 32,
    fontWeight: '400',
    color: '#FFF',
    opacity: 0.7,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 28,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  hourlySection: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  hourlyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: theme.spacing.md,
  },
  hourlyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  hourlyTime: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
    flex: 1,
  },
  hourlyIcon: {
    fontSize: 24,
    marginHorizontal: theme.spacing.md,
  },
  hourlyTemp: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    minWidth: 45,
    textAlign: 'right',
  },
});
