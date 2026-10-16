"""
Alternative Route Advisor & Congestion Bypass Engine
=====================================================
Analyzes live traffic on Dhaka routes and OpenStreetMap road network.
When excessive congestion / traffic jam is detected or predicted:
  1. Automatically queries TomTom Routing & Traffic API across key pool with maxAlternatives.
  2. Analyzes candidate OSM bypass corridors (Flyovers, Expressways, Secondary Bypasses).
  3. Recommends the fastest alternative route with exact travel time savings and distance delta.
"""

import os
import sys
import time
import math
import json
import datetime
import requests

# Load .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("\"'"))

# Import Key Pool and OSM Network from collect_data
try:
    from src.collect_data import KEY_POOL, OSM_NETWORK, ROUTES, get_live_weather
except ImportError:
    sys.path.append(os.path.dirname(__file__))
    from collect_data import KEY_POOL, OSM_NETWORK, ROUTES, get_live_weather

# Known Dhaka Strategic Bypass Points & Flyovers (from OSM Road Network)
DHAKA_BYPASS_WAYPOINTS = [
    {"name": "Dhaka Elevated Expressway / Airport", "coords": (23.8510, 90.4075), "tag": "Expressway"},
    {"name": "Mirpur-Airport / ECB Chattar Flyover", "coords": (23.8228, 90.3932), "tag": "Flyover"},
    {"name": "Kalshi Flyover Bypass",               "coords": (23.8241, 90.3780), "tag": "Flyover"},
    {"name": "Bijoy Sarani / Link Bypass",          "coords": (23.7650, 90.3875), "tag": "Arterial"},
    {"name": "Manik Mia Ave / Asad Gate Bypass",    "coords": (23.7600, 90.3725), "tag": "Arterial"},
    {"name": "Hatirjheel Expressway Bypass",         "coords": (23.7712, 90.4105), "tag": "Expressway"},
    {"name": "Kuril - Purbachal 300ft Expressway",  "coords": (23.8197, 90.4190), "tag": "Expressway"},
    {"name": "Gabtoli - Ring Road Bypass",          "coords": (23.7845, 90.3475), "tag": "Arterial"},
    {"name": "Rampura - Badda Link Bypass",         "coords": (23.7788, 90.4267), "tag": "Arterial"},
    {"name": "Mayor Hanif Flyover (Jatrabari)",     "coords": (23.7115, 90.4340), "tag": "Flyover"}
]


def haversine_km(c1, c2):
    lat1, lon1, lat2, lon2 = c1[0], c1[1], c2[0], c2[1]
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_alternative_routes(origin_coords, dest_coords, route_name="Custom Route",
                            delay_threshold_min=4.0, congestion_ratio_threshold=1.30):
    """
    Evaluates a route for excessive congestion. If congestion exceeds thresholds,
    queries TomTom Routing API for alternatives and evaluates OSM bypass corridors.
    Returns a comprehensive advice report.
    """
    orig_lat, orig_lon = origin_coords
    dest_lat, dest_lon = dest_coords

    api_key = KEY_POOL.get_next_key() if KEY_POOL and KEY_POOL.total_keys > 0 else None
    if not api_key:
        return {
            "error": "No TomTom API key available in KEY_POOL.",
            "is_excessive_jam": False,
            "recommendation": "Unable to check alternatives (Missing API Key)."
        }

    # 1. Fetch primary route and TomTom native alternatives (maxAlternatives=2)
    url = f"https://api.tomtom.com/routing/1/calculateRoute/{orig_lat},{orig_lon}:{dest_lat},{dest_lon}/json"
    params = {
        "key": api_key,
        "traffic": "true",
        "travelMode": "car",
        "computeTravelTimeFor": "all",
        "maxAlternatives": 2
    }

    try:
        res = requests.get(url, params=params, timeout=8)
        KEY_POOL.record_result(api_key, res.status_code)
        if res.status_code != 200:
            return {"error": f"TomTom API status {res.status_code}", "is_excessive_jam": False}
        data = res.json()
    except Exception as e:
        KEY_POOL.record_result(api_key, 0)
        return {"error": str(e), "is_excessive_jam": False}

    routes = data.get("routes", [])
    if not routes:
        return {"error": "No routes returned by TomTom", "is_excessive_jam": False}

    # Parse Primary Route
    p_summary = routes[0].get("summary", {})
    p_tt_min = round(p_summary.get("travelTimeInSeconds", 0) / 60.0, 1)
    p_delay_min = round(p_summary.get("trafficDelayInSeconds", 0) / 60.0, 1)
    p_no_traffic = round(p_summary.get("noTrafficTravelTimeInSeconds", max(p_tt_min * 60 - p_delay_min * 60, 60)) / 60.0, 1)
    p_dist_km = round(p_summary.get("lengthInMeters", 0) / 1000.0, 2)
    p_speed_kmh = round(p_dist_km / max(p_tt_min / 60.0, 0.01), 1)

    congestion_ratio = round(p_tt_min / max(p_no_traffic, 0.1), 2)
    is_excessive_jam = (p_delay_min >= delay_threshold_min) or (congestion_ratio >= congestion_ratio_threshold)

    primary_info = {
        "name": f"{route_name} (Primary Route)",
        "travel_time_min": p_tt_min,
        "free_flow_time_min": p_no_traffic,
        "traffic_delay_min": p_delay_min,
        "distance_km": p_dist_km,
        "traffic_speed_kmh": p_speed_kmh,
        "congestion_ratio": congestion_ratio,
        "traffic_level": "TRAFFIC_JAM" if congestion_ratio >= 1.75 else ("SLOW" if congestion_ratio >= 1.25 else "NORMAL")
    }

    alternatives = []

    # 2. Check TomTom Native Alternatives
    for i, r in enumerate(routes[1:], 1):
        s = r.get("summary", {})
        alt_tt = round(s.get("travelTimeInSeconds", 0) / 60.0, 1)
        alt_delay = round(s.get("trafficDelayInSeconds", 0) / 60.0, 1)
        alt_dist = round(s.get("lengthInMeters", 0) / 1000.0, 2)
        alt_speed = round(alt_dist / max(alt_tt / 60.0, 0.01), 1)
        time_saved = round(p_tt_min - alt_tt, 1)

        alternatives.append({
            "name": f"Alternative {i} (TomTom Alternate)",
            "via": f"Alternate Corridor #{i}",
            "travel_time_min": alt_tt,
            "traffic_delay_min": alt_delay,
            "distance_km": alt_dist,
            "traffic_speed_kmh": alt_speed,
            "time_saved_min": time_saved,
            "is_faster": time_saved > 0
        })

    # 3. If primary route has excessive delay and few/no alternatives, check relevant OSM bypass waypoints
    if is_excessive_jam and len(alternatives) < 2:
        direct_dist = haversine_km(origin_coords, dest_coords)
        for wp in DHAKA_BYPASS_WAYPOINTS:
            w_coords = wp["coords"]
            # Check if waypoint is reasonably situated between origin and dest
            d_orig = haversine_km(origin_coords, w_coords)
            d_dest = haversine_km(w_coords, dest_coords)
            # Must not be an absurd detour (within 1.6x of direct distance)
            if (d_orig + d_dest) <= max(direct_dist * 1.6, direct_dist + 5.0) and d_orig > 0.5 and d_dest > 0.5:
                # Query TomTom via waypoint using next key in pool
                alt_key = KEY_POOL.get_next_key()
                via_url = f"https://api.tomtom.com/routing/1/calculateRoute/{orig_lat},{orig_lon}:{w_coords[0]},{w_coords[1]}:{dest_lat},{dest_lon}/json"
                try:
                    v_res = requests.get(via_url, params={"key": alt_key, "traffic": "true"}, timeout=7)
                    KEY_POOL.record_result(alt_key, v_res.status_code)
                    if v_res.status_code == 200:
                        v_summary = v_res.json()["routes"][0]["summary"]
                        v_tt = round(v_summary.get("travelTimeInSeconds", 0) / 60.0, 1)
                        v_delay = round(v_summary.get("trafficDelayInSeconds", 0) / 60.0, 1)
                        v_dist = round(v_summary.get("lengthInMeters", 0) / 1000.0, 2)
                        v_speed = round(v_dist / max(v_tt / 60.0, 0.01), 1)
                        time_saved = round(p_tt_min - v_tt, 1)

                        alternatives.append({
                            "name": f"OSM Bypass via {wp['name']}",
                            "via": wp["name"],
                            "travel_time_min": v_tt,
                            "traffic_delay_min": v_delay,
                            "distance_km": v_dist,
                            "traffic_speed_kmh": v_speed,
                            "time_saved_min": time_saved,
                            "is_faster": time_saved > 0
                        })
                        if len(alternatives) >= 3:
                            break
                except Exception:
                    continue

    # Sort alternatives by fastest travel time
    alternatives.sort(key=lambda x: x["travel_time_min"])

    # 4. Formulate intelligent recommendation
    if is_excessive_jam:
        faster_alts = [a for a in alternatives if a["time_saved_min"] > 0]
        if faster_alts:
            best = faster_alts[0]
            rec = (f"⚠️ EXCESSIVE TRAFFIC JAM DETECTED (+{p_delay_min:.1f}m delay, {primary_info['traffic_level']}). "
                   f"SUGGESTED ALTERNATIVE: Take '{best['name']}'. "
                   f"Saves {best['time_saved_min']:.1f} minutes! "
                   f"(ETA: {best['travel_time_min']:.1f}m vs {p_tt_min:.1f}m)")
        else:
            rec = (f"⚠️ TRAFFIC CONGESTION on Primary Route (+{p_delay_min:.1f}m delay). "
                   f"All monitored alternatives currently experience similar or longer transit times. "
                   f"Staying on primary route or delaying departure by 20-30 mins recommended.")
    else:
        rec = f"✅ Primary route traffic is flowing normally (+{p_delay_min:.1f}m delay, {primary_info['traffic_level']}). No detour necessary."

    return {
        "route_name": route_name,
        "is_excessive_jam": is_excessive_jam,
        "primary": primary_info,
        "alternatives": alternatives,
        "recommendation": rec
    }


try:
    if sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

def print_advisor_report(report: dict):
    """Pretty prints an alternative route advisor report."""
    if "error" in report:
        print(f"\n[Route Advisor Error]: {report['error']}")
        return

    p = report["primary"]
    print("\n" + "=" * 90)
    print(f"[ROUTE ADVISOR] Dhaka Route Congestion Advisor: {report['route_name']}")
    print("=" * 90)
    print(f"Primary Status:    {p['traffic_level']} | Speed: {p['traffic_speed_kmh']} km/h")
    print(f"Distance:          {p['distance_km']} km")
    print(f"Live Travel Time:  {p['travel_time_min']} mins (Free-flow baseline: {p['free_flow_time_min']} mins)")
    print(f"Traffic Delay:     +{p['traffic_delay_min']} mins (Congestion Ratio: {p['congestion_ratio']}x)")
    print("-" * 90)

    alts = report.get("alternatives", [])
    if alts:
        print(f"Alternative Route Options ({len(alts)} found):")
        for i, a in enumerate(alts, 1):
            saved_str = f"Saves {a['time_saved_min']} mins" if a['time_saved_min'] > 0 else f"+{abs(a['time_saved_min'])} mins slower"
            fast_badge = "[* RECOMMENDED]" if a['is_faster'] and i == 1 else ""
            print(f"  [{i}] {a['name']:<38} | {a['distance_km']:<5.1f}km | {a['travel_time_min']:<5.1f}min | {saved_str:<18} {fast_badge}")
    else:
        print("No immediate detour alternatives required.")

    print("-" * 90)
    print(f"Advice: {report['recommendation']}")
    print("=" * 90 + "\n")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Dhaka Traffic Prediction & Alternative Route Advisor")
    parser.add_argument("--route", type=str, default="", help="Predefined route ID (e.g. 'Mirpur 10 -> Farmgate')")
    parser.add_argument("--origin", type=str, default="", help="Origin coordinates 'lat,lon'")
    parser.add_argument("--dest", type=str, default="", help="Destination coordinates 'lat,lon'")
    parser.add_argument("--threshold", type=float, default=3.0, help="Traffic delay threshold in minutes to trigger alternatives (default: 3.0)")
    args = parser.parse_args()

    # Predefined route lookup
    if args.route:
        matched = [r for r in ROUTES if args.route.lower() in r["route_id"].lower()]
        if not matched:
            print(f"Route '{args.route}' not found in standard routes. Available routes:")
            for r in ROUTES[:10]:
                print(f"  - {r['route_id']}")
            return
        target_route = matched[0]
        report = find_alternative_routes(
            target_route["origin_coords"],
            target_route["dest_coords"],
            route_name=target_route["route_id"],
            delay_threshold_min=args.threshold
        )
        print_advisor_report(report)
        return

    # Custom origin / destination coordinates
    if args.origin and args.dest:
        try:
            o_lat, o_lon = map(float, args.origin.split(","))
            d_lat, d_lon = map(float, args.dest.split(","))
            report = find_alternative_routes((o_lat, o_lon), (d_lat, d_lon), route_name="Custom Query", delay_threshold_min=args.threshold)
            print_advisor_report(report)
            return
        except Exception as e:
            print(f"Error parsing coordinates: {e}")
            return

    # Default interactive sample demo
    print("\nRunning Alternative Route Advisor demonstration on sample corridors...")
    demo_routes = [
        ("Mirpur 10 -> Farmgate", (23.8069, 90.3687), (23.7570, 90.3888)),
        ("Uttara -> Mohakhali",   (23.8759, 90.3795), (23.7776, 90.4054)),
        ("Savar -> Dhanmondi",    (23.8467, 90.2575), (23.7533, 90.3769))
    ]
    for r_name, orig, dest in demo_routes:
        report = find_alternative_routes(orig, dest, route_name=r_name, delay_threshold_min=args.threshold)
        print_advisor_report(report)


if __name__ == "__main__":
    main()
