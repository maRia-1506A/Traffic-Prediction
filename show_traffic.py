"""
Live Traffic Dashboard
========================
Collects a fresh snapshot every N seconds and displays it
in a live-refreshing terminal table — similar to TomTom output.

Run:
    python show_traffic.py            (refresh every 60 seconds)
    python show_traffic.py --once     (show once and exit)
    python show_traffic.py --interval 30  (refresh every 30 seconds)
"""

import os
import sys
import time
import datetime
import requests

# ── optional: load .env ──────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import pandas as pd
import numpy as np

# ── Config ───────────────────────────────────────────────────────────────────
TOMTOM_API_KEY        = os.getenv("TOMTOM_API_KEY", "")
OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")
DATA_DIR  = os.path.join(os.path.dirname(__file__), "data")
CSV_PATH  = os.path.join(DATA_DIR, "traffic_data.csv")
REFRESH_S = 60          # seconds between refreshes

# ── Route definitions (same as collect_data.py) ───────────────────────────────
ROUTES = [
    {
        "route_id": "Savar -> Dhanmondi",
        "origin_coords": (23.8467, 90.2575),
        "dest_coords":   (23.7461, 90.3742),
        "road_length_km": 24.5,
        "free_flow_time_min": 35.0,
    },
    {
        "route_id": "Mirpur 10 -> Farmgate",
        "origin_coords": (23.8069, 90.3687),
        "dest_coords":   (23.7570, 90.3888),
        "road_length_km": 8.5,
        "free_flow_time_min": 15.0,
    },
    {
        "route_id": "Mirpur 10 -> Karwan Bazar",
        "origin_coords": (23.8069, 90.3687),
        "dest_coords":   (23.7513, 90.3945),
        "road_length_km": 9.5,
        "free_flow_time_min": 18.0,
    },
    {
        "route_id": "Mirpur 12 -> Mirpur 10",
        "origin_coords": (23.8241, 90.3659),
        "dest_coords":   (23.8069, 90.3687),
        "road_length_km": 3.2,
        "free_flow_time_min": 7.0,
    },
    {
        "route_id": "Mirpur 1 -> Gabtoli",
        "origin_coords": (23.7854, 90.3603),
        "dest_coords":   (23.7856, 90.3466),
        "road_length_km": 3.0,
        "free_flow_time_min": 6.0,
    },
    {
        "route_id": "Mirpur 1 -> Dhanmondi 27",
        "origin_coords": (23.7854, 90.3603),
        "dest_coords":   (23.7461, 90.3742),
        "road_length_km": 6.8,
        "free_flow_time_min": 13.0,
    },
    {
        "route_id": "Uttara -> Mohakhali",
        "origin_coords": (23.8759, 90.3795),
        "dest_coords":   (23.7776, 90.4054),
        "road_length_km": 14.2,
        "free_flow_time_min": 22.0,
    },
    {
        "route_id": "Uttara -> Airport",
        "origin_coords": (23.8759, 90.3795),
        "dest_coords":   (23.8433, 90.4002),
        "road_length_km": 4.5,
        "free_flow_time_min": 8.0,
    },
    {
        "route_id": "Airport -> Banani",
        "origin_coords": (23.8433, 90.4002),
        "dest_coords":   (23.7937, 90.4036),
        "road_length_km": 7.5,
        "free_flow_time_min": 14.0,
    },
    {
        "route_id": "Savar -> Ashulia",
        "origin_coords": (23.8467, 90.2575),
        "dest_coords":   (23.8967, 90.3200),
        "road_length_km": 9.0,
        "free_flow_time_min": 12.0,
    },
]

# ── Weather fetch ─────────────────────────────────────────────────────────────
def get_weather(lat, lon):
    if OPENWEATHERMAP_API_KEY:
        try:
            r = requests.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"lat": lat, "lon": lon, "appid": OPENWEATHERMAP_API_KEY, "units": "metric"},
                timeout=5,
            )
            if r.status_code == 200:
                d    = r.json()
                temp = d.get("main", {}).get("temp", 28.0)
                wid  = d.get("weather", [{}])[0].get("id", 800)
                if 200 <= wid < 300:  label = "Heavy Rain"
                elif 300 <= wid < 400: label = "Light Rain"
                elif 500 <= wid < 600: label = "Light Rain" if wid < 502 else "Heavy Rain"
                elif 700 <= wid < 800: label = "Fog"
                elif wid == 800:       label = "Clear"
                else:                  label = "Cloudy"
                return label, round(temp, 1)
        except Exception:
            pass
    # Fallback: Open-Meteo (free, no key)
    try:
        r = requests.get(
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}&current=temperature_2m,precipitation,weather_code&timezone=auto",
            timeout=5,
        )
        if r.status_code == 200:
            cur   = r.json().get("current", {})
            temp  = cur.get("temperature_2m", 28.0)
            prec  = cur.get("precipitation", 0.0)
            code  = cur.get("weather_code", 0)
            if prec > 5 or code in [63, 65, 82]:  label = "Heavy Rain"
            elif prec > 0.1 or code in [51, 61, 80]: label = "Light Rain"
            elif code in [45, 48]:  label = "Fog"
            elif code in [1, 2, 3]: label = "Cloudy"
            else:                   label = "Clear"
            return label, round(temp, 1)
    except Exception:
        pass
    return "Clear", 28.0

# ── Traffic fetch ─────────────────────────────────────────────────────────────
def get_traffic(route, now, weather_label):
    o = route["origin_coords"]
    d = route["dest_coords"]
    ff = route["free_flow_time_min"]
    km = route["road_length_km"]

    if TOMTOM_API_KEY:
        try:
            url    = f"https://api.tomtom.com/routing/1/calculateRoute/{o[0]},{o[1]}:{d[0]},{d[1]}/json"
            params = {"key": TOMTOM_API_KEY, "traffic": "true", "travelMode": "car",
                      "computeTravelTimeFor": "all"}
            res = requests.get(url, params=params, timeout=7)
            if res.status_code == 200:
                summary = res.json()["routes"][0]["summary"]
                tt_sec  = summary.get("travelTimeInSeconds")
                if tt_sec:
                    no_traffic = summary.get("noTrafficTravelTimeInSeconds") or \
                                 max(tt_sec - summary.get("trafficDelayInSeconds", 0), ff * 60)
                    tt_min  = round(tt_sec / 60, 1)
                    ff_min  = round(no_traffic / 60, 1)
                    dist_km = round(summary.get("lengthInMeters", km * 1000) / 1000, 1)
                    speed   = round(dist_km / max(tt_min / 60, 0.01), 1)
                    ratio   = tt_min / max(ff_min, 1)
                    level   = "NORMAL" if ratio < 1.25 else ("SLOW" if ratio < 1.75 else "TRAFFIC_JAM")
                    return tt_min, ff_min, dist_km, speed, level
        except Exception:
            pass

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
        rf = 1.6 + np.random.uniform(-0.2, 0.3) if 16 <= hour <= 21 \
             else 1.0 + np.random.uniform(0.0, 0.15)

    wf = 1.5 + np.random.uniform(0.1, 0.3) if weather_label == "Heavy Rain" else \
         1.2 + np.random.uniform(0.05, 0.15) if weather_label == "Light Rain" else 1.0

    tt  = round(ff * rf * wf, 1)
    spd = round(km / max(tt / 60, 0.01), 1)
    ratio = tt / ff
    level = "NORMAL" if ratio < 1.3 else ("SLOW" if ratio < 1.8 else "TRAFFIC_JAM")
    return tt, ff, km, spd, level

# ── Snapshot ──────────────────────────────────────────────────────────────────
def collect_snapshot():
    now = datetime.datetime.now()
    rows = []
    weather_cache = {}

    for route in ROUTES:
        lat, lon = route["origin_coords"]
        key = (round(lat, 2), round(lon, 2))
        if key not in weather_cache:
            weather_cache[key] = get_weather(lat, lon)
        w_label, w_temp = weather_cache[key]

        tt, ff, km, spd, level = get_traffic(route, now, w_label)
        delay = round(tt - ff, 1)

        rows.append({
            "route_id": route["route_id"],
            "dist_km":  km,
            "tt_min":   tt,
            "ff_min":   ff,
            "delay_min": delay,
            "speed_kph": spd,
            "level":    level,
            "weather":  f"{w_label} ({w_temp}C)",
        })

    return rows, now

# ── Display ───────────────────────────────────────────────────────────────────
LEVEL_COLOR = {
    "NORMAL":      "NORMAL     ",
    "SLOW":        "SLOW       ",
    "TRAFFIC_JAM": "TRAFFIC_JAM",
}

def display(rows, now, mode_traffic, mode_weather, csv_path):
    os.system("cls" if os.name == "nt" else "clear")
    sep  = "=" * 116
    thin = "-" * 116

    ts = now.strftime("%Y-%m-%d %H:%M")
    print(sep)
    print(f"  [SNAPSHOT] {ts}  |  Traffic: {mode_traffic}  |  Weather: {mode_weather}")
    print(f"  Target CSV: {csv_path}")
    print(sep)

    hdr = f"  {'#':<3} | {'Route':<28} | {'Dist':>5} | {'Live Time':>9} | {'Normal':>7} | {'Delay':>8} | {'Speed':>9} | {'Level':<13}| {'Weather'}"
    print(hdr)
    print(thin)

    for i, r in enumerate(rows, 1):
        delay_str = f"+{r['delay_min']} m" if r["delay_min"] > 0 else "0.0 m"
        level_str = LEVEL_COLOR.get(r["level"], r["level"])
        print(
            f"  {i:<3} | "
            f"{r['route_id']:<28} | "
            f"{r['dist_km']:>4.1f}k | "
            f"{r['tt_min']:>7.1f} m | "
            f"{r['ff_min']:>5.1f} m | "
            f"{delay_str:>8} | "
            f"{r['speed_kph']:>7.1f} k | "
            f"{level_str:<13}| "
            f"{r['weather']}"
        )

    print(sep)

    # Count by level
    from collections import Counter
    counts = Counter(r["level"] for r in rows)
    total  = len(rows)
    parts  = [f"NORMAL: {counts.get('NORMAL',0)}/{total}",
              f"SLOW: {counts.get('SLOW',0)}/{total}",
              f"JAM: {counts.get('TRAFFIC_JAM',0)}/{total}"]
    print(f"  Current: {' | '.join(parts)}    Next refresh in {REFRESH_S}s  (Ctrl+C to stop)")
    print(sep)

# ── Save to CSV ───────────────────────────────────────────────────────────────
def save_csv(rows, now):
    day  = now.strftime("%A")
    ts   = now.strftime("%Y-%m-%d %H:%M")
    is_w = "Yes" if now.weekday() in [4, 5] else "No"

    new_rows = []
    for r in rows:
        new_rows.append({
            "timestamp":          ts,
            "road_route_id":      r["route_id"],
            "traffic_speed_kmh":  r["speed_kph"],
            "travel_time_min":    r["tt_min"],
            "free_flow_time_min": r["ff_min"],
            "traffic_level":      r["level"],
            "day_of_week":        day,
            "hour":               now.hour,
            "is_weekend":         is_w,
            "weather":            r["weather"],
        })

    df = pd.DataFrame(new_rows)
    os.makedirs(DATA_DIR, exist_ok=True)
    write_header = not os.path.exists(CSV_PATH) or os.path.getsize(CSV_PATH) == 0
    df.to_csv(CSV_PATH, mode="a", header=write_header, index=False)

# ── Main loop ─────────────────────────────────────────────────────────────────
def main():
    once     = "--once" in sys.argv
    interval = REFRESH_S
    for arg in sys.argv:
        if arg.startswith("--interval="):
            try: interval = int(arg.split("=")[1])
            except ValueError: pass

    mode_t = "Live TomTom API" if TOMTOM_API_KEY else "Simulation (no key)"
    mode_w = "Live OpenWeatherMap" if OPENWEATHERMAP_API_KEY else "Live Open-Meteo (free)"

    print("Collecting first snapshot...")
    while True:
        rows, now = collect_snapshot()
        display(rows, now, mode_t, mode_w, CSV_PATH)
        save_csv(rows, now)

        if once:
            break
        try:
            time.sleep(interval)
        except KeyboardInterrupt:
            print("\nDashboard stopped.")
            break

if __name__ == "__main__":
    main()
