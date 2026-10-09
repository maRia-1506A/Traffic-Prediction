"""
Historical Data Synthesizer
Generates a realistic historical dataset for 14-30 days of traffic across all routes.
Allows immediate training of machine learning models before collecting weeks of live data.
"""

import os
import datetime
import numpy as np
import pandas as pd
from collect_data import ROUTES, DATA_DIR, CSV_PATH

def generate_historical_dataset(days_back=14, interval_minutes=15):
    """
    Simulates rich 15-minute interval historical traffic & weather logs for all configured routes.
    """
    print(f"Generating {days_back} days of historical traffic logs (every {interval_minutes} mins)...")
    records = []
    
    end_time = datetime.datetime.now()
    start_time = end_time - datetime.timedelta(days=days_back)
    
    current_time = start_time
    
    # Track state per route for realistic lag transition
    route_prev_state = {r["route_id"]: "NORMAL" for r in ROUTES}
    
    while current_time <= end_time:
        timestamp_str = current_time.strftime("%Y-%m-%d %H:%M")
        day_name = current_time.strftime("%A")
        hour_val = current_time.hour
        hour_float = current_time.hour + (current_time.minute / 60.0)
        is_weekend = "Yes" if current_time.weekday() in [4, 5] else "No"
        
        # Weather simulation
        rain_prob = 0.15 if current_time.month in [6, 7, 8, 9, 10] else 0.05
        is_raining = np.random.rand() < rain_prob
        
        if is_raining:
            weather = np.random.choice(["Light Rain", "Heavy Rain"], p=[0.7, 0.3])
            rainfall_mm = round(np.random.uniform(2.0, 25.0), 1) if weather == "Heavy Rain" else round(np.random.uniform(0.2, 3.5), 1)
            temp_c = round(np.random.uniform(24.0, 28.0), 1)
        else:
            weather = np.random.choice(["Clear", "Cloudy", "Fog"], p=[0.75, 0.20, 0.05])
            rainfall_mm = 0.0
            temp_c = round(np.random.uniform(26.0, 35.0), 1)

        for route in ROUTES:
            free_flow = route["free_flow_time_min"]
            road_len = route["road_length_km"]
            
            # 1. Base Rush Multipliers
            rush_multiplier = 1.0
            if is_weekend == "No":
                if 8.0 <= hour_float <= 10.5:     # Morning Rush
                    rush_multiplier = np.random.uniform(1.8, 2.6)
                elif 17.0 <= hour_float <= 20.5:  # Evening Rush
                    rush_multiplier = np.random.uniform(2.0, 2.8)
                elif 12.0 <= hour_float <= 15.0:  # Afternoon
                    rush_multiplier = np.random.uniform(1.3, 1.7)
                elif 0.0 <= hour_float <= 6.0:    # Night
                    rush_multiplier = np.random.uniform(0.95, 1.05)
                else:
                    rush_multiplier = np.random.uniform(1.1, 1.35)
            else:
                if 16.0 <= hour_float <= 21.0:
                    rush_multiplier = np.random.uniform(1.3, 1.7)
                else:
                    rush_multiplier = np.random.uniform(0.95, 1.2)

            # 2. Weather Impact
            weather_multiplier = 1.0
            if weather == "Heavy Rain":
                weather_multiplier = np.random.uniform(1.35, 1.6)
            elif weather == "Light Rain":
                weather_multiplier = np.random.uniform(1.1, 1.25)

            # 3. Incident impact
            has_accident = "Yes" if np.random.rand() < 0.02 else "No"
            incident_multiplier = 1.5 if has_accident == "Yes" else 1.0

            has_construction = "Yes" if "Savar" in route["route_id"] and np.random.rand() < 0.25 else "No"
            construction_multiplier = 1.2 if has_construction == "Yes" else 1.0

            # Compute actual travel time
            total_multiplier = rush_multiplier * weather_multiplier * incident_multiplier * construction_multiplier
            travel_time = round(free_flow * total_multiplier, 1)
            speed = round(road_len / (travel_time / 60.0), 1)

            # Traffic Level
            ratio = travel_time / free_flow
            if ratio < 1.3:
                traffic_level = "NORMAL"
            elif ratio < 1.8:
                traffic_level = "SLOW"
            else:
                traffic_level = "TRAFFIC_JAM"

            prev_state = route_prev_state[route["route_id"]]
            route_prev_state[route["route_id"]] = traffic_level

            records.append({
                "timestamp": timestamp_str,
                "road_route_id": route["route_id"],
                "latitude": route["origin_coords"][0],
                "longitude": route["origin_coords"][1],
                "traffic_speed_kmh": speed,
                "travel_time_min": travel_time,
                "free_flow_time_min": free_flow,
                "traffic_level": traffic_level,
                "day_of_week": day_name,
                "hour": hour_val,
                "is_weekend": is_weekend,
                "weather": weather,
                "temperature_c": temp_c,
                "rainfall_mm": rainfall_mm,
                "road_type": route["road_type"],
                "road_length_km": route["road_length_km"],
                "num_lanes": route["num_lanes"],
                "accident_incident": has_accident,
                "road_construction": has_construction,
                "special_event": "No",
                "prev_traffic_5min": prev_state,
                "prev_traffic_15min": prev_state,
                "prev_traffic_30min": prev_state,
                "target_traffic_level": traffic_level
            })

        current_time += datetime.timedelta(minutes=interval_minutes)

    df = pd.DataFrame(records)
    os.makedirs(DATA_DIR, exist_ok=True)
    df.to_csv(CSV_PATH, index=False)
    print(f"✅ Generated {len(df)} records saved to {CSV_PATH}")

if __name__ == "__main__":
    generate_historical_dataset(days_back=14, interval_minutes=15)
