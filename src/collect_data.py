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
import argparse

# Load .env file if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Manual .env fallback if python-dotenv is not installed
env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("\"'"))

# Output CSV Path
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CSV_PATH = os.path.join(DATA_DIR, "traffic_data.csv")

# ---------------------------------------------------------
# API Keys (Loaded from environment variables, .env, or default)
# ---------------------------------------------------------
# TomTom Routing & Traffic API Key (https://developer.tomtom.com/)
TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY", "8UZzFrQGghTWeQneU0xK2MpgL26ZOsyh")

# OpenWeatherMap API Key (https://openweathermap.org/api)
OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")

# ---------------------------------------------------------
# 1. Route Configuration & Infrastructure Metadata
# ---------------------------------------------------------
ROUTES = [
    # --- 1. Mirpur Corridors ---
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
        "route_id": "Mirpur 10 -> Karwan Bazar",
        "origin_name": "Mirpur 10",
        "origin_coords": (23.8069, 90.3687),
        "dest_name": "Karwan Bazar",
        "dest_coords": (23.7516, 90.3934),
        "road_type": "Primary Urban",
        "road_length_km": 9.5,
        "num_lanes": 6,
        "free_flow_time_min": 17.0,
    },
    {
        "route_id": "Mirpur 10 -> Agargaon",
        "origin_name": "Mirpur 10",
        "origin_coords": (23.8069, 90.3687),
        "dest_name": "Agargaon",
        "dest_coords": (23.7785, 90.3770),
        "road_type": "Primary Urban",
        "road_length_km": 4.2,
        "num_lanes": 6,
        "free_flow_time_min": 8.0,
    },
    {
        "route_id": "Mirpur 12 -> Mirpur 10",
        "origin_name": "Mirpur 12",
        "origin_coords": (23.8260, 90.3650),
        "dest_name": "Mirpur 10",
        "dest_coords": (23.8069, 90.3687),
        "road_type": "Primary Urban",
        "road_length_km": 3.2,
        "num_lanes": 4,
        "free_flow_time_min": 6.0,
    },
    {
        "route_id": "Mirpur 1 -> Gabtoli",
        "origin_name": "Mirpur 1",
        "origin_coords": (23.7950, 90.3540),
        "dest_name": "Gabtoli",
        "dest_coords": (23.7845, 90.3475),
        "road_type": "Arterial",
        "road_length_km": 3.0,
        "num_lanes": 4,
        "free_flow_time_min": 6.0,
    },
    {
        "route_id": "Mirpur 1 -> Dhanmondi 27",
        "origin_name": "Mirpur 1",
        "origin_coords": (23.7950, 90.3540),
        "dest_name": "Dhanmondi 27",
        "dest_coords": (23.7533, 90.3769),
        "road_type": "Arterial",
        "road_length_km": 6.8,
        "num_lanes": 4,
        "free_flow_time_min": 14.0,
    },

    # --- 2. Uttara / Airport / Northern Corridors ---
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
        "route_id": "Uttara -> Airport",
        "origin_name": "Uttara",
        "origin_coords": (23.8759, 90.3795),
        "dest_name": "Airport",
        "dest_coords": (23.8510, 90.4075),
        "road_type": "Expressway",
        "road_length_km": 4.5,
        "num_lanes": 8,
        "free_flow_time_min": 6.0,
    },
    {
        "route_id": "Airport -> Banani",
        "origin_name": "Airport",
        "origin_coords": (23.8510, 90.4075),
        "dest_name": "Banani",
        "dest_coords": (23.7937, 90.4066),
        "road_type": "Expressway",
        "road_length_km": 7.5,
        "num_lanes": 8,
        "free_flow_time_min": 11.0,
    },
    {
        "route_id": "Uttara -> Kuril",
        "origin_name": "Uttara",
        "origin_coords": (23.8759, 90.3795),
        "dest_name": "Kuril",
        "dest_coords": (23.8197, 90.4190),
        "road_type": "Expressway",
        "road_length_km": 8.0,
        "num_lanes": 8,
        "free_flow_time_min": 12.0,
    },
    {
        "route_id": "Tongi -> Uttara",
        "origin_name": "Tongi",
        "origin_coords": (23.8885, 90.4020),
        "dest_name": "Uttara",
        "dest_coords": (23.8759, 90.3795),
        "road_type": "Highway/Arterial",
        "road_length_km": 4.8,
        "num_lanes": 6,
        "free_flow_time_min": 8.0,
    },
    {
        "route_id": "Kuril -> Mohakhali",
        "origin_name": "Kuril",
        "origin_coords": (23.8197, 90.4190),
        "dest_name": "Mohakhali",
        "dest_coords": (23.7776, 90.4054),
        "road_type": "Expressway/Primary",
        "road_length_km": 6.0,
        "num_lanes": 6,
        "free_flow_time_min": 10.0,
    },
    {
        "route_id": "Kuril -> Notun Bazar",
        "origin_name": "Kuril",
        "origin_coords": (23.8197, 90.4190),
        "dest_name": "Notun Bazar",
        "dest_coords": (23.7975, 90.4240),
        "road_type": "Primary Urban",
        "road_length_km": 3.0,
        "num_lanes": 6,
        "free_flow_time_min": 5.0,
    },

    # --- 3. Gulshan / Banani / Badda / Rampura Corridors ---
    {
        "route_id": "Banani -> Gulshan 2",
        "origin_name": "Banani",
        "origin_coords": (23.7937, 90.4066),
        "dest_name": "Gulshan 2",
        "dest_coords": (23.7925, 90.4162),
        "road_type": "Primary Urban",
        "road_length_km": 1.8,
        "num_lanes": 4,
        "free_flow_time_min": 4.0,
    },
    {
        "route_id": "Gulshan 2 -> Gulshan 1",
        "origin_name": "Gulshan 2",
        "origin_coords": (23.7925, 90.4162),
        "dest_name": "Gulshan 1",
        "dest_coords": (23.7788, 90.4172),
        "road_type": "Primary Urban",
        "road_length_km": 1.8,
        "num_lanes": 4,
        "free_flow_time_min": 4.0,
    },
    {
        "route_id": "Gulshan 1 -> Mohakhali",
        "origin_name": "Gulshan 1",
        "origin_coords": (23.7788, 90.4172),
        "dest_name": "Mohakhali",
        "dest_coords": (23.7776, 90.4054),
        "road_type": "Primary Urban",
        "road_length_km": 2.0,
        "num_lanes": 4,
        "free_flow_time_min": 4.0,
    },
    {
        "route_id": "Gulshan 1 -> Badda Link Road",
        "origin_name": "Gulshan 1",
        "origin_coords": (23.7788, 90.4172),
        "dest_name": "Badda Link Road",
        "dest_coords": (23.7806, 90.4267),
        "road_type": "Primary Urban",
        "road_length_km": 1.5,
        "num_lanes": 4,
        "free_flow_time_min": 4.0,
    },
    {
        "route_id": "Badda -> Rampura Bridge",
        "origin_name": "Badda",
        "origin_coords": (23.7806, 90.4267),
        "dest_name": "Rampura Bridge",
        "dest_coords": (23.7612, 90.4243),
        "road_type": "Primary Urban",
        "road_length_km": 2.8,
        "num_lanes": 4,
        "free_flow_time_min": 6.0,
    },
    {
        "route_id": "Rampura -> Malibagh",
        "origin_name": "Rampura Bridge",
        "origin_coords": (23.7612, 90.4243),
        "dest_name": "Malibagh",
        "dest_coords": (23.7483, 90.4175),
        "road_type": "Primary Urban",
        "road_length_km": 2.4,
        "num_lanes": 4,
        "free_flow_time_min": 5.0,
    },
    {
        "route_id": "Malibagh -> Kakrail",
        "origin_name": "Malibagh",
        "origin_coords": (23.7483, 90.4175),
        "dest_name": "Kakrail",
        "dest_coords": (23.7380, 90.4080),
        "road_type": "Primary Urban",
        "road_length_km": 2.0,
        "num_lanes": 4,
        "free_flow_time_min": 4.0,
    },

    # --- 4. Central / Motijheel / Old Dhaka Corridors ---
    {
        "route_id": "Farmgate -> Shahbagh",
        "origin_name": "Farmgate",
        "origin_coords": (23.7570, 90.3888),
        "dest_name": "Shahbagh",
        "dest_coords": (23.7383, 90.3957),
        "road_type": "Primary Urban",
        "road_length_km": 3.0,
        "num_lanes": 6,
        "free_flow_time_min": 5.0,
    },
    {
        "route_id": "Karwan Bazar -> Shahbagh",
        "origin_name": "Karwan Bazar",
        "origin_coords": (23.7516, 90.3934),
        "dest_name": "Shahbagh",
        "dest_coords": (23.7383, 90.3957),
        "road_type": "Primary Urban",
        "road_length_km": 2.0,
        "num_lanes": 6,
        "free_flow_time_min": 4.0,
    },
    {
        "route_id": "Shahbagh -> Motijheel",
        "origin_name": "Shahbagh",
        "origin_coords": (23.7383, 90.3957),
        "dest_name": "Motijheel",
        "dest_coords": (23.7330, 90.4172),
        "road_type": "Primary Urban",
        "road_length_km": 3.8,
        "num_lanes": 6,
        "free_flow_time_min": 7.0,
    },
    {
        "route_id": "Kakrail -> Motijheel",
        "origin_name": "Kakrail",
        "origin_coords": (23.7380, 90.4080),
        "dest_name": "Motijheel",
        "dest_coords": (23.7330, 90.4172),
        "road_type": "Primary Urban",
        "road_length_km": 2.2,
        "num_lanes": 6,
        "free_flow_time_min": 4.0,
    },
    {
        "route_id": "Motijheel -> Gulistan",
        "origin_name": "Motijheel",
        "origin_coords": (23.7330, 90.4172),
        "dest_name": "Gulistan",
        "dest_coords": (23.7250, 90.4125),
        "road_type": "Primary Urban",
        "road_length_km": 1.4,
        "num_lanes": 6,
        "free_flow_time_min": 3.0,
    },
    {
        "route_id": "Gulistan -> Sadarghat",
        "origin_name": "Gulistan",
        "origin_coords": (23.7250, 90.4125),
        "dest_name": "Sadarghat",
        "dest_coords": (23.7050, 90.4140),
        "road_type": "Arterial",
        "road_length_km": 2.6,
        "num_lanes": 4,
        "free_flow_time_min": 6.0,
    },
    {
        "route_id": "Sayedabad -> Motijheel",
        "origin_name": "Sayedabad",
        "origin_coords": (23.7180, 90.4285),
        "dest_name": "Motijheel",
        "dest_coords": (23.7330, 90.4172),
        "road_type": "Primary Urban",
        "road_length_km": 2.8,
        "num_lanes": 4,
        "free_flow_time_min": 6.0,
    },
    {
        "route_id": "Jatrabari -> Sayedabad",
        "origin_name": "Jatrabari",
        "origin_coords": (23.7115, 90.4340),
        "dest_name": "Sayedabad",
        "dest_coords": (23.7180, 90.4285),
        "road_type": "Highway/Arterial",
        "road_length_km": 1.6,
        "num_lanes": 6,
        "free_flow_time_min": 3.0,
    },
    {
        "route_id": "Postogola -> Jatrabari",
        "origin_name": "Postogola",
        "origin_coords": (23.6920, 90.4350),
        "dest_name": "Jatrabari",
        "dest_coords": (23.7115, 90.4340),
        "road_type": "Highway/Arterial",
        "road_length_km": 3.2,
        "num_lanes": 4,
        "free_flow_time_min": 6.0,
    },

    # --- 5. Dhanmondi / Mohammadpur / Science Lab Corridors ---
    {
        "route_id": "Mohammadpur -> Dhanmondi 27",
        "origin_name": "Mohammadpur",
        "origin_coords": (23.7615, 90.3620),
        "dest_name": "Dhanmondi 27",
        "dest_coords": (23.7533, 90.3769),
        "road_type": "Primary Urban",
        "road_length_km": 2.4,
        "num_lanes": 4,
        "free_flow_time_min": 5.0,
    },
    {
        "route_id": "Mohammadpur -> Farmgate",
        "origin_name": "Mohammadpur",
        "origin_coords": (23.7615, 90.3620),
        "dest_name": "Farmgate",
        "dest_coords": (23.7570, 90.3888),
        "road_type": "Primary Urban",
        "road_length_km": 4.5,
        "num_lanes": 4,
        "free_flow_time_min": 9.0,
    },
    {
        "route_id": "Asad Gate -> Farmgate",
        "origin_name": "Asad Gate",
        "origin_coords": (23.7600, 90.3725),
        "dest_name": "Farmgate",
        "dest_coords": (23.7570, 90.3888),
        "road_type": "Primary Urban",
        "road_length_km": 2.8,
        "num_lanes": 6,
        "free_flow_time_min": 5.0,
    },
    {
        "route_id": "Dhanmondi 27 -> Science Lab",
        "origin_name": "Dhanmondi 27",
        "origin_coords": (23.7533, 90.3769),
        "dest_name": "Science Lab",
        "dest_coords": (23.7397, 90.3831),
        "road_type": "Primary Urban",
        "road_length_km": 2.4,
        "num_lanes": 4,
        "free_flow_time_min": 5.0,
    },
    {
        "route_id": "Science Lab -> Shahbagh",
        "origin_name": "Science Lab",
        "origin_coords": (23.7397, 90.3831),
        "dest_name": "Shahbagh",
        "dest_coords": (23.7383, 90.3957),
        "road_type": "Primary Urban",
        "road_length_km": 1.8,
        "num_lanes": 4,
        "free_flow_time_min": 4.0,
    },
    {
        "route_id": "Science Lab -> New Market",
        "origin_name": "Science Lab",
        "origin_coords": (23.7397, 90.3831),
        "dest_name": "New Market",
        "dest_coords": (23.7335, 90.3842),
        "road_type": "Primary Urban",
        "road_length_km": 1.2,
        "num_lanes": 4,
        "free_flow_time_min": 3.0,
    },

    # --- 6. Western / Gabtoli / Shyamoli Corridors ---
    {
        "route_id": "Gabtoli -> Kalyanpur",
        "origin_name": "Gabtoli",
        "origin_coords": (23.7845, 90.3475),
        "dest_name": "Kalyanpur",
        "dest_coords": (23.7818, 90.3592),
        "road_type": "Highway/Arterial",
        "road_length_km": 1.8,
        "num_lanes": 6,
        "free_flow_time_min": 3.0,
    },
    {
        "route_id": "Kalyanpur -> Shyamoli",
        "origin_name": "Kalyanpur",
        "origin_coords": (23.7818, 90.3592),
        "dest_name": "Shyamoli",
        "dest_coords": (23.7717, 90.3644),
        "road_type": "Primary Urban",
        "road_length_km": 1.6,
        "num_lanes": 6,
        "free_flow_time_min": 3.0,
    },
    {
        "route_id": "Shyamoli -> Asad Gate",
        "origin_name": "Shyamoli",
        "origin_coords": (23.7717, 90.3644),
        "dest_name": "Asad Gate",
        "dest_coords": (23.7600, 90.3725),
        "road_type": "Primary Urban",
        "road_length_km": 2.2,
        "num_lanes": 6,
        "free_flow_time_min": 4.0,
    },
    {
        "route_id": "Bijoy Sarani -> Mohakhali",
        "origin_name": "Bijoy Sarani",
        "origin_coords": (23.7650, 90.3875),
        "dest_name": "Mohakhali",
        "dest_coords": (23.7776, 90.4054),
        "road_type": "Primary Urban",
        "road_length_km": 2.5,
        "num_lanes": 6,
        "free_flow_time_min": 4.0,
    },
    {
        "route_id": "Gabtoli -> Dhanmondi 27",
        "origin_name": "Gabtoli",
        "origin_coords": (23.7845, 90.3475),
        "dest_name": "Dhanmondi 27",
        "dest_coords": (23.7533, 90.3769),
        "road_type": "Highway/Arterial",
        "road_length_km": 6.5,
        "num_lanes": 6,
        "free_flow_time_min": 12.0,
    },

    # --- 7. Kalshi / ECB Chattar Corridors ---
    {
        "route_id": "Mirpur 12 -> ECB Chattar",
        "origin_name": "Mirpur 12",
        "origin_coords": (23.8260, 90.3650),
        "dest_name": "ECB Chattar",
        "dest_coords": (23.8228, 90.3932),
        "road_type": "Flyover/Primary",
        "road_length_km": 3.5,
        "num_lanes": 6,
        "free_flow_time_min": 5.0,
    },
    {
        "route_id": "ECB Chattar -> Mirpur 12",
        "origin_name": "ECB Chattar",
        "origin_coords": (23.8228, 90.3932),
        "dest_name": "Mirpur 12",
        "dest_coords": (23.8260, 90.3650),
        "road_type": "Flyover/Primary",
        "road_length_km": 3.5,
        "num_lanes": 6,
        "free_flow_time_min": 5.0,
    },
    {
        "route_id": "Mirpur 10 -> ECB Chattar",
        "origin_name": "Mirpur 10",
        "origin_coords": (23.8069, 90.3687),
        "dest_name": "ECB Chattar",
        "dest_coords": (23.8228, 90.3932),
        "road_type": "Flyover/Primary",
        "road_length_km": 4.8,
        "num_lanes": 6,
        "free_flow_time_min": 8.0,
    },
    {
        "route_id": "ECB Chattar -> Kuril",
        "origin_name": "ECB Chattar",
        "origin_coords": (23.8228, 90.3932),
        "dest_name": "Kuril",
        "dest_coords": (23.8197, 90.4190),
        "road_type": "Expressway/Primary",
        "road_length_km": 3.2,
        "num_lanes": 6,
        "free_flow_time_min": 5.0,
    },
    {
        "route_id": "ECB Chattar -> Airport",
        "origin_name": "ECB Chattar",
        "origin_coords": (23.8228, 90.3932),
        "dest_name": "Airport",
        "dest_coords": (23.8510, 90.4075),
        "road_type": "Expressway",
        "road_length_km": 4.2,
        "num_lanes": 6,
        "free_flow_time_min": 6.0,
    },
    {
        "route_id": "ECB Chattar -> Banani",
        "origin_name": "ECB Chattar",
        "origin_coords": (23.8228, 90.3932),
        "dest_name": "Banani",
        "dest_coords": (23.7937, 90.4066),
        "road_type": "Expressway/Primary",
        "road_length_km": 3.8,
        "num_lanes": 6,
        "free_flow_time_min": 6.0,
    },

    # --- 8. Savar / Greater Western Highway Corridors ---
    {
        "route_id": "Savar -> Gabtoli",
        "origin_name": "Savar",
        "origin_coords": (23.8467, 90.2575),
        "dest_name": "Gabtoli",
        "dest_coords": (23.7845, 90.3475),
        "road_type": "Highway/Arterial",
        "road_length_km": 15.5,
        "num_lanes": 6,
        "free_flow_time_min": 22.0,
    },
    {
        "route_id": "Gabtoli -> Savar",
        "origin_name": "Gabtoli",
        "origin_coords": (23.7845, 90.3475),
        "dest_name": "Savar",
        "dest_coords": (23.8467, 90.2575),
        "road_type": "Highway/Arterial",
        "road_length_km": 15.5,
        "num_lanes": 6,
        "free_flow_time_min": 22.0,
    },
    {
        "route_id": "Savar -> Dhanmondi",
        "origin_name": "Savar",
        "origin_coords": (23.8467, 90.2575),
        "dest_name": "Dhanmondi 27",
        "dest_coords": (23.7533, 90.3769),
        "road_type": "Highway/Arterial",
        "road_length_km": 24.5,
        "num_lanes": 4,
        "free_flow_time_min": 35.0,
    },
    {
        "route_id": "Savar -> Ashulia",
        "origin_name": "Savar",
        "origin_coords": (23.8467, 90.2575),
        "dest_name": "Ashulia",
        "dest_coords": (23.8950, 90.3150),
        "road_type": "Arterial",
        "road_length_km": 9.0,
        "num_lanes": 4,
        "free_flow_time_min": 12.0,
    }
]

# ---------------------------------------------------------
# 2. Weather Fetcher (OpenWeatherMap API with Open-Meteo Fallback)
# ---------------------------------------------------------
_WEATHER_CACHE = {}

def get_live_weather(lat: float, lon: float):
    """
    Fetches real-time weather metrics using OpenWeatherMap API.
    Falls back gracefully to Open-Meteo (free, no key) if the key is missing or fails.
    Uses 5-minute memory cache to avoid redundant calls across routes.
    """
    cache_key = (round(lat, 2), round(lon, 2))
    current_time = time.time()
    if cache_key in _WEATHER_CACHE:
        cached_result, timestamp = _WEATHER_CACHE[cache_key]
        if current_time - timestamp < 300:  # 5 minutes
            return cached_result

    result = None
    if OPENWEATHERMAP_API_KEY:
        try:
            url = "https://api.openweathermap.org/data/2.5/weather"
            params = {
                "lat": lat,
                "lon": lon,
                "appid": OPENWEATHERMAP_API_KEY,
                "units": "metric"
            }
            response = requests.get(url, params=params, timeout=5)
            if response.status_code == 200:
                data = response.json()
                temp_c = data.get("main", {}).get("temp", 28.0)
                
                # Precipitation in mm (rain in last 1 hour)
                rain_data = data.get("rain", {})
                precip_mm = rain_data.get("1h", rain_data.get("3h", 0.0))

                weather_list = data.get("weather", [])
                weather_id = weather_list[0].get("id", 800) if weather_list else 800

                # OpenWeatherMap weather code condition classification
                if 200 <= weather_id < 300:
                    weather = "Heavy Rain"  # Thunderstorm
                elif 300 <= weather_id < 400:
                    weather = "Light Rain"  # Drizzle
                elif 500 <= weather_id < 600:
                    if weather_id in [502, 503, 504, 522] or precip_mm >= 4.0:
                        weather = "Heavy Rain"
                    else:
                        weather = "Light Rain"
                elif 700 <= weather_id < 800:
                    weather = "Fog"         # Mist, Fog, Haze
                elif weather_id == 800:
                    weather = "Clear"
                elif 801 <= weather_id <= 804:
                    weather = "Cloudy"
                else:
                    weather = "Clear"

                res = {
                    "weather": weather,
                    "temperature_c": round(temp_c, 1),
                    "rainfall_mm": round(precip_mm, 1),
                }
                _WEATHER_CACHE[cache_key] = (res, current_time)
                return res
            else:
                print(f"[Warning] OpenWeatherMap API returned status {response.status_code}. Using fallback.")
        except Exception as e:
            print(f"[Warning] OpenWeatherMap API error: {e}. Using fallback.")

    # Graceful Fallback: Open-Meteo API (100% Free, No Key Required)
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,precipitation,weather_code&timezone=auto"
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

            res = {
                "weather": weather,
                "temperature_c": round(temp_c, 1),
                "rainfall_mm": round(precip_mm, 1),
            }
            _WEATHER_CACHE[cache_key] = (res, current_time)
            return res
    except Exception as e:
        print(f"[Warning] Weather fallback error: {e}. Using defaults.")

    default_res = {"weather": "Clear", "temperature_c": 28.0, "rainfall_mm": 0.0}
    _WEATHER_CACHE[cache_key] = (default_res, current_time)
    return default_res

# ---------------------------------------------------------
# 3. Traffic Data Fetcher (TomTom Routing & Traffic API)
# ---------------------------------------------------------
def get_live_traffic(route: dict, now: datetime.datetime, weather: dict):
    """
    Fetches live traffic travel time and delay using TomTom Routing & Traffic API,
    falling back to calibrated simulation if key is not configured or unavailable.
    """
    orig_lat, orig_lon = route["origin_coords"]
    dest_lat, dest_lon = route["dest_coords"]
    free_flow = route["free_flow_time_min"]
    road_len = route["road_length_km"]

    # Try TomTom Routing & Traffic API if key is supplied
    if TOMTOM_API_KEY:
        try:
            locations = f"{orig_lat},{orig_lon}:{dest_lat},{dest_lon}"
            url = f"https://api.tomtom.com/routing/1/calculateRoute/{locations}/json"
            params = {
                "key": TOMTOM_API_KEY,
                "traffic": "true",
                "travelMode": "car",
                "computeTravelTimeFor": "all"
            }
            res = requests.get(url, params=params, timeout=7)
            if res.status_code == 200:
                data = res.json()
                if "routes" in data and len(data["routes"]) > 0:
                    summary = data["routes"][0].get("summary", {})
                    travel_time_sec = summary.get("travelTimeInSeconds")
                    if travel_time_sec:
                        no_traffic_sec = summary.get("noTrafficTravelTimeInSeconds")
                        if not no_traffic_sec:
                            traffic_delay_sec = summary.get("trafficDelayInSeconds", 0)
                            no_traffic_sec = max(travel_time_sec - traffic_delay_sec, free_flow * 60)

                        travel_time_min = round(travel_time_sec / 60.0, 1)
                        free_flow_time_min = round(no_traffic_sec / 60.0, 1)
                        distance_km = round(summary.get("lengthInMeters", road_len * 1000) / 1000.0, 1)
                        speed_kmh = round(distance_km / max(travel_time_min / 60.0, 0.01), 1)

                        ratio = travel_time_min / max(free_flow_time_min, 1)
                        traffic_level = "NORMAL" if ratio < 1.25 else ("SLOW" if ratio < 1.75 else "TRAFFIC_JAM")
                        return travel_time_min, free_flow_time_min, speed_kmh, traffic_level
            else:
                print(f"[Warning] TomTom API returned status {res.status_code}. Using simulation fallback.")
        except Exception as e:
            print(f"[Warning] TomTom API error: {e}. Using simulation fallback.")

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
    Logs live route metrics cleanly to the terminal and appends immediately to CSV.
    """
    now = datetime.datetime.now()
    timestamp_str = now.strftime("%Y-%m-%d %H:%M")
    day_name = now.strftime("%A")
    hour_val = now.hour
    is_weekend = "Yes" if now.weekday() in [4, 5] else "No"

    traffic_mode = "Live TomTom API" if TOMTOM_API_KEY else "Simulation fallback"
    weather_mode = "Live OpenWeatherMap" if OPENWEATHERMAP_API_KEY else "Open-Meteo (Free)"

    print("\n" + "=" * 115)
    print(f"📡 [SNAPSHOT] {timestamp_str} | Traffic: {traffic_mode} | Weather: {weather_mode}")
    print(f"📁 Target CSV: {CSV_PATH}")
    print("=" * 115)
    print(f"{'#':<3} | {'Route':<28} | {'Dist':<7} | {'Live Time':<10} | {'Normal':<8} | {'Delay':<8} | {'Speed':<9} | {'Level':<11} | {'Weather'}")
    print("-" * 115)

    # Load existing CSV to compute lag features if available
    if os.path.exists(CSV_PATH):
        try:
            df_existing = pd.read_csv(CSV_PATH)
        except Exception:
            df_existing = pd.DataFrame()
    else:
        df_existing = pd.DataFrame()

    new_rows = []

    for idx, route in enumerate(ROUTES, 1):
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
        has_construction = "Yes" if np.random.rand() < 0.05 else "No"
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
            "target_traffic_level": level
        }
        new_rows.append(row)

        delay_min = max(0.0, round(travel_time - free_flow, 1))
        weather_str = f"{weather['weather']} ({weather['temperature_c']}°C)"
        delay_display = f"+{delay_min:.1f} m" if delay_min > 0 else "0.0 m"
        print(f"{idx:<3} | {route['route_id']:<28} | {route['road_length_km']:<4.1f} km | {travel_time:<5.1f} min | {free_flow:<4.1f} min | {delay_display:<8} | {speed:<5.1f}km/h | {level:<11} | {weather_str}")

    df_new = pd.DataFrame(new_rows)

    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(CSV_PATH) and os.path.getsize(CSV_PATH) > 0:
        df_new.to_csv(CSV_PATH, mode="a", header=False, index=False)
    else:
        df_new.to_csv(CSV_PATH, mode="w", header=True, index=False)

    print("-" * 115)
    counts = df_new['traffic_level'].value_counts().to_dict()
    print(f"✅ Appended {len(new_rows)} route records -> {CSV_PATH}")
    print(f"📊 Summary: {counts.get('NORMAL', 0)} Normal | {counts.get('SLOW', 0)} Slow | {counts.get('TRAFFIC_JAM', 0)} Jam")
    print("=" * 115 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Dhaka Traffic & Weather Real-Time Collector")
    parser.add_argument("--loop", action="store_true", help="Run continuous loop (optional)")
    parser.add_argument("--interval", type=int, default=10, help="Interval in minutes if --loop is specified")
    args = parser.parse_args()

    if args.loop:
        print("=" * 70)
        print("  Dhaka Real-Time Traffic Collector (Continuous Mode)")
        print(f"  Target File: {CSV_PATH}")
        print(f"  Interval: Every {args.interval} minutes")
        print("  Press Ctrl+C at any time to exit.")
        print("=" * 70)
        try:
            while True:
                collect_current_snapshot()
                time.sleep(args.interval * 60)
        except KeyboardInterrupt:
            print("\n🛑 Stopped by user.")
    else:
        # Default: Purely manual one-shot collection
        collect_current_snapshot()


if __name__ == "__main__":
    main()
