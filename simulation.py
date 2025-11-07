"""
Simulation logic for urban climate effects:
- Temperature changes based on surface modifications
- Wind speed changes based on buildings
"""
import numpy as np
from typing import Dict, List, Tuple, Optional


class ClimateSimulator:
    """Simulates urban climate effects based on interventions."""
    
    def __init__(self, grid_size: Tuple[int, int] = (50, 50), 
                 base_lat: float = 52.48, base_lon: float = 13.43):
        """
        Initialize simulator with a grid.
        
        Args:
            grid_size: (width, height) of the simulation grid
            base_lat: Base latitude (Neukölln/Kreuzberg area)
            base_lon: Base longitude
        """
        self.grid_width, self.grid_height = grid_size
        self.base_lat = base_lat
        self.base_lon = base_lon
        
        # Temperature coefficients (in Celsius)
        self.TEMP_COEFFICIENTS = {
            "ADD_PARK": -2.0,      # Cooling effect
            "ADD_WATER": -3.0,     # Strong cooling
            "REMOVE_ASPHALT": 1.0, # Reduces UHI effect
            "ADD_ASPHALT": 2.5,    # Heating effect
            "ADD_BUILDING": 1.5,   # Buildings also heat up
        }
        
        # Initialize base grids (mock data - in real app, load from ERA5)
        self.base_temp = np.full(grid_size, 30.0)  # 30°C base temperature
        self.base_wind_u = np.full(grid_size, 2.0)  # 2 m/s west-east
        self.base_wind_v = np.full(grid_size, 1.0)  # 1 m/s south-north
        
        # Current state
        self.current_temp = self.base_temp.copy()
        self.current_wind_u = self.base_wind_u.copy()
        self.current_wind_v = self.base_wind_v.copy()
        
        # Track interventions
        self.interventions: List[Dict] = []
    
    def latlon_to_grid(self, lat: float, lon: float) -> Tuple[int, int]:
        """
        Convert lat/lon to grid coordinates.
        Simple approximation: ~100m per grid cell.
        """
        # Rough conversion: 1 degree ≈ 111km
        # For a 50x50 grid covering ~5km x 5km area
        lat_offset = (lat - self.base_lat) * 111000  # meters
        lon_offset = (lon - self.base_lon) * 111000 * np.cos(np.radians(self.base_lat))
        
        # Convert to grid coordinates (center at base_lat/base_lon)
        x = int(self.grid_width / 2 + lon_offset / 100)
        y = int(self.grid_height / 2 + lat_offset / 100)
        
        return max(0, min(x, self.grid_width - 1)), max(0, min(y, self.grid_height - 1))
    
    def grid_to_latlon(self, x: int, y: int) -> Tuple[float, float]:
        """Convert grid coordinates to lat/lon."""
        lon_offset = (x - self.grid_width / 2) * 100 / (111000 * np.cos(np.radians(self.base_lat)))
        lat_offset = (y - self.grid_height / 2) * 100 / 111000
        
        return self.base_lat + lat_offset, self.base_lon + lon_offset
    
    def propagate_heat_effect(self, grid: np.ndarray, cx: int, cy: int, impact: float):
        """
        Propagate temperature change to neighboring cells with distance-based damping.
        """
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                if dx == 0 and dy == 0:
                    continue
                
                distance_sq = dx**2 + dy**2
                damping = 1 / (1 + distance_sq)  # Distance-based damping
                
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < self.grid_width and 0 <= ny < self.grid_height:
                    grid[nx, ny] += impact * damping * 0.5
    
    def get_wind_shadow_cells(self, u: float, v: float) -> List[Tuple[int, int]]:
        """
        Get grid cells in the wind shadow (behind the building relative to wind direction).
        """
        # Normalize wind direction
        wind_magnitude = np.sqrt(u**2 + v**2)
        if wind_magnitude < 0.1:
            return []
        
        # Wind direction vector (normalized)
        dir_x = -u / wind_magnitude  # Negative because shadow is opposite to wind
        dir_y = -v / wind_magnitude
        
        shadow_cells = []
        # Check cells in the direction opposite to wind (2-3 cells behind)
        for dist in range(1, 4):
            dx = int(np.round(dir_x * dist))
            dy = int(np.round(dir_y * dist))
            shadow_cells.append((dx, dy))
        
        return shadow_cells
    
    def get_wind_channel_cells(self, u: float, v: float) -> List[Tuple[int, int]]:
        """
        Get grid cells where wind is channeled (perpendicular to wind direction).
        """
        wind_magnitude = np.sqrt(u**2 + v**2)
        if wind_magnitude < 0.1:
            return []
        
        # Perpendicular vectors (left and right of wind direction)
        perp_x1 = -v / wind_magnitude
        perp_y1 = u / wind_magnitude
        perp_x2 = v / wind_magnitude
        perp_y2 = -u / wind_magnitude
        
        channel_cells = []
        for dist in range(1, 3):
            channel_cells.append((int(np.round(perp_x1 * dist)), int(np.round(perp_y1 * dist))))
            channel_cells.append((int(np.round(perp_x2 * dist)), int(np.round(perp_y2 * dist))))
        
        return channel_cells
    
    def apply_intervention(self, action_type: str, lat: float, lon: float) -> Dict:
        """
        Apply an intervention and update the simulation.
        
        Args:
            action_type: Type of intervention (ADD_PARK, ADD_WATER, etc.)
            lat: Latitude
            lon: Longitude
        
        Returns:
            Dictionary with updated simulation state
        """
        x, y = self.latlon_to_grid(lat, lon)
        
        # Store intervention
        intervention = {
            'type': action_type,
            'lat': lat,
            'lon': lon,
            'x': x,
            'y': y
        }
        self.interventions.append(intervention)
        
        # Apply temperature effect
        if action_type in self.TEMP_COEFFICIENTS:
            impact = self.TEMP_COEFFICIENTS[action_type]
            self.current_temp[x, y] += impact
            self.propagate_heat_effect(self.current_temp, x, y, impact)
        
        # Apply wind effect (only for buildings)
        if action_type == "ADD_BUILDING":
            u, v = self.current_wind_u[x, y], self.current_wind_v[x, y]
            
            # Wind shadow effect
            for dx, dy in self.get_wind_shadow_cells(u, v):
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.grid_width and 0 <= ny < self.grid_height:
                    self.current_wind_u[nx, ny] *= 0.5
                    self.current_wind_v[nx, ny] *= 0.5
            
            # Channeling effect
            for dx, dy in self.get_wind_channel_cells(u, v):
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.grid_width and 0 <= ny < self.grid_height:
                    self.current_wind_u[nx, ny] *= 1.3
                    self.current_wind_v[nx, ny] *= 1.3
        
        elif action_type == "REMOVE_BUILDING":
            # Reverse the building effect (simplified)
            u, v = self.base_wind_u[x, y], self.base_wind_v[x, y]
            
            for dx, dy in self.get_wind_shadow_cells(u, v):
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.grid_width and 0 <= ny < self.grid_height:
                    self.current_wind_u[nx, ny] = self.base_wind_u[nx, ny]
                    self.current_wind_v[nx, ny] = self.base_wind_v[nx, ny]
        
        return self.get_state()
    
    def get_state(self) -> Dict:
        """
        Get current simulation state as dictionary for JSON serialization.
        """
        # Sample grid points for visualization (reduce resolution for performance)
        sample_rate = 2  # Every 2nd point
        temp_samples = []
        wind_samples = []
        
        for x in range(0, self.grid_width, sample_rate):
            for y in range(0, self.grid_height, sample_rate):
                lat, lon = self.grid_to_latlon(x, y)
                temp_samples.append([lat, lon, float(self.current_temp[x, y])])
                
                u = float(self.current_wind_u[x, y])
                v = float(self.current_wind_v[x, y])
                wind_magnitude = np.sqrt(u**2 + v**2)
                wind_samples.append([lat, lon, u, v, wind_magnitude])
        
        # Find hotspot (hottest point)
        max_idx = np.unravel_index(np.argmax(self.current_temp), self.current_temp.shape)
        hotspot_lat, hotspot_lon = self.grid_to_latlon(max_idx[0], max_idx[1])
        hotspot_temp = float(self.current_temp[max_idx])
        
        return {
            'temperature_data': temp_samples,
            'wind_data': wind_samples,
            'hotspot': {
                'lat': hotspot_lat,
                'lon': hotspot_lon,
                'temp': hotspot_temp
            },
            'base_temp': float(np.mean(self.base_temp)),
            'current_avg_temp': float(np.mean(self.current_temp)),
            'interventions': self.interventions
        }
    
    def reset(self):
        """Reset simulation to base state."""
        self.current_temp = self.base_temp.copy()
        self.current_wind_u = self.base_wind_u.copy()
        self.current_wind_v = self.base_wind_v.copy()
        self.interventions = []
        return self.get_state()

