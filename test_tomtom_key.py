"""
TomTom API Key Verification Script
Tests if your TomTom API key is active and functioning by querying live route traffic.
Uses Python standard library (no extra pip packages required).
"""

import os
import sys
import json
import urllib.request
import urllib.error

# Read key strictly from environment or .env file
KEY = os.getenv("TOMTOM_API_KEY", "")
env_file = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            if line.strip().startswith("TOMTOM_API_KEY="):
                KEY = line.strip().split("=", 1)[1].strip("\"'")

ROUTES_TO_TEST = [
    {
        "name": "Mirpur 10 -> Farmgate",
        "origin": (23.8069, 90.3687),
        "dest": (23.7570, 90.3888),
    },
    {
        "name": "Uttara -> Mohakhali",
        "origin": (23.8759, 90.3795),
        "dest": (23.7776, 90.4054),
    },
    {
        "name": "Gabtoli -> Kalyanpur",
        "origin": (23.7845, 90.3475),
        "dest": (23.7818, 90.3592),
    },
    {
        "name": "Dhanmondi 27 -> Science Lab",
        "origin": (23.7533, 90.3769),
        "dest": (23.7397, 90.3831),
    },
    {
        "name": "ECB Chattar -> Airport",
        "origin": (23.8228, 90.3932),
        "dest": (23.8510, 90.4075),
    }
]

def test_single_route(api_key: str, route_name: str, origin: tuple, dest: tuple):
    orig_str = f"{origin[0]},{origin[1]}"
    dest_str = f"{dest[0]},{dest[1]}"
    url = (
        f"https://api.tomtom.com/routing/1/calculateRoute/"
        f"{orig_str}:{dest_str}/json"
        f"?key={api_key}&traffic=true&travelMode=car&computeTravelTimeFor=all"
    )

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TomTomTester/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                summary = data["routes"][0]["summary"]
                travel_time_sec = summary.get("travelTimeInSeconds", 0)
                traffic_delay_sec = summary.get("trafficDelayInSeconds", 0)
                distance_meters = summary.get("lengthInMeters", 0)

                print(f"\n[OK] Route: {route_name}")
                print(f"     - Distance:         {distance_meters / 1000.0:.2f} km")
                print(f"     - Live Travel Time: {travel_time_sec / 60.0:.1f} mins")
                print(f"     - Traffic Delay:    {traffic_delay_sec / 60.0:.1f} mins")
                return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"\n[Error on {route_name}]: HTTP {e.code}")
        try:
            err_json = json.loads(error_body)
            print(f"   Detail: {err_json.get('detailedError', {}).get('message', error_body)}")
        except Exception:
            print(f"   Response: {error_body}")
        return False
    except Exception as e:
        print(f"\n[Connection Error on {route_name}]: {e}")
        return False

def test_tomtom(api_key: str):
    if not api_key:
        print("[Error] No TomTom API key found! Please set TOMTOM_API_KEY in .env")
        return

    # Mask API key for privacy/security
    masked_key = (api_key[:4] + "..." + api_key[-4:]) if len(api_key) > 8 else "***"

    print("=" * 60)
    print("Testing against TomTom Routing & Traffic API...")
    print(f"API Key: {masked_key} (Protected)")
    print("=" * 60)

    success_count = 0
    for r in ROUTES_TO_TEST:
        if test_single_route(api_key, r["name"], r["origin"], r["dest"]):
            success_count += 1

    print("\n" + "=" * 60)
    if success_count > 0:
        print(f"Result: SUCCESS ({success_count}/{len(ROUTES_TO_TEST)} routes verified). Key is ACTIVE!")
    else:
        print("Result: All routes failed. Please check the error details above.")
    print("=" * 60)

if __name__ == "__main__":
    key = sys.argv[1] if len(sys.argv) > 1 else KEY
    test_tomtom(key)
