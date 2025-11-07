"""
Flask server for urban climate simulation API.
"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from simulation import ClimateSimulator
from relief_data import ReliefDataProvider

app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app)  # Enable CORS for frontend

# Initialize simulator
simulator = ClimateSimulator(grid_size=(50, 50), base_lat=52.48, base_lon=13.43)

# Initialize relief data provider
relief_provider = ReliefDataProvider(base_lat=52.48, base_lon=13.43, grid_size=(100, 100))


@app.route('/')
def index():
    """Serve the main HTML page."""
    return send_from_directory('static', 'index.html')


@app.route('/static/<path:path>')
def serve_static(path):
    """Serve static files."""
    return send_from_directory('static', path)


@app.route('/api/state', methods=['GET'])
def get_state():
    """Get current simulation state."""
    return jsonify(simulator.get_state())


@app.route('/api/intervene', methods=['POST'])
def intervene():
    """
    Apply an intervention to the simulation.
    
    Expected JSON:
    {
        "type": "ADD_PARK" | "ADD_WATER" | "REMOVE_ASPHALT" | "ADD_BUILDING" | "REMOVE_BUILDING",
        "lat": 52.48,
        "lon": 13.43
    }
    """
    data = request.json
    
    if not data or 'type' not in data or 'lat' not in data or 'lon' not in data:
        return jsonify({'error': 'Missing required fields: type, lat, lon'}), 400
    
    action_type = data['type']
    lat = float(data['lat'])
    lon = float(data['lon'])
    
    valid_types = ['ADD_PARK', 'ADD_WATER', 'REMOVE_ASPHALT', 'ADD_ASPHALT', 
                   'ADD_BUILDING', 'REMOVE_BUILDING']
    if action_type not in valid_types:
        return jsonify({'error': f'Invalid action type. Must be one of: {valid_types}'}), 400
    
    try:
        result = simulator.apply_intervention(action_type, lat, lon)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/reset', methods=['POST'])
def reset():
    """Reset simulation to initial state."""
    try:
        result = simulator.reset()
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/relief/elevation', methods=['GET'])
def get_elevation_data():
    """Get elevation data for relief visualization."""
    try:
        sample_rate = int(request.args.get('sample_rate', 2))
        data = relief_provider.get_elevation_data(sample_rate=sample_rate)
        bounds = relief_provider.get_bounds()
        return jsonify({
            'elevation_data': data,
            'bounds': bounds
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/relief/hillshade', methods=['GET'])
def get_hillshade_data():
    """Get hillshade data for relief visualization."""
    try:
        sample_rate = int(request.args.get('sample_rate', 2))
        azimuth = float(request.args.get('azimuth', 315.0))
        altitude = float(request.args.get('altitude', 45.0))
        data = relief_provider.get_hillshade_data(
            sample_rate=sample_rate,
            azimuth=azimuth,
            altitude=altitude
        )
        return jsonify({'hillshade_data': data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/relief/contours', methods=['GET'])
def get_contour_lines():
    """Get contour lines for elevation visualization."""
    try:
        levels_param = request.args.get('levels')
        if levels_param:
            levels = [float(x) for x in levels_param.split(',')]
        else:
            levels = None
        contours = relief_provider.get_contour_lines(levels=levels)
        return jsonify({'contours': contours})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/relief/elevation-at', methods=['GET'])
def get_elevation_at_point():
    """Get elevation at specific lat/lon point."""
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
        elevation = relief_provider.get_elevation_at(lat, lon)
        return jsonify({'lat': lat, 'lon': lon, 'elevation': elevation})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # Create static directory if it doesn't exist
    os.makedirs('static', exist_ok=True)
    
    print("Starting Urban Climate Simulator Server...")
    print("Open http://localhost:5000 in your browser")
    app.run(debug=True, port=5000)

