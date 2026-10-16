"""
Traffic Data Collector
Fetches real-time traffic (TomTom API Key Pool) and road topology (OpenStreetMap Overpass),
computes dynamic congestion & lag features, and appends structured records for ML training.
"""

import os
import sys
import time
import math
import json
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

# Output Paths
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CSV_PATH = os.path.join(DATA_DIR, "traffic_data.csv")
GEOJSON_PATH = os.path.join(DATA_DIR, "dhaka_roads.geojson")

# ---------------------------------------------------------
# TomTom Multi-Key Pool Manager
# ---------------------------------------------------------
class TomTomKeyPool:
    """
    Manages a pool of TomTom API keys with:
    - Round-robin load balancing
    - Automatic failover if a key hits rate limit (429) or quota limit (403)
    - Cooldown tracking and live key usage statistics
    """
    def __init__(self, raw_keys_str: str = ""):
        self.keys = []
        for k in raw_keys_str.replace(";", ",").replace("\n", ",").split(","):
            k = k.strip().strip("\"'")
            if k and k not in self.keys:
                self.keys.append(k)

        self.current_idx = 0
        self.cooldowns = {}  # key -> expiry_timestamp
        self.stats = {k: {"calls": 0, "success": 0, "429": 0, "403": 0, "errors": 0} for k in self.keys}

    @property
    def total_keys(self) -> int:
        return len(self.keys)

    @property
    def total_daily_capacity(self) -> int:
        return len(self.keys) * 2500

    def get_next_key(self):
        if not self.keys:
            return None
        now = time.time()
        # Find next available key not in cooldown
        for _ in range(len(self.keys)):
            key = self.keys[self.current_idx]
            self.current_idx = (self.current_idx + 1) % len(self.keys)
            if now >= self.cooldowns.get(key, 0):
                return key
        # If all in cooldown, return the one whose cooldown expires earliest
        return min(self.keys, key=lambda k: self.cooldowns.get(k, 0))

    def record_result(self, key: str, status_code: int):
        if key not in self.stats:
            return
        self.stats[key]["calls"] += 1
        now = time.time()
        if status_code == 200:
            self.stats[key]["success"] += 1
            self.cooldowns.pop(key, None)
        elif status_code == 429:
            self.stats[key]["429"] += 1
            self.cooldowns[key] = now + 60  # Cooldown 1 minute
            print(f"  [TomTom Pool] Key {self._mask(key)} hit rate limit (429). Rotating & pausing key for 60s.")
        elif status_code == 403:
            self.stats[key]["403"] += 1
            self.cooldowns[key] = now + 3600  # Cooldown 1 hour
            print(f"  [TomTom Pool] Key {self._mask(key)} quota exceeded/forbidden (403). Rotating.")
        else:
            self.stats[key]["errors"] += 1

    def mask(self, key: str) -> str:
        return self._mask(key)

    def _mask(self, key: str) -> str:
        if not key:
            return "None"
        if len(key) <= 8:
            return "***"
        return f"{key[:4]}...{key[-4:]}"


# ---------------------------------------------------------
# OpenStreetMap Road Network Integration
# ---------------------------------------------------------
class OSMRoadNetwork:
    """
    Interfaces with OpenStreetMap data (dhaka_roads.geojson fetched via Overpass API)
    to bind real road infrastructure metadata:
      - OSM Way ID (@id)
      - Road Class (motorway, trunk, primary, secondary, tertiary)
      - Real Lane Count (lanes)
      - Directionality (oneway)
      - Precise segment length (Haversine)
    """
    def __init__(self, geojson_path: str = GEOJSON_PATH):
        self.geojson_path = geojson_path
        self.features = []
        self._load()

    def _load(self):
        if os.path.exists(self.geojson_path):
            try:
                with open(self.geojson_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.features = data.get("features", [])
            except Exception as e:
                print(f"[OSM Warning] Could not parse GeoJSON {self.geojson_path}: {e}")
                self.features = []

    @staticmethod
    def haversine(c1, c2):
        lat1, lon1, lat2, lon2 = c1[0], c1[1], c2[0], c2[1]
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def find_nearest_osm_way(self, lat: float, lon: float, max_dist_km: float = 1.0) -> dict:
        """Finds nearest OSM way and returns its physical infrastructure attributes."""
        if not self.features:
            return {}
        best_feat = None
        min_dist = float("inf")
        target = (lat, lon)
        for feat in self.features:
            coords = feat.get("geometry", {}).get("coordinates", [])
            for c in coords:
                # GeoJSON coordinates are [lon, lat]
                dist = self.haversine(target, (c[1], c[0]))
                if dist < min_dist:
                    min_dist = dist
                    best_feat = feat
        if min_dist <= max_dist_km and best_feat:
            props = best_feat.get("properties", {})
            return {
                "osm_id": props.get("@id", best_feat.get("id", "N/A")),
                "osm_highway": props.get("highway", "primary"),
                "osm_lanes": int(props.get("lanes", 4)) if str(props.get("lanes", "")).isdigit() else 4,
                "osm_oneway": 1 if props.get("oneway") == "yes" else 0,
                "osm_name": props.get("name:en") or props.get("name") or "",
                "match_dist_m": round(min_dist * 1000, 1)
            }
        return {}

    def extract_osm_segments(self, limit: int = 50, min_length_km: float = 0.4) -> list:
        """Extracts major arterial road segments directly from the OSM road graph."""
        valid_types = {"motorway", "trunk", "primary", "secondary", "tertiary"}
        segments = []
        for feat in self.features:
            props = feat.get("properties", {})
            hw = props.get("highway", "")
            if hw not in valid_types:
                continue
            coords = feat.get("geometry", {}).get("coordinates", [])
            if len(coords) < 2:
                continue
            seg_len = sum(self.haversine((coords[i][1], coords[i][0]), (coords[i+1][1], coords[i+1][0])) for i in range(len(coords) - 1))
            if seg_len < min_length_km:
                continue

            name = props.get("name:en") or props.get("name") or f"OSM {hw.title()} Road"
            osm_id = props.get("@id", feat.get("id", "N/A"))
            lanes = int(props.get("lanes", 4)) if str(props.get("lanes", "")).isdigit() else (6 if hw in ["motorway", "trunk"] else 4)
            free_flow = max(1.5, round((seg_len / 45.0) * 60, 1))

            segments.append({
                "route_id": f"OSM:{osm_id}:{name[:20]}",
                "osm_id": osm_id,
                "origin_name": f"{name} (Start)",
                "origin_coords": (round(coords[0][1], 6), round(coords[0][0], 6)),
                "dest_name": f"{name} (End)",
                "dest_coords": (round(coords[-1][1], 6), round(coords[-1][0], 6)),
                "road_type": hw.title(),
                "road_length_km": round(seg_len, 2),
                "num_lanes": lanes,
                "is_oneway": 1 if props.get("oneway") == "yes" else 0,
                "free_flow_time_min": free_flow
            })
            if len(segments) >= limit:
                break
        return segments


# ---------------------------------------------------------
# API Keys & Component Instances
# ---------------------------------------------------------
raw_tomtom_keys = os.getenv("TOMTOM_API_KEYS", "") or os.getenv("TOMTOM_API_KEY", "8UZzFrQGghTWeQneU0xK2MpgL26ZOsyh")
KEY_POOL = TomTomKeyPool(raw_tomtom_keys)

OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")
OSM_NETWORK = OSMRoadNetwork(GEOJSON_PATH)

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
# 3. Traffic Data Fetcher (TomTom Routing & Traffic API with Key Pool)
# ---------------------------------------------------------
def get_live_traffic(route: dict, now: datetime.datetime, weather: dict, key_pool: TomTomKeyPool = KEY_POOL):
    """
    Fetches live traffic travel time and delay using TomTom Routing & Traffic API,
    cycling through the multi-key pool with automatic failover on rate limits.
    Falls back to calibrated simulation if all keys fail or are unavailable.
    """
    orig_lat, orig_lon = route["origin_coords"]
    dest_lat, dest_lon = route["dest_coords"]
    free_flow = route.get("free_flow_time_min", 10.0)
    road_len = route.get("road_length_km", 5.0)

    # Try TomTom API with key pool if keys exist
    if key_pool and key_pool.total_keys > 0:
        max_attempts = min(key_pool.total_keys, 3)
        for attempt in range(max_attempts):
            api_key = key_pool.get_next_key()
            if not api_key:
                break
            try:
                locations = f"{orig_lat},{orig_lon}:{dest_lat},{dest_lon}"
                url = f"https://api.tomtom.com/routing/1/calculateRoute/{locations}/json"
                params = {
                    "key": api_key,
                    "traffic": "true",
                    "travelMode": "car",
                    "computeTravelTimeFor": "all"
                }
                res = requests.get(url, params=params, timeout=7)
                key_pool.record_result(api_key, res.status_code)

                if res.status_code == 200:
                    data = res.json()
                    if "routes" in data and len(data["routes"]) > 0:
                        summary = data["routes"][0].get("summary", {})
                        travel_time_sec = summary.get("travelTimeInSeconds")
                        if travel_time_sec is not None:
                            traffic_delay_sec = summary.get("trafficDelayInSeconds", 0)
                            no_traffic_sec = summary.get("noTrafficTravelTimeInSeconds")
                            if not no_traffic_sec:
                                no_traffic_sec = max(travel_time_sec - traffic_delay_sec, free_flow * 60)

                            travel_time_min = round(travel_time_sec / 60.0, 1)
                            free_flow_time_min = round(no_traffic_sec / 60.0, 1)
                            traffic_delay_min = round(traffic_delay_sec / 60.0, 1)
                            distance_km = round(summary.get("lengthInMeters", road_len * 1000) / 1000.0, 1)
                            speed_kmh = round(distance_km / max(travel_time_min / 60.0, 0.01), 1)

                            ratio = travel_time_min / max(free_flow_time_min, 0.1)
                            traffic_level = "NORMAL" if ratio < 1.25 else ("SLOW" if ratio < 1.75 else "TRAFFIC_JAM")
                            return travel_time_min, free_flow_time_min, speed_kmh, traffic_level, traffic_delay_min, key_pool.mask(api_key)
                elif res.status_code in [429, 403]:
                    # Rate limit or quota exhausted — automatically retry with next key in pool
                    continue
                else:
                    # Non-retryable error
                    break
            except Exception as e:
                key_pool.record_result(api_key, 0)
                continue

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
    speed_kmh = round(road_len / max(travel_time_min / 60.0, 0.01), 1)
    traffic_delay_min = max(0.0, round(travel_time_min - free_flow, 1))

    ratio = travel_time_min / max(free_flow, 0.1)
    if ratio < 1.3:
        traffic_level = "NORMAL"
    elif ratio < 1.8:
        traffic_level = "SLOW"
    else:
        traffic_level = "TRAFFIC_JAM"

    return travel_time_min, free_flow, speed_kmh, traffic_level, traffic_delay_min, "Simulation"


# ---------------------------------------------------------
# 4. Main Collection & Feature Builder
# ---------------------------------------------------------
def collect_current_snapshot(source: str = "corridors", limit: int = 50):
    """
    Collects a single snapshot combining OpenStreetMap road topology and
    TomTom live traffic across the key pool. Appends structured records to CSV.
    """
    now = datetime.datetime.now()
    timestamp_str = now.strftime("%Y-%m-%d %H:%M")
    day_name = now.strftime("%A")
    hour_val = now.hour
    minute_val = now.minute
    is_weekend = "Yes" if now.weekday() in [4, 5] else "No"

    # Rush hour indicator
    hour_float = hour_val + minute_val / 60.0
    is_rush = "Yes" if (((8.0 <= hour_float <= 10.5) or (17.0 <= hour_float <= 21.0)) and is_weekend == "No") else "No"

    pool_capacity = KEY_POOL.total_daily_capacity
    print("\n" + "=" * 120)
    print(f"  Dhaka Traffic & OSM Collector | Snapshot Time: {timestamp_str}")
    print(f"  TomTom Key Pool: {KEY_POOL.total_keys} Key(s) Loaded ({pool_capacity:,} calls/day capacity)")
    print(f"  OSM GeoJSON: {len(OSM_NETWORK.features)} Road Features Loaded | Mode: {source.upper()}")
    print("=" * 120)

    # Resolve target route list
    if source == "osm":
        active_routes = OSM_NETWORK.extract_osm_segments(limit=limit)
        if not active_routes:
            print("[Warning] No OSM road segments extracted. Falling back to predefined corridors.")
            active_routes = ROUTES[:limit]
    else:
        active_routes = ROUTES[:limit]

    # Load existing CSV to compute lag features if available
    df_existing = pd.DataFrame()
    if os.path.exists(CSV_PATH):
        try:
            df_existing = pd.read_csv(CSV_PATH)
        except Exception:
            df_existing = pd.DataFrame()

    new_rows = []

    print(f"{'#':<3} | {'Route / OSM Segment':<32} | {'OSM Way ID':<13} | {'Len':<5} | {'Live Time':<9} | {'Delay':<8} | {'Speed':<9} | {'Traffic Level':<12} | {'Key Used'}")
    print("-" * 120)

    for idx, route in enumerate(active_routes, 1):
        orig_lat, orig_lon = route["origin_coords"]
        dest_lat, dest_lon = route.get("dest_coords", (orig_lat, orig_lon))

        # Look up / bind OpenStreetMap physical tags
        osm_id = route.get("osm_id")
        osm_road_type = route.get("road_type")
        osm_lanes = route.get("num_lanes")
        osm_oneway = route.get("is_oneway")

        if not osm_id:
            osm_match = OSM_NETWORK.find_nearest_osm_way(orig_lat, orig_lon)
            if osm_match:
                osm_id = osm_match["osm_id"]
                osm_road_type = osm_match["osm_highway"].title()
                osm_lanes = osm_match["osm_lanes"]
                osm_oneway = osm_match["osm_oneway"]
            else:
                osm_id = "N/A"
                osm_road_type = route.get("road_type", "Primary Urban")
                osm_lanes = route.get("num_lanes", 4)
                osm_oneway = 0

        weather = get_live_weather(orig_lat, orig_lon)
        travel_time, free_flow, speed, level, delay_min, key_label = get_live_traffic(route, now, weather, KEY_POOL)

        # Retrieve lag features from historical records
        prev_5m = "NORMAL"
        prev_15m = "NORMAL"
        prev_30m = "NORMAL"
        prev_speed = speed

        if not df_existing.empty and "road_route_id" in df_existing.columns:
            route_history = df_existing[df_existing["road_route_id"] == route["route_id"]]
            if len(route_history) >= 1:
                prev_5m = route_history.iloc[-1].get("traffic_level", "NORMAL")
                prev_speed = route_history.iloc[-1].get("traffic_speed_kmh", speed)
            if len(route_history) >= 3:
                prev_15m = route_history.iloc[-3].get("traffic_level", "NORMAL")
            if len(route_history) >= 6:
                prev_30m = route_history.iloc[-6].get("traffic_level", "NORMAL")

        # Incident simulation (low probability)
        has_accident = "Yes" if np.random.rand() < 0.03 else "No"
        has_construction = "Yes" if np.random.rand() < 0.05 else "No"
        has_event = "No"

        congestion_ratio = round(travel_time / max(free_flow, 0.1), 2)

        row = {
            "timestamp": timestamp_str,
            "road_route_id": route["route_id"],
            "osm_id": osm_id,
            "latitude": orig_lat,
            "longitude": orig_lon,
            "dest_latitude": dest_lat,
            "dest_longitude": dest_lon,
            "traffic_speed_kmh": speed,
            "travel_time_min": travel_time,
            "free_flow_time_min": free_flow,
            "traffic_delay_min": delay_min,
            "congestion_ratio": congestion_ratio,
            "traffic_level": level,
            "day_of_week": day_name,
            "hour": hour_val,
            "minute": minute_val,
            "is_weekend": is_weekend,
            "is_rush_hour": is_rush,
            "weather": weather["weather"],
            "temperature_c": weather["temperature_c"],
            "rainfall_mm": weather["rainfall_mm"],
            "road_type": osm_road_type,
            "road_length_km": route.get("road_length_km", 5.0),
            "num_lanes": osm_lanes,
            "is_oneway": "Yes" if osm_oneway == 1 else "No",
            "accident_incident": has_accident,
            "road_construction": has_construction,
            "special_event": has_event,
            "prev_traffic_5min": prev_5m,
            "prev_traffic_15min": prev_15m,
            "prev_traffic_30min": prev_30m,
            "prev_speed_5min": prev_speed,
            "target_traffic_level": level,
            "target_speed_kmh": speed
        }
        new_rows.append(row)

        delay_display = f"+{delay_min:.1f}m" if delay_min > 0 else "0.0m"
        r_name = route["route_id"][:30]
        print(f"{idx:<3} | {r_name:<32} | {osm_id:<13} | {route.get('road_length_km', 0):<4.1f}k | {travel_time:<5.1f}min | {delay_display:<8} | {speed:<5.1f}km/h | {level:<12} | {key_label}")

    df_new = pd.DataFrame(new_rows)
    os.makedirs(DATA_DIR, exist_ok=True)

    if os.path.exists(CSV_PATH) and os.path.getsize(CSV_PATH) > 0:
        try:
            df_old = pd.read_csv(CSV_PATH)
            df_combined = pd.concat([df_old, df_new], ignore_index=True)
            df_combined.to_csv(CSV_PATH, index=False)
        except Exception:
            df_new.to_csv(CSV_PATH, mode="a", header=False, index=False)
    else:
        df_new.to_csv(CSV_PATH, mode="w", header=True, index=False)

    print("-" * 120)
    counts = df_new['traffic_level'].value_counts().to_dict()
    print(f"SUCCESS: Appended {len(new_rows)} structured records -> {CSV_PATH}")
    print(f"Summary: {counts.get('NORMAL', 0)} Normal | {counts.get('SLOW', 0)} Slow | {counts.get('TRAFFIC_JAM', 0)} Jam")
    print("=" * 120 + "\n")


def print_key_stats():
    """Prints current TomTom key pool stats and health."""
    print("=" * 65)
    print("TomTom API Key Pool Status")
    print("=" * 65)
    for idx, (k, stats) in enumerate(KEY_POOL.stats.items(), 1):
        masked = KEY_POOL.mask(k)
        print(f"Key #{idx} ({masked}): {stats['calls']} calls, {stats['success']} ok, {stats['429']} rate-limits, {stats['403']} quota-limits")
    print(f"Total theoretical capacity: {KEY_POOL.total_daily_capacity:,} req/day")
    print("=" * 65)


def main():
    parser = argparse.ArgumentParser(description="Dhaka Traffic & OSM Real-Time Collector")
    parser.add_argument("--loop", action="store_true", help="Run continuous collection loop")
    parser.add_argument("--interval", type=int, default=10, help="Interval in minutes if --loop is specified (default: 10)")
    parser.add_argument("--source", type=str, default="corridors", choices=["corridors", "osm"], help="Data source: 'corridors' (50 commuter routes) or 'osm' (direct OSM road segments)")
    parser.add_argument("--limit", type=int, default=50, help="Number of routes/segments to sample per snapshot (default: 50)")
    parser.add_argument("--keys-status", action="store_true", help="Print key pool status and exit")
    args = parser.parse_args()

    if args.keys_status:
        print_key_stats()
        return

    if args.loop:
        print("=" * 75)
        print("  Dhaka Real-Time Traffic Collector (Continuous Loop Active)")
        print(f"  Target File: {CSV_PATH}")
        print(f"  Interval: Every {args.interval} minutes")
        print(f"  Source Mode: {args.source.upper()} (Sampling {args.limit} routes)")
        print(f"  Keys in Pool: {KEY_POOL.total_keys} ({KEY_POOL.total_daily_capacity:,} req/day)")
        print("  Press Ctrl+C at any time to exit.")
        print("=" * 75)
        try:
            while True:
                collect_current_snapshot(source=args.source, limit=args.limit)
                time.sleep(args.interval * 60)
        except KeyboardInterrupt:
            print("\nStopped by user.")
    else:
        # Default: Purely manual one-shot snapshot
        collect_current_snapshot(source=args.source, limit=args.limit)


if __name__ == "__main__":
    main()
