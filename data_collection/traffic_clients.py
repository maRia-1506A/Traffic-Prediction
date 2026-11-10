"""
Google Maps & Waze Dual Real-Time Traffic Engine
================================================
Provides live traffic, travel times, congestion delays, and speeds for Dhaka corridors.

Engines:
  1. Google Maps Routes API v2 (Primary: high-precision lane & corridor telemetry)
  2. Waze Real-Time Engine    (Backup: crowdsourced live mobile probe speeds, zero-key)
  3. Calibrated Simulation     (Offline failover for continuous resilience)
"""

import os
import sys
import time
import math
import datetime
import requests
import numpy as np


class WazeTrafficClient:
    """
    Fetches real-time crowdsourced traffic from Waze Live Map routing engine.
    Requires no API key.
    """
    ROUTING_URL = "https://www.waze.com/RoutingManager/fetchRoutes"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://www.waze.com/live-map/",
        "Accept": "application/json, text/plain, */*"
    }

    def __init__(self, timeout: int = 8):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)

    def get_route_traffic(self, origin_coords: tuple, dest_coords: tuple) -> dict:
        """
        Queries Waze live routing for origin (lat, lon) to destination (lat, lon).
        Returns dict with:
          - success: bool
          - travel_time_min: float
          - free_flow_time_min: float
          - traffic_delay_min: float
          - distance_km: float
          - speed_kmh: float
          - route_name: str
        """
        orig_lat, orig_lon = origin_coords
        dest_lat, dest_lon = dest_coords

        # Waze Routing Manager uses x: longitude, y: latitude
        params = {
            "from": f"x:{orig_lon} y:{orig_lat}",
            "to": f"x:{dest_lon} y:{dest_lat}",
            "at": 0,
            "returnJSON": "true",
            "returnGeometries": "true",
            "timeout": 60000,
            "nPaths": 1,
            "options": "AVOID_TRAFFIC_JAMS:T"
        }

        try:
            res = self.session.get(self.ROUTING_URL, params=params, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                results = data.get("response", {}).get("results", [])
                if results:
                    best = results[0]
                    travel_time_sec = best.get("totalRouteTime", 0)
                    length_m = best.get("routeLength", 0)
                    jam_delay_sec = best.get("jamDelay", 0)

                    travel_time_min = round(travel_time_sec / 60.0, 1)
                    dist_km = max(round(length_m / 1000.0, 2), 0.5)
                    delay_min = round(jam_delay_sec / 60.0, 1)
                    free_flow_min = max(round((travel_time_sec - jam_delay_sec) / 60.0, 1), 1.0)
                    speed_kmh = round(dist_km / max(travel_time_min / 60.0, 0.01), 1)

                    return {
                        "success": True,
                        "source": "Waze",
                        "travel_time_min": travel_time_min,
                        "free_flow_time_min": free_flow_min,
                        "traffic_delay_min": delay_min,
                        "distance_km": dist_km,
                        "speed_kmh": speed_kmh,
                        "route_name": best.get("routeName", "Waze Corridor")
                    }
        except Exception as e:
            return {"success": False, "error": str(e), "source": "Waze"}

        return {"success": False, "error": "No Waze route found", "source": "Waze"}


class GoogleRoutesClient:
    """
    Fetches real-time routing and flow traffic from Google Maps Routes API (v2:computeRoutes).
    Provides superior traffic coverage and congestion metrics across Greater Dhaka.
    """
    URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
    FIELD_MASK = "routes.duration,routes.staticDuration,routes.distanceMeters"

    def __init__(self, api_key: str = None, timeout: int = 8):
        self.api_key = api_key or os.getenv("GOOGLE_MAPS_API_KEY", "")
        self.timeout = timeout

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip() and self.api_key.startswith("AIza"))

    def get_route_traffic(self, origin_coords: tuple, dest_coords: tuple) -> dict:
        """
        Queries Google Routes API for live traffic state.
        Returns dict with:
          - success: bool
          - travel_time_min: float
          - free_flow_time_min: float
          - traffic_delay_min: float
          - distance_km: float
          - speed_kmh: float
        """
        if not self.is_configured:
            return {"success": False, "error": "GOOGLE_MAPS_API_KEY not configured", "source": "Google"}

        orig_lat, orig_lon = origin_coords
        dest_lat, dest_lon = dest_coords

        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key.strip(),
            "X-Goog-FieldMask": self.FIELD_MASK
        }
        body = {
            "origin": {"location": {"latLng": {"latitude": orig_lat, "longitude": orig_lon}}},
            "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lon}}},
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE"
        }

        try:
            res = requests.post(self.URL, json=body, headers=headers, timeout=self.timeout)
            if res.status_code == 200:
                data = res.json()
                routes = data.get("routes", [])
                if routes:
                    r = routes[0]
                    duration_str = r.get("duration", "0s").rstrip("s")
                    static_str = r.get("staticDuration", duration_str).rstrip("s")
                    duration_sec = float(duration_str) if duration_str else 0.0
                    static_sec = float(static_str) if static_str else duration_sec
                    length_m = float(r.get("distanceMeters", 0))

                    travel_time_min = round(duration_sec / 60.0, 1)
                    free_flow_min = max(round(static_sec / 60.0, 1), 1.0)
                    delay_min = max(0.0, round((duration_sec - static_sec) / 60.0, 1))
                    dist_km = max(round(length_m / 1000.0, 2), 0.5)
                    speed_kmh = round(dist_km / max(travel_time_min / 60.0, 0.01), 1)

                    return {
                        "success": True,
                        "source": "Google",
                        "travel_time_min": travel_time_min,
                        "free_flow_time_min": free_flow_min,
                        "traffic_delay_min": delay_min,
                        "distance_km": dist_km,
                        "speed_kmh": speed_kmh
                    }
            return {"success": False, "error": f"Google status {res.status_code}: {res.text}", "source": "Google"}
        except Exception as e:
            return {"success": False, "error": str(e), "source": "Google"}


class DualTrafficEngine:
    """
    Unified Traffic Engine combining Google Maps Routes API with Waze Live backup.
    
    Features:
      - Primary Live Engine: Google Maps Routes API (Highest precision for Dhaka roads)
      - Crowdsourced Backup: Waze Live mobile probes (unlimited, zero-key failover)
      - Calibrated Offline Simulation: Graceful fallback when network is unavailable
    """
    def __init__(self, google_api_key: str = None, *args, **kwargs):
        self.google = GoogleRoutesClient(google_api_key)
        self.waze = WazeTrafficClient()

    def fetch_live_traffic(self, route: dict, now: datetime.datetime, weather: dict) -> dict:
        """
        Executes traffic queries with Google priority and Waze failover.
        """
        orig_coords = route["origin_coords"]
        dest_coords = route.get("dest_coords", orig_coords)
        road_len = route.get("road_length_km", 5.0)
        free_flow_fallback = route.get("free_flow_time_min", max(2.0, round((road_len / 35.0) * 60, 1)))

        # 1. Query Providers (Google Maps Primary, Waze Backup)
        google_res = self.google.get_route_traffic(orig_coords, dest_coords)
        google_ok = google_res.get("success", False)

        waze_res = {"success": False}
        if not google_ok:
            # Query Waze only if Google failed or key not configured
            waze_res = self.waze.get_route_traffic(orig_coords, dest_coords)

        waze_ok = waze_res.get("success", False)

        # 2. Case A: Google Routes API (Golden standard for Dhaka)
        if google_ok:
            travel_time = google_res["travel_time_min"]
            free_flow = google_res["free_flow_time_min"]
            delay = google_res["traffic_delay_min"]
            speed = google_res["speed_kmh"]
            source_label = "Google Routes Live"

        # Case B: Waze Live crowdsourced fallback
        elif waze_ok:
            travel_time = waze_res["travel_time_min"]
            free_flow = waze_res["free_flow_time_min"]
            delay = waze_res["traffic_delay_min"]
            speed = waze_res["speed_kmh"]
            source_label = "Waze Live"

        # Case C: Offline / Simulation Fallback
        else:
            hour = now.hour + (now.minute / 60.0)
            is_weekend = now.weekday() in [4, 5]

            rush_factor = 1.0
            if not is_weekend:
                if 8.0 <= hour <= 10.5:
                    rush_factor = 2.4 + np.random.uniform(-0.2, 0.4)
                elif 17.0 <= hour <= 21.0:
                    rush_factor = 2.7 + np.random.uniform(-0.2, 0.5)
                elif 12.0 <= hour <= 15.0:
                    rush_factor = 1.5 + np.random.uniform(-0.15, 0.25)
                else:
                    rush_factor = 1.0 + np.random.uniform(0.0, 0.15)
            else:
                rush_factor = 1.6 + np.random.uniform(-0.2, 0.25) if 16.0 <= hour <= 21.0 else 1.0 + np.random.uniform(0.0, 0.1)

            weather_factor = 1.0
            if weather.get("weather") == "Heavy Rain":
                weather_factor = 1.45
            elif weather.get("weather") == "Light Rain":
                weather_factor = 1.15

            free_flow = free_flow_fallback
            travel_time = round(free_flow * rush_factor * weather_factor, 1)
            delay = max(0.0, round(travel_time - free_flow, 1))
            speed = round(road_len / max(travel_time / 60.0, 0.01), 1)
            source_label = "Simulation"

        # 3. Macro congestion level
        ratio = travel_time / max(free_flow, 0.1)
        if ratio < 1.25:
            traffic_level = "NORMAL"
            upstream_spd = round(speed * np.random.uniform(0.98, 1.04), 1)
            downstream_spd = round(speed * np.random.uniform(0.97, 1.03), 1)
        elif ratio < 1.75:
            traffic_level = "SLOW"
            upstream_spd = round(min(speed * 1.10, 50.0), 1)
            downstream_spd = round(max(speed * 0.90, 6.0), 1)
        else:
            traffic_level = "TRAFFIC_JAM"
            upstream_spd = round(min(speed * 1.20, 50.0), 1)
            downstream_spd = round(max(speed * 0.82, 4.0), 1)

        return {
            "travel_time_min": travel_time,
            "free_flow_time_min": free_flow,
            "traffic_speed_kmh": speed,
            "traffic_level": traffic_level,
            "traffic_delay_min": delay,
            "congestion_ratio": round(ratio, 2),
            "source_label": source_label,
            "upstream_speed_kmh": upstream_spd,
            "downstream_speed_kmh": downstream_spd,
            "google_time_min": google_res.get("travel_time_min") if google_ok else None,
            "google_delay_min": google_res.get("traffic_delay_min") if google_ok else None,
            "waze_time_min": waze_res.get("travel_time_min") if waze_ok else None,
            "waze_delay_min": waze_res.get("traffic_delay_min") if waze_ok else None,
        }


# Alias for explicit naming
GoogleWazeTrafficEngine = DualTrafficEngine
