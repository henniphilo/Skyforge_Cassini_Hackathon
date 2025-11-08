import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Platform, Text } from 'react-native';
import WeatherScreen from './screens/WeatherScreen';
import WeatherGameScreen from './screens/WeatherGameScreen';
import { theme } from './theme';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderTopColor: 'rgba(0, 0, 0, 0.1)',
              borderTopWidth: 1,
              paddingTop: 4,
              paddingBottom: Platform.OS === 'ios' ? 12 : 4,
              height: Platform.OS === 'ios' ? 60 : 50,
              position: 'absolute',
            },
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: '#999',
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '600',
              marginTop: 2,
            },
          }}
        >
          <Tab.Screen
            name="Weather"
            component={WeatherScreen}
            options={{
              tabBarIcon: ({ color }) => <TabIcon icon="🌤️" color={color} />,
            }}
          />
          <Tab.Screen
            name="Game"
            component={WeatherGameScreen}
            options={{
              tabBarIcon: ({ color }) => <TabIcon icon="🎮" color={color} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

function TabIcon({ icon, color }) {
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}
