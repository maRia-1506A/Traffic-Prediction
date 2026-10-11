# Traffic Prediction System

A machine learning-based traffic prediction system designed to collect, process, and forecast real-time traffic levels, travel durations, and road congestion using live geospatial and meteorological data.

---

## 🚦 Data Sources & APIs

### 1. TomTom Routing & Traffic API (Live Traffic)
- **Service**: [TomTom Routing API (Calculate Route)](https://developer.tomtom.com/routing-api/documentation/routing/calculate-route)
- **Features Used**:
  - Real-time travel time with live traffic delays (`traffic=true`, `computeTravelTimeFor=all`)
  - Free-flow / base travel time without delays (`noTrafficTravelTimeInSeconds`)
  - Route distance and actual live speed (`traffic_speed_kmh`)
  - Congestion ratio and traffic level classification (`NORMAL`, `SLOW`, `TRAFFIC_JAM`)
- **Fallback**: Calibrated Dhaka traffic simulation model if the key is missing or quota is reached.

### 2. OpenWeatherMap API (Weather Data)
- **Service**: [OpenWeatherMap Current Weather Data](https://openweathermap.org/current)
- **Features Used**:
  - Live temperature (°C)
  - Rainfall / precipitation volume (mm)
  - Atmospheric conditions (`Clear`, `Cloudy`, `Fog`, `Light Rain`, `Heavy Rain`)
- **Fallback**: Open-Meteo API (100% free, requires no API key).

---

## 🛠️ Setup & Installation

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure API Keys
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Open `.env` and insert your API keys:
```env
# TomTom Routing & Traffic API Key (https://developer.tomtom.com/)
TOMTOM_API_KEY=your_tomtom_api_key_here

# OpenWeatherMap API Key (https://openweathermap.org/api)
OPENWEATHERMAP_API_KEY=your_openweathermap_api_key_here
```

---

## 🚀 Running Data Collection

To collect a snapshot of current traffic and weather conditions across configured routes:

```bash
python src/collect_data.py
```

Collected data is saved to `data/traffic_data.csv` with the following feature set:
- `timestamp`, `road_route_id`, `latitude`, `longitude`
- `traffic_speed_kmh`, `travel_time_min`, `free_flow_time_min`, `traffic_level`
- `day_of_week`, `hour`, `is_weekend`
- `weather`, `temperature_c`, `rainfall_mm`
- `road_type`, `road_length_km`, `num_lanes`
- `accident_incident`, `road_construction`, `special_event`
- `prev_traffic_5min`, `prev_traffic_15min`, `prev_traffic_30min`
