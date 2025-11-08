# Urban Climate Simulator 🌡️

Eine interaktive Web-Anwendung, die zeigt, wie die Entfernung von Beton/Asphalt und das Hinzufügen von Grün- oder Wasserflächen die lokale Temperatur senkt und wie Gebäude die Windgeschwindigkeit beeinflussen.

## Features

- **Temperatur-Simulation**: Visualisierung der Temperaturänderungen durch verschiedene Interventionen
- **Wind-Simulation**: Darstellung der Windgeschwindigkeit und -richtung, beeinflusst durch Gebäude
- **Interaktive Karte**: Klicke auf die Karte, um Interventionen hinzuzufügen
- **Echtzeit-Feedback**: Sofortige Anzeige der Auswirkungen auf Temperatur und Wind

## Installation

1. Python 3.8+ installieren (auf macOS meist bereits vorhanden)

2. Virtuelle Umgebung erstellen und aktivieren:
```bash
python3 -m venv venv
source venv/bin/activate
```

3. Abhängigkeiten installieren:
```bash
pip install -r requirements.txt
```

## Verwendung

1. Virtuelle Umgebung aktivieren (falls nicht bereits aktiv):
```bash
source venv/bin/activate
```

2. Server starten:
```bash
python server.py
```

Oder verwende das Start-Skript:
```bash
./start.sh
```

3. Browser öffnen und zu `http://localhost:5000` navigieren

4. Interventionen hinzufügen:
   - **Park hinzufügen** 🌳: Reduziert die Temperatur um ~2°C
   - **Wasserfläche hinzufügen** 💧: Reduziert die Temperatur um ~3°C
   - **Asphalt entfernen** 🚫: Reduziert den Urban Heat Island Effekt
   - **Gebäude hinzufügen** 🏢: Beeinflusst Windgeschwindigkeit (Windschatten & Kanalisierung)
   - **Gebäude entfernen** 🗑️: Entfernt Windeffekte

## Technologie-Stack

- **Backend**: Python (Flask)
- **Simulation**: NumPy für numerische Berechnungen
- **Frontend**: HTML, JavaScript
- **Kartenvisualisierung**: Leaflet.js
- **Heatmap**: Leaflet.heat Plugin

## Projektstruktur

```
Skyforge/
├── server.py              # Flask-Server
├── simulation.py          # Simulationslogik
├── requirements.txt       # Python-Abhängigkeiten
├── README.md             # Diese Datei
└── static/
    ├── index.html        # Haupt-HTML-Seite
    ├── app.js           # Frontend-JavaScript
    └── style.css        # Styling
```

## Simulation-Details

### Temperatur-Effekte

- **Grünfläche/Park**: -2.0°C (erhöht Evapotranspiration)
- **Wasserfläche**: -3.0°C (hohe Wärmekapazität)
- **Asphalt entfernen**: +1.0°C (reduziert UHI-Effekt)
- **Asphalt hinzufügen**: +2.5°C (erhöht Wärmespeicherung)
- **Gebäude**: +1.5°C (zusätzliche Wärme)

### Wind-Effekte

- **Gebäude hinzufügen**:
  - Windschatten: 50% Reduzierung der Windgeschwindigkeit hinter dem Gebäude
  - Kanalisierung: 30% Erhöhung der Windgeschwindigkeit an den Seiten

## Erweiterte Nutzung (ERA5-Daten)

Für echte Wetterdaten können ERA5-Daten von der CDS-API abgerufen werden:

```python
# Installation: pip install cdsapi
import cdsapi

c = cdsapi.Client()
c.retrieve(
    'reanalysis-era5-single-levels',
    {
        'product_type': 'reanalysis',
        'variable': ['2m_temperature', '10m_u_component_of_wind', '10m_v_component_of_wind'],
        'year': '2023',
        'month': '07',
        'day': '20',
        'time': '14:00',
        'area': [52.6, 13.3, 52.4, 13.6],  # Berlin Region
        'format': 'netcdf',
    },
    'base_weather_berlin.nc')
```

**Hinweis**: Die aktuelle Implementierung verwendet Mock-Daten für die Demonstration. Für Produktionsnutzung sollten echte ERA5-Daten integriert werden.

## Lizenz

Dieses Projekt wurde für einen Hackathon erstellt.

