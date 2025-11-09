# 10th Cassini Hackathon

# Challenge 1 Immersive Gameplay with Space Technology & Data:
Unleash the potential of space technologies to revolutionise the gaming world. Use cutting-edge space assets, such as Copernicus Earth observation data, Galileo positioning services, and satellite connectivity to create immersive, thrilling, or science-driven gaming experiences.

Design a detailed game concept that leverages one or more of these assets: Copernicus for realistic terrain, weather patterns, or environmental monitoring; Galileo for precise positioning and navigation in dynamic gameplay; or satellite connectivity for real-time updates or enhanced multiplayer scenarios.
Develop core gameplay mechanics that creatively integrate these technologies, explaining how players will interact with features like resource management, exploration, or real-time event responses to deliver an engaging experience that blends strategy, science, and adventure.

# Our Approach: 
A React Native weather app with a 3D map game mode that uses Copernicus data and OpenStreetMap.

## 📹 App Demonstration

Watch the app demonstration video: [Skyforge App Demo](https://www.youtube.com/shorts/RwFToNH_QiQ)

## Prerequisites

Before running the app, make sure you have:

1. **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
2. **npm** or **yarn** package manager
3. **Expo CLI** (will be installed globally or via npx)
4. For iOS development: **Xcode** (macOS only)
5. For Android development: **Android Studio** with Android SDK

## Installation

1. **Navigate to the project directory:**
   ```bash
   cd /Users/henrike/Superapp-Projects/want-base
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   or
   ```bash
   yarn install
   ```

## Running the App

### Option 1: Start Development Server (Recommended)

Start the Expo development server:

```bash
npm start
```

or

```bash
yarn start
```

This will:
- Start the Metro bundler
- Open Expo DevTools in your browser
- Display a QR code in the terminal

### Option 2: Run on Specific Platform

**For iOS Simulator (macOS only):**
```bash
npm run ios
```

**For Android Emulator:**
```bash
npm run android
```

**For Web Browser:**
```bash
npm run web
```

## Running on Physical Device

### Using Expo Go App (Easiest)

1. **Install Expo Go** on your phone:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Scan the QR code:**
   - **iOS**: Open Camera app and scan the QR code
   - **Android**: Open Expo Go app and scan the QR code

4. Make sure your phone and computer are on the same Wi-Fi network.

### Using Development Build

For a more native experience (especially for maps), you can create a development build:

```bash
npx expo run:ios
# or
npx expo run:android
```

## Troubleshooting

### Common Issues

1. **"Module not found" errors:**
   ```bash
   rm -rf node_modules
   npm install
   ```

2. **Metro bundler cache issues:**
   ```bash
   npm start -- --clear
   ```

3. **iOS Simulator not opening:**
   - Make sure Xcode is installed
   - Run: `sudo xcode-select --switch /Applications/Xcode.app`

4. **Android emulator not starting:**
   - Open Android Studio
   - Go to AVD Manager and start an emulator
   - Then run `npm run android`

5. **Maps not showing:**
   - On iOS: Maps should work with OpenStreetMap
   - On Android: Make sure you have internet connection
   - On Web: Maps may have limited functionality

### Location Permissions

The app requires location permissions to:
- Show weather data for your area
- Display your location on the map

Make sure to grant location permissions when prompted.

## Project Structure

```
want-base/
├── App.js                 # Main app component with navigation
├── screens/
│   ├── WeatherScreen.js   # Weather display with Copernicus data
│   └── WeatherGameScreen.js # 3D map game mode
├── components/
│   └── OpenStreetMapTile.js # OpenStreetMap tile component
├── src/
│   └── services/
│       └── copernicusService.js # Copernicus API service
├── theme.js              # App theme configuration
└── package.json          # Dependencies
```

## Features

- 🌤️ **Weather Screen**: Displays real-time weather data using Copernicus API
- 🗺️ **3D Map Game**: Interactive map with building/tree manipulation
- 🌍 **OpenStreetMap**: Free, open-source map tiles
- 📊 **Weather Impact**: See how environment changes affect weather stats
- 📍 **Location Services**: Automatic location detection

## Development Commands

- `npm start` - Start Expo development server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run web` - Run in web browser

## Notes

- The Copernicus service currently uses mock data. To use real data, register at [Copernicus Atmosphere Data Store](https://ads.atmosphere.copernicus.eu/) and update the API calls.
- OpenStreetMap tiles are free and don't require an API key.
- For production builds, you may want to configure additional settings in `app.json`.

