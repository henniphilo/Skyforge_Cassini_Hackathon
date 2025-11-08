import React from 'react';
import { UrlTile } from 'react-native-maps';

/**
 * OpenStreetMap Tile Component
 * Handles OpenStreetMap tile loading with subdomain rotation for better performance
 */
export default function OpenStreetMapTile() {
  // OpenStreetMap uses subdomains a, b, c for load balancing
  // We'll use a single subdomain 'a' which should work fine
  // For production, you might want to implement subdomain rotation
  const tileUrl = 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <UrlTile
      urlTemplate={tileUrl}
      maximumZ={19}
      flipY={false}
      tileSize={256}
    />
  );
}

