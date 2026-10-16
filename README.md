# Dhaka Traffic Prediction & Congestion Bypass Machine

An intelligent traffic prediction, road network mapping, and alternative route advisory system combining **OpenStreetMap (Overpass API)** for real road topology and **TomTom Routing & Traffic API** with a multi-key rotating pool.

---

## 📁 Repository Structure

```
Traffic-Prediction/
│
├── .env                         # API Keys (TomTom Multi-Key Pool & Weather)
├── requirements.txt             # Python project dependencies
├── README.md                    # Project documentation & usage guide
├── Prsent_Task.md               # Team task allocations
│
├── src/                         # Core Machine Engine
│   ├── __init__.py              # Core package initialization
│   ├── collect_data.py          # Unified Collector (TomTom Key Pool + OSM Road Topology + Weather)
│   ├── fetch_roads.py           # Overpass API client for fetching OSM road network
│   ├── route_advisor.py         # Excessive Jam Alternative Route Suggester & Bypass Engine
│   └── generate_history.py      # Historical traffic synthesizer for bootstrap ML training
│
├── data/                        # Datasets & Graph Topology
│   ├── dhaka_roads.geojson      # OSM road segments with geometries, lane counts & tags
│   └── traffic_data.csv         # Structured dataset for Machine Learning models
│
└── tools/                       # Utilities & Diagnostic Dashboards
    ├── show_traffic.py          # Live auto-refreshing terminal traffic dashboard
    ├── show_roads.py            # Interactive OSM road network browser
    ├── analyze_geojson.py       # GeoJSON properties & highway coverage inspector
    ├── test_tomtom_key.py       # TomTom API key pool validator & quota calculator
    └── test_weather_key.py      # OpenWeatherMap API key verification
```

---

## 🔑 TomTom Multi-Key Pool Architecture

The system features an automated **Key Pool Manager** (`TomTomKeyPool`):
- **Pool Capacity**: 3 Active Keys = **7,500 requests / day** (2,500 per key).
- **Round-Robin Rotation**: Distributes queries evenly across all keys to prevent quota exhaustion.
- **Failover & Cooldown**: Automatically pauses any key that encounters HTTP `429` (rate limit) or `403` (quota exhausted) and immediately fails over to the next active key.

Configure your keys in `.env`:
```env
TOMTOM_API_KEYS=key1,key2,key3
OPENWEATHERMAP_API_KEY=your_weather_key
```

To test and verify the key pool health:
```bash
py -3 tools/test_tomtom_key.py
```

---

## 🗺️ OpenStreetMap + TomTom Integration

1. **OpenStreetMap Overpass API (`data/dhaka_roads.geojson`)**:
   - Provides physical infrastructure features: OSM Way ID, road classification (`highway`), lane count (`lanes`), directionality (`oneway`), and geometry length.
2. **TomTom Traffic API**:
   - Provides dynamic traffic state: real-time travel time, free-flow baseline, traffic delay, speed (km/h), and congestion ratio.
3. **Unified Machine Learning Dataset (`data/traffic_data.csv`)**:
   - Stores 34 features per record: physical infrastructure (OSM), live traffic metrics (TomTom), temporal context (rush hour, day of week), weather, and lag memory buffers (`prev_traffic_5min`, `prev_speed_5min`, etc.).

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
When excessive traffic jams or severe delays occur, the Route Advisor evaluates native TomTom alternatives and candidate OSM bypass waypoints (Elevated Expressway, Kalshi Flyover, Hatirjheel, etc.) to calculate exact travel time savings:
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
