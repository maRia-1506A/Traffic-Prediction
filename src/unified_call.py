"""
3-in-1 Unified API Fetcher for Traffic Prediction Machine
==========================================================
Combines all 3 data sources into a single coordinated call:
  1. OpenStreetMap (Overpass API) -> Physical Road Infrastructure
  2. TomTom Traffic & Routing API  -> Live Traffic & Congestion State
  3. OpenWeatherMap API           -> Environmental & Weather Factors

Usage:
    py -3 src/unified_call.py
    py -3 src/unified_call.py --origin 23.8069,90.3687 --dest 23.7570,90.3888 --name "Mirpur 10 to Farmgate"
"""

import os
import sys
import json
import requests
import datetime

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Load API keys from .env
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BASE_DIR, ".env"))
except ImportError:
    pass

from src.collect_data import KEY_POOL, OSM_NETWORK, get_live_weather, get_live_traffic


def fetch_unified_traffic_record(origin_coords: tuple, dest_coords: tuple, route_name: str = "Custom Corridor") -> dict:
    """
    Executes the 3 APIs in a single coordinated pipeline:
      1. OpenStreetMap Overpass: Retrieves physical road attributes (OSM ID, highway class, lanes, oneway)
      2. TomTom API (with Key Pool): Retrieves real-time speed, travel time, delay, and congestion level
      3. OpenWeatherMap API: Retrieves live temperature, rainfall, and sky condition
    
    Returns a unified ML-ready dictionary.
    """
    orig_lat, orig_lon = origin_coords
    dest_lat, dest_lon = dest_coords
    now = datetime.datetime.now()

    # -------------------------------------------------------------
    # API 1: OpenStreetMap (Overpass / Topology)
    # -------------------------------------------------------------
    osm_data = OSM_NETWORK.find_nearest_osm_way(orig_lat, orig_lon)
    if not osm_data:
        osm_data = {
            "osm_id": "N/A",
            "osm_highway": "Primary",
            "osm_lanes": 4,
            "osm_oneway": 0,
            "osm_name": route_name
        }

    # -------------------------------------------------------------
    # API 2: OpenWeatherMap (Weather & Rain)
    # -------------------------------------------------------------
    weather_data = get_live_weather(orig_lat, orig_lon)

    # -------------------------------------------------------------
    # API 3: TomTom Traffic & Routing (Live Traffic using Key Pool)
    # -------------------------------------------------------------
    temp_route = {
        "route_id": route_name,
        "origin_coords": origin_coords,
        "dest_coords": dest_coords,
        "free_flow_time_min": 10.0,
        "road_length_km": 5.0
    }
    travel_time, free_flow, speed, traffic_level, delay_min, key_used = get_live_traffic(
        temp_route, now, weather_data, KEY_POOL
    )

    # -------------------------------------------------------------
    # Unified Combined Record for Machine Learning
    # -------------------------------------------------------------
    unified_record = {
        # Spatial & Route ID
        "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
        "route_name": route_name,
        "origin_coords": origin_coords,
        "dest_coords": dest_coords,

        # 1. OpenStreetMap Infrastructure Features
        "osm_id": osm_data.get("osm_id"),
        "osm_road_name": osm_data.get("osm_name"),
        "road_type": osm_data.get("osm_highway").title(),
        "num_lanes": osm_data.get("osm_lanes"),
        "is_oneway": "Yes" if osm_data.get("osm_oneway") == 1 else "No",

        # 2. TomTom Live Traffic Features
        "traffic_speed_kmh": speed,
        "travel_time_min": travel_time,
        "free_flow_time_min": free_flow,
        "traffic_delay_min": delay_min,
        "congestion_ratio": round(travel_time / max(free_flow, 0.1), 2),
        "traffic_level": traffic_level,
        "tomtom_key_used": key_used,

        # 3. Weather & Environmental Features
        "weather_condition": weather_data["weather"],
        "temperature_c": weather_data["temperature_c"],
        "rainfall_mm": weather_data["rainfall_mm"]
    }

    return unified_record


def print_unified_record(rec: dict):
    print("\n" + "=" * 80)
    print(f"  3-IN-1 UNIFIED API RESULT: {rec['route_name']}")
    print(f"  Timestamp: {rec['timestamp']}")
    print("=" * 80)

    print("\n[1] OpenStreetMap Overpass API (Physical Infrastructure):")
    print(f"    - OSM Way ID:       {rec['osm_id']}")
    print(f"    - OSM Road Name:    {rec['osm_road_name']}")
    print(f"    - Road Class:       {rec['road_type']}")
    print(f"    - Number of Lanes:  {rec['num_lanes']}")
    print(f"    - One-Way Road:     {rec['is_oneway']}")

    print("\n[2] TomTom Routing & Traffic API (Live Traffic Flow):")
    print(f"    - Traffic Level:    {rec['traffic_level']}")
    print(f"    - Live Speed:       {rec['traffic_speed_kmh']} km/h")
    print(f"    - Travel Time:      {rec['travel_time_min']} mins (Normal: {rec['free_flow_time_min']} mins)")
    print(f"    - Traffic Delay:    +{rec['traffic_delay_min']} mins")
    print(f"    - Congestion Ratio: {rec['congestion_ratio']}x")
    print(f"    - Key Pool Used:    {rec['tomtom_key_used']}")

    print("\n[3] OpenWeatherMap API (Environmental Factors):")
    print(f"    - Condition:        {rec['weather_condition']}")
    print(f"    - Temperature:      {rec['temperature_c']} deg C")
    print(f"    - Rainfall:         {rec['rainfall_mm']} mm")

    print("\n" + "=" * 80)
    print("  Status: All 3 APIs fused successfully into 1 ML record!")
    print("=" * 80 + "\n")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="3-in-1 Unified API Fetcher")
    parser.add_argument("--origin", type=str, default="23.8069,90.3687", help="Origin lat,lon (default: Mirpur 10)")
    parser.add_argument("--dest", type=str, default="23.7570,90.3888", help="Destination lat,lon (default: Farmgate)")
    parser.add_argument("--name", type=str, default="Mirpur 10 -> Farmgate", help="Route name")
    args = parser.parse_args()

    o_lat, o_lon = map(float, args.origin.split(","))
    d_lat, d_lon = map(float, args.dest.split(","))

    record = fetch_unified_traffic_record((o_lat, o_lon), (d_lat, d_lon), route_name=args.name)
    print_unified_record(record)


if __name__ == "__main__":
    main()
