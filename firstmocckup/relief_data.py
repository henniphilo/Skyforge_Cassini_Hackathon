"""
Relief/Elevation data provider for Neukölln/Kreuzberg area.
Currently uses mock data, but structured to easily integrate Copernicus DEM data.
"""
import numpy as np
from typing import Dict, List, Tuple


class ReliefDataProvider:
    """Provides elevation/relief data for visualization."""
    
    def __init__(self, base_lat: float = 52.48, base_lon: float = 13.43, 
                 grid_size: Tuple[int, int] = (100, 100)):
        """
        Initialize relief data provider.
        
        Args:
            base_lat: Base latitude (center of area)
            base_lon: Base longitude (center of area)
            grid_size: (width, height) of elevation grid
        """
        self.base_lat = base_lat
        self.base_lon = base_lon
        self.grid_width, self.grid_height = grid_size
        
        # Approximate bounds for Neukölln/Kreuzberg area
        # Roughly 5km x 5km area
        self.lat_bounds = (52.45, 52.51)  # South to North
        self.lon_bounds = (13.38, 13.48)  # West to East
        
        # Generate mock elevation data
        self.elevation_grid = self._generate_mock_elevation()
    
    def _generate_mock_elevation(self) -> np.ndarray:
        """
        Generate mock elevation data for Neukölln/Kreuzberg.
        
        Neukölln/Kreuzberg characteristics:
        - Relatively flat area (30-50m above sea level)
        - Slight elevation variations
        - Lower areas near Spree and canals
        - Some higher areas (e.g., Tempelhofer Feld area)
        """
        # Create coordinate grids
        x = np.linspace(0, 1, self.grid_width)
        y = np.linspace(0, 1, self.grid_height)
        X, Y = np.meshgrid(x, y)
        
        # Base elevation (around 35-40m for Berlin)
        base_elevation = 38.0
        
        # Add realistic variations:
        # 1. General slight slope (higher in north-east)
        slope = 5.0 * (X * 0.3 + Y * 0.7)
        
        # 2. Simulate Spree river (lower elevation in center-west)
        spree_effect = -8.0 * np.exp(-((X - 0.3)**2 + (Y - 0.5)**2) / 0.1)
        
        # 3. Simulate canals (linear depressions)
        canal1 = -3.0 * np.exp(-((X - 0.6)**2) / 0.05)
        canal2 = -3.0 * np.exp(-((Y - 0.3)**2) / 0.05)
        
        # 4. Add some hills/ridges (using Perlin-like noise simulation)
        noise = np.random.RandomState(42)
        hills = 4.0 * (noise.random((self.grid_height, self.grid_width)) - 0.5)
        hills = np.convolve(hills.flatten(), np.ones(9)/9, mode='same').reshape(hills.shape)
        
        # 5. Tempelhofer Feld area (slightly elevated, flat)
        tempelhof = 3.0 * np.exp(-((X - 0.5)**2 + (Y - 0.7)**2) / 0.15)
        
        # Combine all effects
        elevation = base_elevation + slope + spree_effect + canal1 + canal2 + hills + tempelhof
        
        # Ensure minimum elevation (above sea level)
        elevation = np.maximum(elevation, 25.0)
        
        return elevation
    
    def grid_to_latlon(self, x: int, y: int) -> Tuple[float, float]:
        """Convert grid coordinates to lat/lon."""
        lat = self.lat_bounds[0] + (y / self.grid_height) * (self.lat_bounds[1] - self.lat_bounds[0])
        lon = self.lon_bounds[0] + (x / self.grid_width) * (self.lon_bounds[1] - self.lon_bounds[0])
        return lat, lon
    
    def latlon_to_grid(self, lat: float, lon: float) -> Tuple[int, int]:
        """Convert lat/lon to grid coordinates."""
        y = int((lat - self.lat_bounds[0]) / (self.lat_bounds[1] - self.lat_bounds[0]) * self.grid_height)
        x = int((lon - self.lon_bounds[0]) / (self.lon_bounds[1] - self.lon_bounds[0]) * self.grid_width)
        return max(0, min(x, self.grid_width - 1)), max(0, min(y, self.grid_height - 1))
    
    def get_elevation_at(self, lat: float, lon: float) -> float:
        """Get elevation at specific lat/lon coordinates."""
        x, y = self.latlon_to_grid(lat, lon)
        return float(self.elevation_grid[y, x])
    
    def get_elevation_data(self, sample_rate: int = 2) -> List[List[float]]:
        """
        Get elevation data as list of [lat, lon, elevation] points.
        
        Args:
            sample_rate: Sample every Nth point (for performance)
        
        Returns:
            List of [lat, lon, elevation] tuples
        """
        data = []
        for y in range(0, self.grid_height, sample_rate):
            for x in range(0, self.grid_width, sample_rate):
                lat, lon = self.grid_to_latlon(x, y)
                elevation = float(self.elevation_grid[y, x])
                data.append([lat, lon, elevation])
        return data
    
    def get_hillshade_data(self, sample_rate: int = 2, 
                          azimuth: float = 315.0, altitude: float = 45.0) -> List[List[float]]:
        """
        Calculate hillshade (shaded relief) for visualization.
        
        Args:
            sample_rate: Sample every Nth point
            azimuth: Light source direction in degrees (0-360)
            altitude: Light source altitude in degrees (0-90)
        
        Returns:
            List of [lat, lon, shade_value] tuples (shade_value 0-255)
        """
        # Calculate gradients
        grad_y, grad_x = np.gradient(self.elevation_grid)
        
        # Convert azimuth and altitude to radians
        azimuth_rad = np.radians(azimuth)
        altitude_rad = np.radians(altitude)
        
        # Calculate slope and aspect
        slope = np.arctan(np.sqrt(grad_x**2 + grad_y**2))
        aspect = np.arctan2(-grad_x, grad_y)
        
        # Calculate hillshade
        hillshade = np.sin(altitude_rad) * np.sin(slope) + \
                   np.cos(altitude_rad) * np.cos(slope) * \
                   np.cos(azimuth_rad - aspect)
        
        # Normalize to 0-255
        hillshade = (hillshade + 1) / 2 * 255
        hillshade = np.clip(hillshade, 0, 255)
        
        # Sample data
        data = []
        for y in range(0, self.grid_height, sample_rate):
            for x in range(0, self.grid_width, sample_rate):
                lat, lon = self.grid_to_latlon(x, y)
                shade = float(hillshade[y, x])
                data.append([lat, lon, shade])
        return data
    
    def get_contour_lines(self, levels: List[float] = None) -> List[Dict]:
        """
        Generate contour lines for elevation visualization.
        
        Args:
            levels: List of elevation levels for contours (in meters)
                   If None, auto-generate levels
        
        Returns:
            List of contour line dictionaries with lat/lon coordinates
        """
        if levels is None:
            min_elev = float(np.min(self.elevation_grid))
            max_elev = float(np.max(self.elevation_grid))
            # Generate 5 contour levels
            levels = np.linspace(min_elev, max_elev, 5).tolist()
        
        contours = []
        for level in levels:
            # Find points at this elevation level (simplified)
            # In a real implementation, use proper contour tracing
            contour_points = []
            threshold = 1.0  # meters - increased threshold for better detection
            
            # Sample more points for better contour lines
            for y in range(0, self.grid_height, 1):
                for x in range(0, self.grid_width, 1):
                    elev = self.elevation_grid[y, x]
                    if abs(elev - level) < threshold:
                        lat, lon = self.grid_to_latlon(x, y)
                        contour_points.append([lat, lon])
            
            # Group nearby points into lines
            if len(contour_points) > 5:
                # Simple approach: sort by distance to create continuous lines
                # For better results, use marching squares algorithm, but this works for demo
                sorted_points = []
                remaining = contour_points.copy()
                
                if remaining:
                    sorted_points.append(remaining.pop(0))
                    
                    while remaining:
                        last_point = sorted_points[-1]
                        # Find closest point
                        min_dist = float('inf')
                        min_idx = 0
                        for i, point in enumerate(remaining):
                            dist = ((point[0] - last_point[0])**2 + (point[1] - last_point[1])**2)
                            if dist < min_dist:
                                min_dist = dist
                                min_idx = i
                        
                        if min_dist < 0.01:  # Only add if close enough
                            sorted_points.append(remaining.pop(min_idx))
                        else:
                            # Start new line segment
                            if len(sorted_points) > 5:
                                break
                            if remaining:
                                sorted_points = [remaining.pop(0)]
                    
                    if len(sorted_points) > 5:
                        contours.append({
                            'elevation': float(level),
                            'points': sorted_points
                        })
        
        return contours
    
    def get_bounds(self) -> Dict:
        """Get bounding box of the area."""
        return {
            'north': self.lat_bounds[1],
            'south': self.lat_bounds[0],
            'east': self.lon_bounds[1],
            'west': self.lon_bounds[0],
            'min_elevation': float(np.min(self.elevation_grid)),
            'max_elevation': float(np.max(self.elevation_grid))
        }
    
    # TODO: Method to load Copernicus DEM data
    # def load_copernicus_dem(self, file_path: str):
    #     """Load elevation data from Copernicus DEM file."""
    #     # This will be implemented when integrating real Copernicus data
    #     pass

