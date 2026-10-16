"""
TomTom API Key Verification Script
Tests if your TomTom API key pool is active and functioning by querying live route traffic.
Uses Python standard library (no extra pip packages required).

Run:
    py -3 tools/test_tomtom_key.py
"""

import os
import sys
import json
import urllib.request
import urllib.error

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Read keys strictly from environment or .env file (supports comma-separated pool)
KEYS = []
raw_keys = os.getenv("TOMTOM_API_KEYS", "") or os.getenv("TOMTOM_API_KEY", "")

for env_loc in [os.path.join(BASE_DIR, ".env"), os.path.join(os.path.dirname(__file__), ".env"), ".env"]:
    if os.path.exists(env_loc):
        with open(env_loc, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("TOMTOM_API_KEYS="):
                    raw_keys = line.split("=", 1)[1].strip("\"'")
                elif line.startswith("TOMTOM_API_KEY=") and not raw_keys:
                    raw_keys = line.split("=", 1)[1].strip("\"'")
        break

for k in raw_keys.replace(";", ",").replace("\n", ",").split(","):
    k = k.strip().strip("\"'")
    if k and k not in KEYS:
        KEYS.append(k)

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

                print(f"     [OK] Route: {route_name}")
                print(f"          - Distance:         {distance_meters / 1000.0:.2f} km")
                print(f"          - Live Travel Time: {travel_time_sec / 60.0:.1f} mins")
                print(f"          - Traffic Delay:    {traffic_delay_sec / 60.0:.1f} mins")
                return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"     [Error on {route_name}]: HTTP {e.code}")
        try:
            err_json = json.loads(error_body)
            print(f"        Detail: {err_json.get('detailedError', {}).get('message', error_body)}")
        except Exception:
            print(f"        Response: {error_body}")
        return False
    except Exception as e:
        print(f"     [Connection Error on {route_name}]: {e}")
        return False

def test_tomtom(keys_list: list):
    if not keys_list:
        print("[Error] No TomTom API keys found! Please set TOMTOM_API_KEYS in .env")
        return

    print("=" * 65)
    print(f"TomTom API Key Pool Verification ({len(keys_list)} Key(s) Found)")
    print(f"Total Theoretical Pool Quota: {len(keys_list) * 2500:,} requests / day")
    print("=" * 65)

    active_keys = 0
    for idx, api_key in enumerate(keys_list, 1):
        masked_key = (api_key[:4] + "..." + api_key[-4:]) if len(api_key) > 8 else "***"
        print(f"\n---> Testing Key #{idx}/{len(keys_list)}: {masked_key}")
        sample_route = ROUTES_TO_TEST[0]
        if test_single_route(api_key, sample_route["name"], sample_route["origin"], sample_route["dest"]):
            print(f"     Status: ACTIVE & VERIFIED (2,500 calls/day ready)")
            active_keys += 1
        else:
            print(f"     Status: FAILED / RATE LIMITED")

    print("\n" + "=" * 65)
    print(f"Pool Summary: {active_keys}/{len(keys_list)} Keys Active")
    print(f"Effective Daily Capacity: {active_keys * 2500:,} requests / day")
    print("=" * 65)

if __name__ == "__main__":
    target_keys = [sys.argv[1]] if len(sys.argv) > 1 else KEYS
    test_tomtom(target_keys)
