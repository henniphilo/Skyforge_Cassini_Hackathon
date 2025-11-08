import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import LandingScreen from './screens/LandingScreen';
import WeatherGameScreen from './screens/WeatherGameScreen';

export default function App() {
  const [showLanding, setShowLanding] = useState(true);

  if (showLanding) {
    return (
      <>
        <StatusBar style="light" />
        <LandingScreen onEnter={() => setShowLanding(false)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <WeatherGameScreen />
    </>
  );
}
