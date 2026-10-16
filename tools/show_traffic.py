"""
Live Traffic Dashboard
========================
Collects a fresh snapshot every N seconds and displays it
in a live-refreshing terminal table using the TomTom multi-key pool.

Run:
    py -3 tools/show_traffic.py              (refresh every 60 seconds)
    py -3 tools/show_traffic.py --once       (show once and exit)
    py -3 tools/show_traffic.py --interval 30 (refresh every 30 seconds)
"""

import os
import sys
import time
import datetime
import requests

# Resolve Project Root Directory
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Optional: load .env
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BASE_DIR, ".env"))
except ImportError:
    pass

import pandas as pd
import numpy as np

# Import Key Pool from core package
try:
    from src.collect_data import KEY_POOL, ROUTES, get_live_weather
except ImportError:
    KEY_POOL = None
    ROUTES = []

DATA_DIR = os.path.join(BASE_DIR, "data")
CSV_PATH = os.path.join(DATA_DIR, "traffic_data.csv")
REFRESH_S = 60  # seconds between refreshes

# Fallback routes if import fails
if not ROUTES:
    ROUTES = [
        {"route_id": "Mirpur 10 -> Farmgate", "origin_coords": (23.8069, 90.3687), "dest_coords": (23.7570, 90.3888), "road_length_km": 8.5, "free_flow_time_min": 15.0},
        {"route_id": "Uttara -> Mohakhali", "origin_coords": (23.8759, 90.3795), "dest_coords": (23.7776, 90.4054), "road_length_km": 14.2, "free_flow_time_min": 22.0},
        {"route_id": "Savar -> Dhanmondi", "origin_coords": (23.8467, 90.2575), "dest_coords": (23.7533, 90.3769), "road_length_km": 24.5, "free_flow_time_min": 35.0},
    ]


def get_traffic(route, now, weather_label):
    o = route["origin_coords"]
    d = route["dest_coords"]
    ff = route["free_flow_time_min"]
    km = route["road_length_km"]

    api_key = KEY_POOL.get_next_key() if KEY_POOL and KEY_POOL.total_keys > 0 else os.getenv("TOMTOM_API_KEY", "")
    if api_key:
        try:
            url = f"https://api.tomtom.com/routing/1/calculateRoute/{o[0]},{o[1]}:{d[0]},{d[1]}/json"
            params = {
                "key": api_key,
                "traffic": "true",
                "travelMode": "car",
                "computeTravelTimeFor": "all"
            }
            res = requests.get(url, params=params, timeout=7)
            if KEY_POOL:
                KEY_POOL.record_result(api_key, res.status_code)
            if res.status_code == 200:
                summary = res.json()["routes"][0]["summary"]
                tt_sec = summary.get("travelTimeInSeconds")
                if tt_sec:
                    no_traffic = summary.get("noTrafficTravelTimeInSeconds") or max(tt_sec - summary.get("trafficDelayInSeconds", 0), ff * 60)
                    tt_min = round(tt_sec / 60, 1)
                    ff_min = round(no_traffic / 60, 1)
                    dist_km = round(summary.get("lengthInMeters", km * 1000) / 1000, 1)
                    speed = round(dist_km / max(tt_min / 60, 0.01), 1)
                    ratio = tt_min / max(ff_min, 1)
                    level = "NORMAL" if ratio < 1.25 else ("SLOW" if ratio < 1.75 else "TRAFFIC_JAM")
                    delay_min = max(0.0, round(tt_min - ff_min, 1))
                    return tt_min, ff_min, dist_km, speed, level, delay_min
        except Exception:
            if KEY_POOL:
                KEY_POOL.record_result(api_key, 0)

    # Simulation fallback
    hour = now.hour + now.minute / 60
    is_wd = now.weekday() not in [4, 5]
    rf = 1.0
    if is_wd:
        if 8 <= hour <= 10.5:   rf = 2.4 + np.random.uniform(-0.3, 0.5)
        elif 17 <= hour <= 21:  rf = 2.7 + np.random.uniform(-0.3, 0.6)
        elif 12 <= hour <= 15:  rf = 1.5 + np.random.uniform(-0.2, 0.3)
        else:                   rf = 1.0 + np.random.uniform(0.0, 0.2)
    else:
        rf = 1.6 + np.random.uniform(-0.2, 0.3) if 16 <= hour <= 21 else 1.0 + np.random.uniform(0.0, 0.15)

    wf = 1.5 + np.random.uniform(0.1, 0.3) if weather_label == "Heavy Rain" else 1.2 + np.random.uniform(0.05, 0.15) if weather_label == "Light Rain" else 1.0

    tt = round(ff * rf * wf, 1)
    spd = round(km / max(tt / 60, 0.01), 1)
    ratio = tt / max(ff, 0.1)
    level = "NORMAL" if ratio < 1.3 else ("SLOW" if ratio < 1.8 else "TRAFFIC_JAM")
    delay_min = max(0.0, round(tt - ff, 1))
    return tt, ff, km, spd, level, delay_min


def render_dashboard(once=False, interval=REFRESH_S):
    try:
        while True:
            now = datetime.datetime.now()
            print("\n" + "=" * 105)
            print(f"  DHAKA LIVE TRAFFIC DASHBOARD | {now.strftime('%Y-%m-%d %H:%M:%S')}")
            key_count = KEY_POOL.total_keys if KEY_POOL else 1
            print(f"  TomTom Key Pool: {key_count} Keys Active | Auto-Refresh: {interval}s")
            print("=" * 105)
            print(f"{'#':<3} | {'Route':<32} | {'Length':<8} | {'Live Time':<10} | {'Delay':<8} | {'Speed':<10} | {'Traffic Level'}")
            print("-" * 105)

            for idx, route in enumerate(ROUTES[:25], 1):
                w_info = get_live_weather(route["origin_coords"][0], route["origin_coords"][1]) if "get_live_weather" in globals() else {"weather": "Clear"}
                tt, ff, dist, spd, lvl, delay = get_traffic(route, now, w_info["weather"])
                delay_str = f"+{delay:.1f}m" if delay > 0 else "0.0m"
                print(f"{idx:<3} | {route['route_id']:<32} | {dist:<5.1f} km | {tt:<6.1f} min | {delay_str:<8} | {spd:<6.1f}km/h | {lvl:<11}")

            print("-" * 105)
            if once:
                break
            print(f"Next refresh in {interval} seconds... (Press Ctrl+C to stop)")
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nDashboard stopped.")


def main():
    once = "--once" in sys.argv
    interval = REFRESH_S
    for arg in sys.argv[1:]:
        if arg.startswith("--interval"):
            try:
                interval = int(arg.split("=")[1] if "=" in arg else sys.argv[sys.argv.index(arg) + 1])
            except Exception:
                pass
    render_dashboard(once=once, interval=interval)


if __name__ == "__main__":
    main()
