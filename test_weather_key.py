"""
Weather API Key Verification Script
Tests if your Weather API key is active and functioning.
Uses Python's built-in standard library (no pip packages needed).
"""

import os
import sys
import json
import urllib.request
import urllib.error

# Load key from environment or command-line arguments
DEFAULT_KEY = os.getenv("OPENWEATHER_API_KEY", "")

def test_openweathermap(api_key: str):
    print("=" * 60)
    print("Testing against OpenWeatherMap...")
    print(f"API Key: {api_key}")
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
            print("\n[STATUS: HTTP 401 - Unauthorized]")
            print(f"Server response: {error_body}")
            print("\nWhy this happens:")
            print(" 1. Newly created OpenWeatherMap keys take 10 to 60 minutes to activate.")
            print(" 2. If you just created this key, please wait a little and re-run this script.")
            print(" 3. Check your OpenWeatherMap account email to ensure you verified your account.")
        else:
            print(f"\n[HTTP Error {e.code}]: {error_body}")
        return False
    except urllib.error.URLError as e:
        print(f"\n[Connection Error]: {e.reason}")
        print("Please check your internet connection.")
        return False

def test_weatherapi(api_key: str):
    print("\n" + "=" * 60)
    print("Testing against WeatherAPI.com (Alternative Provider)...")
    print("=" * 60)
    
    url = f"http://api.weatherapi.com/v1/current.json?key={api_key}&q=Dhaka"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "WeatherKeyTester/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                current = data.get("current", {})
                print("\n[SUCCESS] Your WeatherAPI.com key is ACTIVE and working!")
                print(f" - Temperature: {current.get('temp_c')} deg C")
                print(f" - Condition:   {current.get('condition', {}).get('text')}")
                return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        if e.code == 401:
            print(f"[HTTP 401]: Not a valid WeatherAPI.com key.")
        return False
    except Exception:
        return False

if __name__ == "__main__":
    key = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_KEY
    if not key and os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                if line.startswith("OPENWEATHER_API_KEY="):
                    key = line.strip().split("=", 1)[1].strip("\"'")
    if not key:
        key = input("Enter your Weather API Key to test: ").strip()
    
    if key:
        success = test_openweathermap(key)
        if not success:
            test_weatherapi(key)
    else:
        print("No API key provided. Run with: python test_weather_key.py <API_KEY>")
