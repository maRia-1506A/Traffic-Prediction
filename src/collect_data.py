"""
Traffic Data Collector
Fetches real-time traffic and road topology (OpenStreetMap Overpass),
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
# Traffic Provider & Key Manager (TomTom Removed)
# ---------------------------------------------------------
class TrafficKeyPool:
    """Placeholder key pool for traffic providers."""
    def __init__(self):
        self.keys = []
        self.stats = {}

    @property
    def total_keys(self) -> int:
        return 0

    @property
    def total_daily_capacity(self) -> int:
        return 0

    def get_next_key(self):
        return None

    def record_result(self, key: str, status_code: int):
        pass

    def mask(self, key: str) -> str:
        return "None"


KEY_POOL = TrafficKeyPool()


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
        self._build_junctions()

    def _build_junctions(self):
        """Precomputes road intersections/junctions from OSM graph and strategic nodes."""
        coord_counts = {}
        for feat in self.features:
            coords = feat.get("geometry", {}).get("coordinates", [])
            for c in coords:
                # GeoJSON coordinates are [lon, lat]
                pt = (round(c[1], 5), round(c[0], 5))
                coord_counts[pt] = coord_counts.get(pt, 0) + 1
        
        # Intersections where 2 or more ways cross
        self.junction_coords = [pt for pt, count in coord_counts.items() if count >= 2]
        
        # Add key Dhaka node coordinates
        try:
            from src.routes_config import NODE_COORDINATES
            for name, (lat, lon) in NODE_COORDINATES.items():
                pt = (round(lat, 5), round(lon, 5))
                if pt not in coord_counts:
                    self.junction_coords.append(pt)
        except Exception:
            pass

    @staticmethod
    def haversine(c1, c2):
        lat1, lon1, lat2, lon2 = c1[0], c1[1], c2[0], c2[1]
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def get_distance_to_junction_m(self, lat: float, lon: float) -> float:
        """Measures proximity to intersections where vehicles naturally slow down, merge, or queue up."""
        if not hasattr(self, "junction_coords") or not self.junction_coords:
            self._build_junctions()
        if not self.junction_coords:
            return 120.0
        target = (lat, lon)
        min_dist_km = min(self.haversine(target, j) for j in self.junction_coords)
        return round(min_dist_km * 1000.0, 1)

    def find_nearest_osm_way(self, lat: float, lon: float, max_dist_km: float = 6.0) -> dict:
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
OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")
OSM_NETWORK = OSMRoadNetwork(GEOJSON_PATH)

try:
    from src.traffic_clients import DualTrafficEngine
except ImportError:
    try:
        from traffic_clients import DualTrafficEngine
    except ImportError:
        DualTrafficEngine = None

TRAFFIC_ENGINE = DualTrafficEngine() if DualTrafficEngine else None

# ---------------------------------------------------------
# 1. Route Configuration (Official Project Corridors R01 to R50)
# ---------------------------------------------------------
try:
    from src.routes_config import PROJECT_ROUTES
except ImportError:
    try:
        from routes_config import PROJECT_ROUTES
    except ImportError:
        PROJECT_ROUTES = []

FALLBACK_ROUTES = [
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

# Active Project Corridors (Official 50 routes: R01 to R50)
ROUTES = PROJECT_ROUTES if PROJECT_ROUTES else FALLBACK_ROUTES

# ---------------------------------------------------------
# 2. Weather Fetcher (OpenWeatherMap API with Open-Meteo Fallback)
# ---------------------------------------------------------
_WEATHER_CACHE = {}

def get_live_weather(lat: float, lon: float):
    """
    Fetches real-time weather metrics using OpenWeatherMap API.
    Falls back gracefully to Open-Meteo (free, no key) if the key is missing or fails.
    Uses 5-minute memory cache to avoid redundant calls across routes.
    Returns:
      - weather: condition name (Clear, Cloudy, Light Rain, Heavy Rain, Fog)
      - temperature_c: temperature in Celsius
      - rainfall_mm: precipitation in mm (last 1h)
      - visibility_km: atmospheric visibility in km
      - surface_condition: road surface state (Dry, Wet, Waterlogged, Damp)
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

                # Atmospheric visibility in km (reported in meters by OpenWeatherMap)
                visibility_m = data.get("visibility", 10000)
                visibility_km = round(visibility_m / 1000.0, 1)

                # Road surface condition
                if precip_mm >= 4.0 or weather == "Heavy Rain":
                    surface_condition = "Waterlogged"
                elif precip_mm > 0.0 or weather == "Light Rain":
                    surface_condition = "Wet"
                elif weather == "Fog":
                    surface_condition = "Damp"
                else:
                    surface_condition = "Dry"

                res = {
                    "weather": weather,
                    "temperature_c": round(temp_c, 1),
                    "rainfall_mm": round(precip_mm, 1),
                    "visibility_km": visibility_km,
                    "surface_condition": surface_condition
                }
                _WEATHER_CACHE[cache_key] = (res, current_time)
                return res
            else:
                print(f"[Warning] OpenWeatherMap API returned status {response.status_code}. Using fallback.")
        except Exception as e:
            print(f"[Warning] OpenWeatherMap API error: {e}. Using fallback.")

    # Graceful Fallback: Open-Meteo API (100% Free, No Key Required)
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,precipitation,weather_code,visibility&timezone=auto"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json().get("current", {})
            temp_c = data.get("temperature_2m", 28.0)
            precip_mm = data.get("precipitation", 0.0)
            weather_code = data.get("weather_code", 0)
            visibility_m = data.get("visibility", 10000.0)
            visibility_km = round(visibility_m / 1000.0, 1)

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

            if precip_mm >= 4.0 or weather == "Heavy Rain":
                surface_condition = "Waterlogged"
            elif precip_mm > 0.0 or weather == "Light Rain":
                surface_condition = "Wet"
            elif weather == "Fog":
                surface_condition = "Damp"
            else:
                surface_condition = "Dry"

            res = {
                "weather": weather,
                "temperature_c": round(temp_c, 1),
                "rainfall_mm": round(precip_mm, 1),
                "visibility_km": visibility_km,
                "surface_condition": surface_condition
            }
            _WEATHER_CACHE[cache_key] = (res, current_time)
            return res
    except Exception as e:
        print(f"[Warning] Weather fallback error: {e}. Using defaults.")

    default_res = {
        "weather": "Clear",
        "temperature_c": 28.0,
        "rainfall_mm": 0.0,
        "visibility_km": 10.0,
        "surface_condition": "Dry"
    }
    _WEATHER_CACHE[cache_key] = (default_res, current_time)
    return default_res

# ---------------------------------------------------------
# 3. Traffic Data Fetcher (Google Maps & Waze Dual Engine)
# ---------------------------------------------------------
def get_live_traffic(route: dict, now: datetime.datetime, weather: dict, key_pool = None):
    """
    Fetches real-time traffic using Google Maps Routes API with Waze failover.
    Falls back gracefully to calibrated Dhaka simulation if offline.
    """
    if TRAFFIC_ENGINE:
        res = TRAFFIC_ENGINE.fetch_live_traffic(route, now, weather)
        return (
            res["travel_time_min"],
            res["free_flow_time_min"],
            res["traffic_speed_kmh"],
            res["traffic_level"],
            res["traffic_delay_min"],
            res["source_label"],
            res["upstream_speed_kmh"],
            res["downstream_speed_kmh"]
        )

    orig_lat, orig_lon = route["origin_coords"]
    dest_lat, dest_lon = route["dest_coords"]
    free_flow = route.get("free_flow_time_min", 10.0)
    road_len = route.get("road_length_km", 5.0)
    free_flow_speed = round(road_len / max(free_flow / 60.0, 0.01), 1)

    # Calibrated Traffic Model Fallback (Dhaka Rush Hour + Weather Effects)
    hour = now.hour + (now.minute / 60.0)
    is_weekend = now.weekday() in [4, 5]  # Friday (4) and Saturday (5) in Bangladesh

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
        if 16.0 <= hour <= 21.0:
            rush_factor = 1.6 + np.random.uniform(-0.2, 0.3)
        else:
            rush_factor = 1.0 + np.random.uniform(0.0, 0.15)

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
        upstream_speed_kmh = round(speed_kmh * np.random.uniform(0.98, 1.05), 1)
        downstream_speed_kmh = round(speed_kmh * np.random.uniform(0.97, 1.04), 1)
    elif ratio < 1.8:
        traffic_level = "SLOW"
        upstream_speed_kmh = round(min(speed_kmh * np.random.uniform(1.05, 1.15), free_flow_speed), 1)
        downstream_speed_kmh = round(max(speed_kmh * np.random.uniform(0.88, 0.96), 6.0), 1)
    else:
        traffic_level = "TRAFFIC_JAM"
        upstream_speed_kmh = round(min(speed_kmh * np.random.uniform(1.10, 1.25), free_flow_speed), 1)
        downstream_speed_kmh = round(max(speed_kmh * np.random.uniform(0.80, 0.92), 4.0), 1)

    return (travel_time_min, free_flow, speed_kmh, traffic_level,
            traffic_delay_min, "Simulation", upstream_speed_kmh, downstream_speed_kmh)


def calculate_traffic_flow(speed_kmh: float, free_flow_speed: float, num_lanes: int = 4):
    """
    Calculates macroscopic traffic flow metrics using Greenshields model:
      - traffic_volume_veh_hr: volume (veh/hr) distinguishing standstill from free-flow
      - occupancy_rate_pct: percentage of road occupied by vehicles (0-100%)
    """
    v = max(speed_kmh, 1.0)
    vf = max(free_flow_speed, 25.0)
    lanes = max(int(num_lanes), 2)
    k_jam_per_lane = 125.0  # veh/km/lane jam density
    
    v_ratio = min(v / vf, 1.0)
    density_ratio = max(0.04, min(0.96, 1.0 - (0.92 * v_ratio)))
    
    occupancy_rate_pct = round(density_ratio * 100.0, 1)
    
    # Flow q = k * v (across active roadway lanes)
    density_total = density_ratio * k_jam_per_lane * (lanes / 2.0)
    traffic_volume_veh_hr = int(round(density_total * v))
    
    return traffic_volume_veh_hr, occupancy_rate_pct


def get_historical_speed_baseline(df_existing: pd.DataFrame, route_id: str, now: datetime.datetime, free_flow_speed: float):
    """
    Computes baseline reference speeds:
      - speed_same_time_yesterday_kmh: traffic speed at this exact hour 24 hours ago
      - speed_same_time_last_week_kmh: traffic speed for this exact day & hour 7 days ago
    Queries historical records in df_existing if available, otherwise calculates
    calibrated diurnal rhythm baseline for the corridor.
    """
    speed_yesterday = None
    speed_last_week = None
    
    if df_existing is not None and not df_existing.empty and "road_route_id" in df_existing.columns and "timestamp" in df_existing.columns:
        try:
            route_df = df_existing[df_existing["road_route_id"] == route_id].copy()
            if not route_df.empty:
                route_df["dt"] = pd.to_datetime(route_df["timestamp"], errors="coerce")
                route_df = route_df.dropna(subset=["dt"])
                
                # Check for ~24 hours ago (+- 60 mins)
                target_yest = now - datetime.timedelta(hours=24)
                yest_candidates = route_df[
                    (route_df["dt"] >= target_yest - datetime.timedelta(minutes=60)) &
                    (route_df["dt"] <= target_yest + datetime.timedelta(minutes=60))
                ]
                if not yest_candidates.empty:
                    speed_yesterday = round(float(yest_candidates.iloc[-1]["traffic_speed_kmh"]), 1)
                
                # Check for ~7 days ago (+- 120 mins)
                target_week = now - datetime.timedelta(days=7)
                week_candidates = route_df[
                    (route_df["dt"] >= target_week - datetime.timedelta(minutes=120)) &
                    (route_df["dt"] <= target_week + datetime.timedelta(minutes=120))
                ]
                if not week_candidates.empty:
                    speed_last_week = round(float(week_candidates.iloc[-1]["traffic_speed_kmh"]), 1)
        except Exception:
            pass

    # Fallback to calibrated historical baseline if historical records don't exist yet
    hour = now.hour + (now.minute / 60.0)
    day_idx = now.weekday()  # Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4, Saturday=5, Sunday=6
    
    yesterday_idx = (day_idx - 1) % 7
    is_yesterday_weekend = yesterday_idx in [4, 5]
    
    def diurnal_speed(target_hour, is_weekend, vf):
        if is_weekend:
            if 16.0 <= target_hour <= 21.0:
                factor = 0.65
            else:
                factor = 0.88
        else:
            if 8.0 <= target_hour <= 10.5:
                factor = 0.42
            elif 17.0 <= target_hour <= 21.0:
                factor = 0.38
            elif 12.0 <= target_hour <= 15.0:
                factor = 0.62
            else:
                factor = 0.90
        return round(max(vf * factor, 8.0), 1)

    if speed_yesterday is None:
        speed_yesterday = diurnal_speed(hour, is_yesterday_weekend, free_flow_speed)
    
    if speed_last_week is None:
        is_today_weekend = day_idx in [4, 5]
        speed_last_week = diurnal_speed(hour, is_today_weekend, free_flow_speed)

    return speed_yesterday, speed_last_week


# ---------------------------------------------------------
# 4. Main Collection & Feature Builder
# ---------------------------------------------------------
def collect_current_snapshot(source: str = "corridors", limit: int = 50):
    """
    Collects a single snapshot combining OpenStreetMap road topology and
    live traffic estimation. Appends structured records to CSV.
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

    print("\n" + "=" * 120)
    print(f"  Dhaka Traffic & OSM Collector | Snapshot Time: {timestamp_str}")
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
    if os.path.exists(CSV_PATH) and os.path.getsize(CSV_PATH) > 0:
        try:
            df_existing = pd.read_csv(CSV_PATH)
        except Exception:
            df_existing = pd.DataFrame()

    new_rows = []

    print(f"{'#':<3} | {'Route Corridor':<28} | {'Speed':<9} | {'Up/Down Spd':<13} | {'Vol/Occupancy':<16} | {'Junction':<9} | {'Weather/Vis/Surf':<19} | {'Level':<11} | {'Source'}")
    print("-" * 135)

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
                osm_id = f"way/{10000000 + idx}"
                osm_road_type = route.get("road_type", "Primary Urban")
                osm_lanes = route.get("num_lanes", 4)
                osm_oneway = 0

        # Feature 3: Real-time proximity to intersection/junction
        dist_junction_m = OSM_NETWORK.get_distance_to_junction_m(orig_lat, orig_lon)

        # Weather features (Features 8 & 9: visibility_km & surface_condition)
        weather = get_live_weather(orig_lat, orig_lon)

        # Traffic Estimation (Features 1 & 2: upstream & downstream speeds)
        (travel_time, free_flow, speed, level,
         delay_min, key_label, upstream_speed, downstream_speed) = get_live_traffic(route, now, weather, KEY_POOL)

        road_length = route.get("road_length_km", 5.0)
        free_flow_speed = round(road_length / max(free_flow / 60.0, 0.01), 1)

        # Features 4 & 5: Macroscopic traffic volume & occupancy rate
        volume_veh_hr, occupancy_pct = calculate_traffic_flow(speed, free_flow_speed, osm_lanes)

        # Features 6 & 7: Historical baseline speeds (yesterday & last week)
        speed_yesterday, speed_last_week = get_historical_speed_baseline(df_existing, route["route_id"], now, free_flow_speed)

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

        # Exact 43 columns requested by user specification
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
            "road_length_km": road_length,
            "num_lanes": osm_lanes,
            "is_oneway": "Yes" if osm_oneway == 1 else "No",
            "accident_incident": has_accident,
            "road_construction": has_construction,
            "special_event": has_event,
            "prev_traffic_5min": prev_5m,
            "prev_traffic_15min": prev_15m,
            "prev_traffic_30min": prev_30m,
            "prev_speed_5min": prev_speed,
            "upstream_speed_kmh": upstream_speed,
            "downstream_speed_kmh": downstream_speed,
            "distance_to_junction_m": dist_junction_m,
            "traffic_volume_veh_hr": volume_veh_hr,
            "occupancy_rate_pct": occupancy_pct,
            "speed_same_time_yesterday_kmh": speed_yesterday,
            "speed_same_time_last_week_kmh": speed_last_week,
            "visibility_km": weather["visibility_km"],
            "surface_condition": weather["surface_condition"],
            "target_traffic_level": level,
            "target_speed_kmh": speed
        }
        new_rows.append(row)

        r_name = route["route_id"][:27]
        speed_disp = f"{speed:.1f} km/h"
        up_down_disp = f"{upstream_speed:.1f}/{downstream_speed:.1f}"
        flow_disp = f"{volume_veh_hr}v {occupancy_pct:.0f}%"
        junc_disp = f"{dist_junction_m:.0f}m"
        w_disp = f"{weather['weather'][:7]}/{weather['visibility_km']:.0f}k/{weather['surface_condition'][:3]}"
        print(f"{idx:<3} | {r_name:<28} | {speed_disp:<9} | {up_down_disp:<13} | {flow_disp:<16} | {junc_disp:<9} | {w_disp:<19} | {level:<11} | {key_label}")

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
    """Prints current key pool stats and health."""
    print("=" * 65)
    print("Traffic Provider Key Status: TomTom API Removed")
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
