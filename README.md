# Dhaka Traffic Prediction & Congestion Bypass Machine

An AI-driven real-time traffic prediction and congestion bypass application for Greater Dhaka. Combines Google Maps Routes API v2, Waze Live crowdsourced probes, OpenWeatherMap real-time weather telemetry, and OpenStreetMap road topologies.

---

## 📁 Project Architecture & Clean Folder Structure

```
Traffic-Prediction/
├── frontend/                          # 🌐 React 19 + Vite Frontend Application
│   ├── public/                        # Static assets (favicons, icons)
│   ├── src/                           # Pure React source code
│   │   ├── assets/                    # Images and logos
│   │   ├── components/                # UI components (Predictor, Map, KPIs, etc.)
│   │   │   ├── TrafficJourneyPredictor.jsx # Primary Day/Date, Time, From, To predictor
│   │   │   ├── JourneyRouteMap.jsx    # Interactive Leaflet route topology visualizer
│   │   │   ├── TrafficMap.jsx         # Full Dhaka 50 corridors map
│   │   │   ├── MetricsOverview.jsx    # Network stats & KPIs
│   │   │   ├── RoutesList.jsx         # Corridors explorer (R01-R50)
│   │   │   ├── RouteAdvisor.jsx       # Jam bypass advisor
│   │   │   ├── PredictorView.jsx      # What-If ML simulator
│   │   │   ├── HistoryAnalytics.jsx   # Dataset explorer
│   │   │   └── Navbar.jsx             # Top bar with live weather & engine status
│   │   ├── utils/                     # Client-side route matching & prediction engine
│   │   │   ├── journeyPredictor.js    # Subpath extractor, BFS pathfinding & delay model
│   │   │   └── dhakaRoutesData.js     # 128 Dhaka nodes & 50 official corridors
│   │   ├── api.js                     # Frontend API service connecting to backend
│   │   ├── App.jsx                    # Root application component
│   │   └── main.jsx                   # Vite entry point
│   ├── index.html                     # HTML root template
│   ├── vite.config.js                 # Vite + Tailwind v4 + proxy configuration
│   └── package.json                   # Frontend npm metadata
│
├── server/                            # 🚀 Node.js Express API Backend
│   ├── index.js                       # Express server (port 5000)
│   ├── trafficService.js              # Traffic simulation, delay modeling & corridor resolver
│   ├── routesConfig.js                # JS registry of 128 Dhaka nodes & 50 official routes
│   └── apiClients.js                  # Google Maps multi-key pool & OpenWeather client
│
├── data_collection/                   # 🐍 Python Data Gathering & Scraper Pipeline
│   ├── collect_data.py                # Live traffic data collector (Google / Waze / OpenWeather)
│   ├── traffic_clients.py             # Dual traffic client classes (Google + Waze)
│   ├── route_advisor.py               # Alternative bypass & congestion CLI advisor
│   ├── routes_config.py               # 50 Dhaka commuter corridors & GPS coordinates
│   ├── fetch_roads.py                 # Overpass OSM road topology extractor
│   ├── generate_history.py            # Historical dataset synthesizer
│   ├── unified_call.py                # CLI runner for traffic clients
│   ├── requirements.txt               # Python package dependencies
│   └── README.md                      # Python scripts documentation
│
├── data/                              # 📊 Datasets & Topologies
│   ├── traffic_data.csv               # Historical & real-time collected telemetry
│   ├── traffic_prediction_routes.csv  # 50 Official Dhaka Corridors (R01 to R50)
│   └── dhaka_roads.geojson            # OpenStreetMap Dhaka road topologies
│
├── .env                               # API keys (Google Maps & OpenWeatherMap)
├── .gitignore                         # Exclusions (node_modules, dist, .env)
└── package.json                       # Root package.json with unified execution scripts
```

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
# Node.js dependencies
npm install

# Python dependencies (for data collection pipeline)
pip install -r data_collection/requirements.txt
```

### 2. Configure API Keys (`.env`)
Create or edit `.env` in the root directory:
```env
# Google Maps Routes API v2 (supports multi-key pooling separated by comma)
GOOGLE_MAPS_API_KEYS=YOUR_GOOGLE_KEY_1,YOUR_GOOGLE_KEY_2
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_KEY_1

# OpenWeatherMap API Key
OPENWEATHERMAP_API_KEY=YOUR_OPENWEATHER_KEY
```

### 3. Run the Entire System
```bash
# Starts both the Node.js API server (port 5000) and React Vite (port 3000)
npm run dev:all
```

Or run services individually:
- **Frontend only**: `npm run dev` (opens on `http://localhost:3000`)
- **Backend API only**: `npm run server` (runs on `http://localhost:5000`)
- **Production Build**: `npm run build` (builds frontend to `dist/`)
- **Run Python Data Collector**: `npm run data:collect`
- **Run Python Route Advisor CLI**: `npm run data:advisor`
