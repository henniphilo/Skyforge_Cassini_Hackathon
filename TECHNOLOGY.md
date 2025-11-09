# Skyforge - Technology & Data Sources

## Overview
Skyforge is a React Native mobile application that combines real-time weather data, satellite imagery, and urban planning visualization. The app uses Copernicus atmospheric data, OpenStreetMap geospatial data, and Sentinel satellite information to create an interactive weather impact simulation game.

---

## Core Technologies

### Framework & Runtime
- **React Native** (`0.81.4`) - Cross-platform mobile application framework
- **React** (`19.1.0`) - JavaScript library for building user interfaces
- **Expo** (`~54.0.12`) - Framework and platform for React Native applications
  - Provides development tools, build services, and native module access
  - Enables rapid development and deployment

### JavaScript Runtime
- **Node.js** - JavaScript runtime environment (via Expo)
- **Metro Bundler** - React Native's JavaScript bundler

---

## Mapping & Visualization Libraries

### 2D Mapping
- **react-native-maps** (`1.18.0`) - Native map components for React Native
  - Provides `MapView`, `Marker`, `Polygon`, `Circle`, `Polyline` components
  - Supports iOS (MapKit) and Android (Google Maps)
  - Custom tile rendering support

### 3D Visualization
- **Deck.gl** (`9.0.0`) - WebGL-powered framework for visual exploratory data analysis
  - Rendered via `react-native-webview` (`13.12.2`)
  - Used for 3D building, tree, canal, and street visualization
  - Supports heat maps and wind visualization overlays
  - Interactive 3D camera controls (rotate, zoom, pan)

### WebView Integration
- **react-native-webview** (`13.12.2`) - WebView component for React Native
  - Embeds Deck.gl HTML visualizations
  - Enables JavaScript communication between React Native and WebView
  - Supports custom HTML/CSS/JavaScript rendering

---

## Data Sources & APIs

### Copernicus Atmosphere Monitoring Service (CAMS)
- **Service**: Copernicus Data Service
- **API Base**: `https://ads.atmosphere.copernicus.eu/api/v2`
- **Data Provided**:
  - Temperature (°C)
  - Wind Speed (km/h)
  - Wind Direction (degrees)
  - Humidity (%)
  - CO₂ Concentration (ppm)
  - Atmospheric Pressure (hPa)
- **Status**: Currently using mock data (production implementation requires API authentication)
- **Implementation**: `src/services/copernicusService.js`

### OpenStreetMap (OSM)
- **Service**: Overpass API
- **API Endpoint**: `https://overpass-api.de/api/interpreter`
- **Data Provided**:
  - **Buildings**: Building polygons and metadata (`building` tag)
  - **Trees**: Individual trees and forest areas (`natural=tree`, `landuse=forest`, `natural=wood`)
  - **Canals**: Waterways (`waterway=canal`, `waterway=ditch`, `waterway=river`)
  - **Streets**: Road networks (`highway=primary`, `secondary`, `tertiary`, `residential`, `service`)
- **Query Language**: Overpass QL
- **Implementation**: `src/services/openStreetMapService.js`
- **Fallback**: Mock data generation when API unavailable

### Sentinel Satellite Data
- **Satellites**: Sentinel-2A, Sentinel-2B (ESA Copernicus Program)
- **Orbit Characteristics**:
  - Orbital Period: ~100 minutes (6000 seconds)
  - Sun-synchronous orbit
  - Revisit time: ~5 days at equator, more frequent at mid-latitudes
- **Data Provided**:
  - Last pass time calculation
  - Next pass time prediction
  - Time since last pass
- **Implementation**: `src/services/satelliteService.js`
- **Note**: Simplified calculation based on orbital mechanics (production would use TLE data)

---

## UI/UX Libraries

### Styling & Design
- **expo-linear-gradient** (`~14.0.1`) - Linear gradient components
  - Used for background gradients and button styling
  - Dynamic gradient colors based on weather conditions

- **react-native-svg** (`~15.12.1`) - SVG rendering for React Native
  - Custom icon rendering
  - Vector graphics support

### Navigation
- **@react-navigation/native** (`^6.1.9`) - Navigation library for React Native
- **@react-navigation/bottom-tabs** (`^6.5.11`) - Bottom tab navigator
- **@react-navigation/native-stack** (`^6.9.17`) - Stack navigator
- **react-native-screens** (`~4.16.0`) - Native screen components
- **react-native-safe-area-context** (`~5.6.0`) - Safe area handling

### Animations
- **react-native-reanimated** (`~4.1.0`) - High-performance animation library
  - Smooth transitions and interactions

---

## Location Services

### Expo Location
- **expo-location** (`~18.0.4`) - Location services for Expo
- **Features**:
  - GPS location tracking
  - Foreground location permissions
  - Current position retrieval
  - Coordinate-based queries

---

## Data Processing & Format Conversion

### GeoJSON
- **Format**: GeoJSON (RFC 7946)
- **Usage**: Converting building, tree, canal, and street data for visualization
- **Implementation**: `src/services/keplerDataService.js`
- **Features**:
  - Point geometries (trees, building markers)
  - Polygon geometries (buildings, forest areas)
  - LineString geometries (canals, streets)
  - Feature properties (type, status, metadata)

### Data Transformation
- OSM data → GeoJSON FeatureCollection
- Coordinate system: WGS84 (EPSG:4326)
- Coordinate format: `[longitude, latitude]` (GeoJSON standard)

---

## Game Mechanics & Simulation

### Weather Impact Calculation
- **Algorithm**: `calculateWeatherImpact()` in `copernicusService.js`
- **Factors**:
  - Buildings added/removed → Temperature, wind, humidity, CO₂ changes
  - Trees added/removed → Temperature, wind, humidity, CO₂ changes
  - Urban heat island effect simulation
  - Carbon sequestration modeling

### Token System
- **Life Token**: Based on trees planted
- **Social Token**: Based on buildings added/removed
- **Energy Token**: Based on streets built
- **Charge-up mechanics**: Progressive token filling based on user actions

### Satellite Pass Timer
- Real-time calculation of Sentinel satellite pass times
- Game iteration based on orbital period (~100 minutes)
- Visual countdown and time-since indicators

---

## Platform Support

### Mobile Platforms
- **iOS**: Full support via Expo
- **Android**: Full support via Expo
- **Web**: Limited support (`react-native-web`, `react-dom`)

### Development Tools
- **Expo CLI**: Development server and build tools
- **Metro Bundler**: JavaScript bundling
- **Babel** (`@babel/core`): JavaScript transpilation

---

## External Dependencies

### CDN Resources
- **Deck.gl** (`https://unpkg.com/deck.gl@9.0.0/dist.min.js`)
  - Loaded dynamically in WebView for 3D visualization
  - No npm package required (loaded from CDN)

### Map Tiles
- **OpenStreetMap Tiles**: Custom tile rendering via `OpenStreetMapTile` component
- Tile format: Standard OSM tile schema

---

## Architecture Patterns

### Service Layer
- Modular service architecture
- Separation of concerns:
  - `copernicusService.js` - Weather data
  - `openStreetMapService.js` - Geospatial data
  - `satelliteService.js` - Satellite calculations
  - `keplerDataService.js` - Data transformation and visualization

### Component Structure
- **Screens**: `LandingScreen`, `WeatherGameScreen`
- **Components**: `KeplerGLView`, `OpenStreetMapTile`
- **Services**: Data fetching and processing
- **Theme**: Centralized styling (`theme.js`)

---

## Data Flow

1. **User Location** → `expo-location` → GPS coordinates
2. **Coordinates** → `openStreetMapService` → OSM data (buildings, trees, canals, streets)
3. **Coordinates** → `copernicusService` → Weather data (temperature, wind, humidity, CO₂)
4. **Coordinates** → `satelliteService` → Satellite pass times
5. **User Actions** → `calculateWeatherImpact` → Modified weather data
6. **All Data** → `keplerDataService` → GeoJSON → Deck.gl HTML → WebView rendering

---

## Future Enhancements

### Planned Integrations
- **Real Copernicus API**: Replace mock data with authenticated API calls
- **TLE Data**: Accurate satellite position tracking
- **Historical Data**: Weather trends and historical analysis
- **Real-time Updates**: WebSocket connections for live data
- **Offline Support**: Cached data for offline usage

---

## Version Information
- **App Version**: 1.0.0 Beta
- **Last Updated**: 2024
- **License**: Private

---

## Notes
- Currently using mock Copernicus data (requires API registration for production)
- OSM data falls back to mock data when API unavailable
- Sentinel pass times use simplified orbital calculations
- 3D visualization requires internet connection for Deck.gl CDN

