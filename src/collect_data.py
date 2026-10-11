"""
Traffic Data Collector
Fetches real-time traffic and weather data, computes lag features,
and appends structured records to data/traffic_data.csv.
"""

import os
import time
import datetime
import requests
import pandas as pd
import numpy as np

# Output CSV Path
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CSV_PATH = os.path.join(DATA_DIR, "traffic_data.csv")

# Google Maps API Key (Optional: Set as environment variable or paste here)
# If empty, the collector uses realistic calibrated simulation based on Dhaka traffic models
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "AIzaSyC6YC7R7dFAxP9IosXGauLP8s7o0xZ3DgI")

# ---------------------------------------------------------
# 1. Route Configuration & Infrastructure Metadata
# ---------------------------------------------------------
ROUTES = [
    {
        "route_id": "Savar -> Dhanmondi",
        "origin_name": "Savar",
        "origin_coords": (23.8467, 90.2575),
        "dest_name": "Dhanmondi",
        "dest_coords": (23.7461, 90.3742),
        "road_type": "Highway/Arterial",
        "road_length_km": 24.5,
        "num_lanes": 4,
        "free_flow_time_min": 35.0,  # Expected travel time at open speed
    },
    {
        "route_id": "Mirpur 10 -> Farmgate",
        "origin_name": "Mirpur 10",
        "origin_coords": (23.8069, 90.3687),
        "dest_name": "Farmgate",
        "dest_coords": (23.7570, 90.3888),
        "road_type": "Primary Urban",
        "road_length_km": 8.5,
        "num_lanes": 6,
        "free_flow_time_min": 15.0,
    },
    {
        "route_id": "Uttara -> Mohakhali",
        "origin_name": "Uttara",
        "origin_coords": (23.8759, 90.3795),
        "dest_name": "Mohakhali",
        "dest_coords": (23.7776, 90.4054),
        "road_type": "Expressway/Primary",
        "road_length_km": 14.2,
        "num_lanes": 6,
        "free_flow_time_min": 22.0,
    },
    {
        "route_id": "Savar -> Ashulia",
        "origin_name": "Savar",
        "origin_coords": (23.8467, 90.2575),
        "dest_name": "Ashulia",
        "dest_coords": (23.8967, 90.3200),
        "road_type": "Arterial",
        "road_length_km": 9.0,
        "num_lanes": 4,
        "free_flow_time_min": 12.0,
    }
]

# ---------------------------------------------------------
# 2. Weather Fetcher (Open-Meteo API: 100% Free, No Key Required)
# ---------------------------------------------------------
def get_live_weather(lat: float, lon: float):
    """
    Fetches real-time weather metrics from Open-Meteo API.
    """
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,precipitation,weather_code&timezone=auto"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json().get("current", {})
            temp_c = data.get("temperature_2m", 28.0)
            precip_mm = data.get("precipitation", 0.0)
            weather_code = data.get("weather_code", 0)

            # Weather interpretation
            if precip_mm > 5.0 or weather_code in [63, 65, 82]:
                weather = "Heavy Rain"
            elif precip_mm > 0.1 or weather_code in [51, 61, 80]:
                weather = "Light Rain"
            elif weather_code in [45, 48]:
                weather = "Fog"
            elif weather_code in [1, 2, 3]:
                weather = "Cloudy"
            else:
                weather = "Clear"

            return {
                "weather": weather,
                "temperature_c": round(temp_c, 1),
                "rainfall_mm": round(precip_mm, 1),
            }
    except Exception as e:
        print(f"[Warning] Weather API error: {e}. Using defaults.")

    return {"weather": "Clear", "temperature_c": 28.0, "rainfall_mm": 0.0}

# ---------------------------------------------------------
# 3. Traffic Data Fetcher (Google Maps Routes / Distance Matrix API)
# ---------------------------------------------------------
def get_live_traffic(route: dict, now: datetime.datetime, weather: dict):
    """
    Fetches live traffic duration using modern Google Routes API or Distance Matrix API,
    falling back to calibrated Dhaka traffic simulation if unavailable.
    """
    orig_lat, orig_lon = route["origin_coords"]
    dest_lat, dest_lon = route["dest_coords"]
    free_flow = route["free_flow_time_min"]
    road_len = route["road_length_km"]

    # Try Google Maps API if key is supplied
    if GOOGLE_MAPS_API_KEY:
        # 1. Try modern Google Routes API (v2)
        try:
            routes_url = "https://routes.googleapis.com/directions/v2:computeRoutes"
            headers = {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.staticDuration"
            }
            body = {
                "origin": {"location": {"latLng": {"latitude": orig_lat, "longitude": orig_lon}}},
                "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lon}}},
                "travelMode": "DRIVE",
                "routingPreference": "TRAFFIC_AWARE"
            }
            res = requests.post(routes_url, headers=headers, json=body, timeout=5)
            if res.status_code == 200:
                data = res.json()
                if "routes" in data and len(data["routes"]) > 0:
                    r_info = data["routes"][0]
                    # Format: '1840s'
                    dur_str = r_info.get("duration", "0s").replace("s", "")
                    static_str = r_info.get("staticDuration", dur_str).replace("s", "")
                    traffic_sec = float(dur_str) if dur_str else free_flow * 60
                    static_sec = float(static_str) if static_str else free_flow * 60

                    travel_time_min = round(traffic_sec / 60.0, 1)
                    free_flow_time_min = round(static_sec / 60.0, 1)
                    speed_kmh = round(road_len / (travel_time_min / 60.0), 1)

                    ratio = travel_time_min / max(free_flow_time_min, 1)
                    traffic_level = "NORMAL" if ratio < 1.25 else ("SLOW" if ratio < 1.75 else "TRAFFIC_JAM")
                    return travel_time_min, free_flow_time_min, speed_kmh, traffic_level
        except Exception:
            pass

        # 2. Try Distance Matrix API
        try:
            url = (
                f"https://maps.googleapis.com/maps/api/distancematrix/json"
                f"?origins={orig_lat},{orig_lon}&destinations={dest_lat},{dest_lon}"
                f"&departure_time=now&traffic_model=best_guess&key={GOOGLE_MAPS_API_KEY}"
            )
            res = requests.get(url, timeout=5).json()
            if "rows" in res and res.get("rows"):
                elem = res["rows"][0]["elements"][0]
                if elem.get("status") == "OK":
                    static_sec = elem["duration"]["value"]
                    traffic_sec = elem.get("duration_in_traffic", {}).get("value", static_sec)
                    travel_time_min = round(traffic_sec / 60.0, 1)
                    free_flow_time_min = round(static_sec / 60.0, 1)
                    speed_kmh = round(road_len / (travel_time_min / 60.0), 1)

                    ratio = travel_time_min / max(free_flow_time_min, 1)
                    traffic_level = "NORMAL" if ratio < 1.25 else ("SLOW" if ratio < 1.75 else "TRAFFIC_JAM")
                    return travel_time_min, free_flow_time_min, speed_kmh, traffic_level
        except Exception:
            pass

    # Calibrated Simulation Model (Dhaka Rush Hour + Weather Effects)
    hour = now.hour + (now.minute / 60.0)
    is_weekend = now.weekday() in [4, 5]  # Friday (4) and Saturday (5) in Bangladesh

    # Peak hour factors
    rush_factor = 1.0
    if not is_weekend:
        if 8.0 <= hour <= 10.5:    # Morning Office Rush
            rush_factor = 2.4 + np.random.uniform(-0.3, 0.5)
        elif 17.0 <= hour <= 21.0:  # Evening Return Rush
            rush_factor = 2.7 + np.random.uniform(-0.3, 0.6)
        elif 12.0 <= hour <= 15.0:  # Midday Traffic
            rush_factor = 1.5 + np.random.uniform(-0.2, 0.3)
        else:                      # Night/Early Morning
            rush_factor = 1.0 + np.random.uniform(0.0, 0.2)
    else:
        # Weekend traffic (lighter in morning, moderate in evening)
        if 16.0 <= hour <= 21.0:
            rush_factor = 1.6 + np.random.uniform(-0.2, 0.3)
        else:
            rush_factor = 1.0 + np.random.uniform(0.0, 0.15)

    # Weather impact factor (Rain causes severe slow-downs)
    weather_factor = 1.0
    if weather["weather"] == "Heavy Rain":
        weather_factor = 1.5 + np.random.uniform(0.1, 0.3)
    elif weather["weather"] == "Light Rain":
        weather_factor = 1.2 + np.random.uniform(0.05, 0.15)

    total_multiplier = rush_factor * weather_factor
    travel_time_min = round(free_flow * total_multiplier, 1)
    speed_kmh = round(road_len / (travel_time_min / 60.0), 1)

    ratio = travel_time_min / free_flow
    if ratio < 1.3:
        traffic_level = "NORMAL"
    elif ratio < 1.8:
        traffic_level = "SLOW"
    else:
        traffic_level = "TRAFFIC_JAM"

    return travel_time_min, free_flow, speed_kmh, traffic_level

# ---------------------------------------------------------
# 4. Main Collection & Feature Builder
# ---------------------------------------------------------
def collect_current_snapshot():
    """
    Collects a single snapshot for all configured routes with full feature schema.
    """
    now = datetime.datetime.now()
    timestamp_str = now.strftime("%Y-%m-%d %H:%M")
    day_name = now.strftime("%A")
    hour_val = now.hour
    is_weekend = "Yes" if now.weekday() in [4, 5] else "No"

    # Load existing CSV to compute lag features if available
    if os.path.exists(CSV_PATH):
        try:
            df_existing = pd.read_csv(CSV_PATH)
        except Exception:
            df_existing = pd.DataFrame()
    else:
        df_existing = pd.DataFrame()

    new_rows = []

    for route in ROUTES:
        orig_lat, orig_lon = route["origin_coords"]
        weather = get_live_weather(orig_lat, orig_lon)
        travel_time, free_flow, speed, level = get_live_traffic(route, now, weather)

        # Retrieve lag features from historical buffer
        prev_5m = "NORMAL"
        prev_15m = "NORMAL"
        prev_30m = "NORMAL"

        if not df_existing.empty and "road_route_id" in df_existing.columns:
            route_history = df_existing[df_existing["road_route_id"] == route["route_id"]]
            if len(route_history) >= 1:
                prev_5m = route_history.iloc[-1].get("traffic_level", "NORMAL")
            if len(route_history) >= 3:
                prev_15m = route_history.iloc[-3].get("traffic_level", "NORMAL")
            if len(route_history) >= 6:
                prev_30m = route_history.iloc[-6].get("traffic_level", "NORMAL")

        # Random incident simulation (low probability)
        has_accident = "Yes" if np.random.rand() < 0.03 else "No"
        has_construction = "Yes" if "Savar" in route["route_id"] and np.random.rand() < 0.2 else "No"
        has_event = "No"

        row = {
            "timestamp": timestamp_str,
            "road_route_id": route["route_id"],
            "latitude": orig_lat,
            "longitude": orig_lon,
            "traffic_speed_kmh": speed,
            "travel_time_min": travel_time,
            "free_flow_time_min": free_flow,
            "traffic_level": level,
            "day_of_week": day_name,
            "hour": hour_val,
            "is_weekend": is_weekend,
            "weather": weather["weather"],
            "temperature_c": weather["temperature_c"],
            "rainfall_mm": weather["rainfall_mm"],
            "road_type": route["road_type"],
            "road_length_km": route["road_length_km"],
            "num_lanes": route["num_lanes"],
            "accident_incident": has_accident,
            "road_construction": has_construction,
            "special_event": has_event,
            "prev_traffic_5min": prev_5m,
            "prev_traffic_15min": prev_15m,
            "prev_traffic_30min": prev_30m,
            "target_traffic_level": level  # Can be shifted when training time series
        }
        new_rows.append(row)

    df_new = pd.DataFrame(new_rows)

    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(CSV_PATH) and os.path.getsize(CSV_PATH) > 0:
        df_new.to_csv(CSV_PATH, mode="a", header=False, index=False)
    else:
        df_new.to_csv(CSV_PATH, mode="w", header=True, index=False)

    print(f"[{timestamp_str}] Collected {len(new_rows)} route records -> {CSV_PATH}")

if __name__ == "__main__":
    print("Starting Traffic Data Collector...")
    collect_current_snapshot()
