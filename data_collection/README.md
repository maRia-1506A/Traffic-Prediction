# Dhaka Traffic Data Collection & Offline ML Pipeline

This directory contains the Python data collection engine, road topology fetchers, and alternative bypass algorithms.

## Scripts Overview

1. **`collect_data.py`**:
   - Fetches live traffic conditions across all 50 official Dhaka commuter corridors (`R01` to `R50`).
   - Uses Google Maps Routes API v2 with multi-key rotation and Waze Live backup.
   - Collects live weather metrics via OpenWeatherMap API (with Open-Meteo fallback).
   - Appends records to `../data/traffic_data.csv`.
   - **Usage**:
     ```bash
     python data_collection/collect_data.py --continuous --interval 300
     ```

2. **`route_advisor.py`**:
   - CLI engine that evaluates excessive congestion and computes OpenStreetMap flyover/expressway bypasses.
   - **Usage**:
     ```bash
     python data_collection/route_advisor.py --route R06
     ```

3. **`fetch_roads.py`**:
   - Queries OpenStreetMap Overpass API for Greater Dhaka road networks (motorways, primary, secondary, trunks, flyovers, expressways).
   - Generates `../data/dhaka_roads.geojson`.
   - **Usage**:
     ```bash
     python data_collection/fetch_roads.py
     ```

4. **`generate_history.py`**:
   - Generates synthetic realistic historical traffic data for training and offline analytics in `../data/traffic_data.csv`.

5. **`traffic_clients.py`**:
   - Core API client classes for Google Maps Routes API (`GoogleRoutesClient`), Waze Live (`WazeTrafficClient`), and Dual-Engine Fusion (`DualTrafficEngine`).

6. **`routes_config.py`**:
   - GPS coordinate registry of 128 Dhaka strategic nodes and 50 official corridor path definitions.

## Installation & Setup

Install the required Python packages:
```bash
pip install -r data_collection/requirements.txt
```

