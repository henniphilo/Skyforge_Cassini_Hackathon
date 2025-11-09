import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { theme } from '../theme';
import { convertToGeoJSON, generateDeckGLHTML } from '../src/services/keplerDataService';

export default function KeplerGLView({ 
  visible, 
  onClose, 
  existingBuildings, 
  existingTrees = [],
  existingCanals = [],
  existingStreets = [],
  userBuildings, 
  removedBuildings, 
  removedTrees = [],
  removedCanals = [],
  removedStreets = [],
  location,
  weatherData = null,
  mapRegion = null
}) {
  const webViewRef = useRef(null);
  const [showHeat, setShowHeat] = useState(true);
  const [showWind, setShowWind] = useState(true);
  const [showHumidity, setShowHumidity] = useState(false);
  const [showCO2, setShowCO2] = useState(false);
  const [showTemperature, setShowTemperature] = useState(false);

  const geoJsonData = convertToGeoJSON(
    existingBuildings, 
    userBuildings, 
    removedBuildings, 
    location, 
    existingTrees,
    existingCanals,
    existingStreets,
    removedTrees,
    removedCanals,
    removedStreets
  );
  const htmlContent = generateDeckGLHTML(
    geoJsonData, 
    location, 
    weatherData, 
    mapRegion, 
    showHeat, 
    showWind, 
    showHumidity, 
    showCO2, 
    showTemperature
  );

  const toggleLayer = (layerId, currentValue, setter) => {
    const newValue = !currentValue;
    setter(newValue);
    // Send message to WebView to toggle layer
    webViewRef.current?.injectJavaScript(`
      (function() {
        if (window.updateLayerVisibility) {
          window.updateLayerVisibility('${layerId}', ${newValue});
        }
      })();
      true;
    `);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Satellite Data Visualization</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.controlsContainer}
          contentContainerStyle={styles.controlsContent}
        >
          <TouchableOpacity 
            style={[styles.toggleButton, showTemperature && styles.toggleButtonActive]}
            onPress={() => toggleLayer('temperature-layer', showTemperature, setShowTemperature)}
          >
            <Text style={[styles.toggleButtonText, showTemperature && styles.toggleButtonTextActive]}>
              🌡️ Temperature
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, showWind && styles.toggleButtonActive]}
            onPress={() => toggleLayer('wind-arrows', showWind, setShowWind)}
          >
            <Text style={[styles.toggleButtonText, showWind && styles.toggleButtonTextActive]}>
              💨 Wind
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, showHumidity && styles.toggleButtonActive]}
            onPress={() => toggleLayer('humidity-layer', showHumidity, setShowHumidity)}
          >
            <Text style={[styles.toggleButtonText, showHumidity && styles.toggleButtonTextActive]}>
              💧 Humidity
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, showCO2 && styles.toggleButtonActive]}
            onPress={() => toggleLayer('co2-layer', showCO2, setShowCO2)}
          >
            <Text style={[styles.toggleButtonText, showCO2 && styles.toggleButtonTextActive]}>
              🌍 CO₂
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, showHeat && styles.toggleButtonActive]}
            onPress={() => toggleLayer('heat-map', showHeat, setShowHeat)}
          >
            <Text style={[styles.toggleButtonText, showHeat && styles.toggleButtonTextActive]}>
              🔥 Heat Map
            </Text>
          </TouchableOpacity>
        </ScrollView>
        
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error: ', nativeEvent);
          }}
          onMessage={(event) => {
            console.log('WebView message:', event.nativeEvent.data);
          }}
          onLoadEnd={() => {
            console.log('WebView loaded successfully');
          }}
          onLoadStart={() => {
            console.log('WebView started loading');
          }}
          injectedJavaScript={`
            (function() {
              const originalLog = console.log;
              const originalError = console.error;
              console.log = function(...args) {
                originalLog.apply(console, args);
                window.ReactNativeWebView.postMessage('LOG: ' + args.join(' '));
              };
              console.error = function(...args) {
                originalError.apply(console, args);
                window.ReactNativeWebView.postMessage('ERROR: ' + args.join(' '));
              };
            })();
            true;
          `}
        />
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: theme.spacing.md,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(83, 52, 131, 0.5)',
  },
  controlsContainer: {
    maxHeight: 60,
    backgroundColor: 'rgba(15, 52, 96, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(83, 52, 131, 0.3)',
  },
  controlsContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  toggleButton: {
    backgroundColor: 'rgba(83, 52, 131, 0.4)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(83, 52, 131, 0.6)',
    minWidth: 100,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(83, 52, 131, 0.8)',
    borderColor: '#a78bfa',
  },
  toggleButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  toggleButtonTextActive: {
    color: '#FFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  closeButton: {
    backgroundColor: 'rgba(83, 52, 131, 0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.5)',
  },
  closeButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 18,
  },
  webview: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
});

