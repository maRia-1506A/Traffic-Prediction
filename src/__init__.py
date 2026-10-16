"""
Traffic Prediction Machine — Core Package
"""
from .collect_data import KEY_POOL, OSM_NETWORK, ROUTES, collect_current_snapshot
from .route_advisor import find_alternative_routes
from .fetch_roads import fetch_area, build_overpass_query
