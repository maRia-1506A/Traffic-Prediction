# Dhaka Traffic Prediction & Congestion Bypass Machine

An intelligent traffic prediction, road network mapping, and alternative route advisory system combining **OpenStreetMap (Overpass API)** for real road topology, live weather, and dynamic machine learning features.

---

## 📁 Repository Structure

```
Traffic-Prediction/
│
├── .env                         # API Keys (Weather)
├── requirements.txt             # Python project dependencies
├── README.md                    # Project documentation & usage guide
├── Prsent_Task.md               # Team task allocations
│
├── src/                         # Core Machine Engine
│   ├── __init__.py              # Core package initialization
│   ├── collect_data.py          # Unified Collector (OSM Road Topology + Weather)
│   ├── fetch_roads.py           # Overpass API client for fetching OSM road network
│   ├── route_advisor.py         # Excessive Jam Alternative Route Suggester & Bypass Engine
│   ├── routes_config.py         # 50 official corridor definitions and GPS coordinates
│   ├── unified_call.py          # 3-in-1 unified data fusion pipeline
│   └── generate_history.py      # Historical traffic synthesizer for bootstrap ML training
│
├── data/                        # Datasets & Graph Topology
│   ├── dhaka_roads.geojson      # OSM road segments with geometries, lane counts & tags
│   ├── traffic_prediction_routes.csv # 50 official corridor paths
│   └── traffic_data.csv         # Structured dataset for Machine Learning models
│
└── tools/                       # Utilities & Diagnostic Dashboards
    ├── show_traffic.py          # Live auto-refreshing terminal traffic dashboard
    ├── show_roads.py            # Interactive OSM road network browser
    ├── analyze_geojson.py       # GeoJSON properties & highway coverage inspector
    └── test_weather_key.py      # OpenWeatherMap API key verification
```

---

## 🗺️ OpenStreetMap & Physical Infrastructure Integration

1. **OpenStreetMap Overpass API (`data/dhaka_roads.geojson`)**:
   - Provides physical infrastructure features: OSM Way ID, road classification (`highway`), lane count (`lanes`), directionality (`oneway`), and geometry length.
2. **Dynamic Traffic Engine**:
   - Computes dynamic traffic state: travel time, free-flow baseline, traffic delay, speed (km/h), and congestion ratio.
3. **Unified Machine Learning Dataset (`data/traffic_data.csv`)**:
   - Stores 43 features per record: physical infrastructure (OSM), traffic metrics, temporal context (rush hour, day of week), weather, and lag memory buffers (`prev_traffic_5min`, `prev_speed_5min`, etc.).

---

## 🚀 How to Run

### 1. Collect Real-Time Training Data
- **One-shot snapshot across commuter corridors**:
  ```bash
  py -3 src/collect_data.py
  ```
- **Continuous 24/7 background collector (e.g. every 10 mins)**:
  ```bash
  py -3 src/collect_data.py --loop --interval 10
  ```
- **Collect directly for major OpenStreetMap road segments**:
  ```bash
  py -3 src/collect_data.py --source osm --limit 50
  ```

### 2. Suggest Alternative Routes on Excessive Jam
When excessive traffic jams or severe delays occur, the Route Advisor evaluates candidate OSM bypass waypoints (Elevated Expressway, Kalshi Flyover, Hatirjheel, etc.) to calculate exact travel time savings:
- **Check a specific route**:
  ```bash
  py -3 src/route_advisor.py --route "Mirpur 10 -> Farmgate"
  ```
- **Custom Origin and Destination coordinates**:
  ```bash
  py -3 src/route_advisor.py --origin 23.8069,90.3687 --dest 23.7570,90.3888
  ```
- **Adjust delay sensitivity threshold (minutes)**:
  ```bash
  py -3 src/route_advisor.py --route "Uttara -> Mohakhali" --threshold 2.0
  ```

### 3. Monitoring & Dashboards
- **Live Terminal Traffic Dashboard**:
  ```bash
  py -3 tools/show_traffic.py
  ```
- **Inspect OpenStreetMap Road Network**:
  ```bash
  py -3 tools/show_roads.py --named
  ```
- **Analyze GeoJSON Road Coverage**:
  ```bash
  py -3 tools/analyze_geojson.py
  ```
