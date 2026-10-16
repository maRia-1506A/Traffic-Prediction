"""
Weather API Key Verification Script
Tests if your Weather API key is active and functioning.
Uses Python's built-in standard library (no pip packages needed).

Run:
    py -3 tools/test_weather_key.py
"""

import os
import sys
import json
import urllib.request
import urllib.error

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Load key from environment or .env file
def _get_key():
    for name in ("OPENWEATHERMAP_API_KEY", "OPENWEATHER_API_KEY"):
        val = os.getenv(name)
        if val:
            return val
    for env_loc in [os.path.join(BASE_DIR, ".env"), os.path.join(os.path.dirname(__file__), ".env"), ".env"]:
        if os.path.exists(env_loc):
            with open(env_loc, "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("OPENWEATHERMAP_API_KEY="):
                        return line.split("=", 1)[1].strip().strip("\"'")
    return ""

DEFAULT_KEY = _get_key()

def test_openweathermap(api_key: str):
    masked = (api_key[:4] + "..." + api_key[-4:]) if len(api_key) > 8 else "***"
    print("=" * 60)
    print("Testing against OpenWeatherMap...")
    print(f"API Key: {masked} (Protected)")
    print("=" * 60)

    url = f"https://api.openweathermap.org/data/2.5/weather?q=Dhaka&appid={api_key}&units=metric"

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "WeatherKeyTester/1.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                city = data.get("name", "Dhaka")
                temp = data.get("main", {}).get("temp", "N/A")
                weather_desc = data.get("weather", [{}])[0].get("description", "N/A")
                humidity = data.get("main", {}).get("humidity", "N/A")

                print("\n[SUCCESS] Your OpenWeatherMap API key is ACTIVE and working!")
                print(f" - Location:    {city}")
                print(f" - Temperature: {temp} deg C")
                print(f" - Condition:   {weather_desc.capitalize()}")
                print(f" - Humidity:    {humidity}%\n")
                return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        if e.code == 401:
            print("\n[ERROR 401] Unauthorized / Invalid API Key!")
            print(" - If newly registered, wait 10-60 minutes for activation.")
        else:
            print(f"\n[HTTP Error {e.code}]: {error_body}")
        return False
    except Exception as e:
        print(f"\n[Connection Error]: {e}")
        return False

if __name__ == "__main__":
    k = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_KEY
    if not k:
        print("[Error] No OpenWeatherMap API key provided or found in .env.")
        sys.exit(1)
    test_openweathermap(k)
