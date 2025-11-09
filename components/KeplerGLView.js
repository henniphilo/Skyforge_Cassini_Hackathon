import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, Platform } from 'react-native';
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
  const htmlContent = generateDeckGLHTML(geoJsonData, location, weatherData, mapRegion, showHeat, showWind);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>3D Visualization</Text>
          <View style={styles.controls}>
            <TouchableOpacity 
              style={[styles.toggleButton, showHeat && styles.toggleButtonActive]}
              onPress={() => {
                const newValue = !showHeat;
                setShowHeat(newValue);
                // Send message to WebView to toggle heat
                webViewRef.current?.injectJavaScript(`
                  (function() {
                    if (window.updateLayerVisibility) {
                      window.updateLayerVisibility('heat-map', ${newValue});
                    }
                  })();
                  true;
                `);
              }}
            >
              <Text style={[styles.toggleButtonText, showHeat && styles.toggleButtonTextActive]}>
                🌡️ Heat
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleButton, showWind && styles.toggleButtonActive]}
              onPress={() => {
                const newValue = !showWind;
                setShowWind(newValue);
                // Send message to WebView to toggle wind
                webViewRef.current?.injectJavaScript(`
                  (function() {
                    if (window.updateLayerVisibility) {
                      window.updateLayerVisibility('wind-arrows', ${newValue});
                    }
                  })();
                  true;
                `);
              }}
            >
              <Text style={[styles.toggleButtonText, showWind && styles.toggleButtonTextActive]}>
                💨 Wind
              </Text>
            </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕ Close</Text>
          </TouchableOpacity>
          </View>
        </View>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: theme.spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  toggleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    fontSize: 12,
  },
  toggleButtonTextActive: {
    color: '#FFF',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  closeButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  closeButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});

