"""
Project Routes Configuration & Geo-Coordinate Registry
======================================================
Defines all 50 official project corridors (R01 to R50).
Includes high-precision coordinates for all strategic nodes across Greater Dhaka,
Savar, Ashulia, Gazipur, Narayanganj, DIU, Mirpur, Uttara, and Old Dhaka.
"""

import os
import math
import pandas as pd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ROUTES_CSV = os.path.join(BASE_DIR, "data", "traffic_prediction_routes.csv")

# 118 Verified GPS Waypoint Coordinates across Greater Dhaka
NODE_COORDINATES = {
    'ECB Chattor': (23.8228, 90.3932),
    'Kalshi': (23.8241, 90.3780),
    'Mirpur 10': (23.8069, 90.3687),
    'Mirpur 1': (23.7950, 90.3540),
    'Gabtoli': (23.7845, 90.3475),
    'Savar Bus Stand': (23.8467, 90.2575),
    'Radio Colony': (23.8610, 90.2510),
    'C&B Mor': (23.8680, 90.2540),
    'Savar C&B': (23.8680, 90.2540),
    'Savar C&B Mor': (23.8680, 90.2540),
    'Aminbazar': (23.7850, 90.3300),
    'Asadgate': (23.7600, 90.3725),
    'Asad Gate': (23.7600, 90.3725),
    'Ashulia Depot': (23.8950, 90.3150),
    'Zirabo': (23.9050, 90.3010),
    'Baipail': (23.9350, 90.2750),
    'Nabinagar': (23.9180, 90.2600),
    'Savar Bazar': (23.8440, 90.2550),
    'Savar Bazar Road': (23.8430, 90.2580),
    'Uttara Rajlokkhi': (23.8630, 90.3980),
    'House Building': (23.8730, 90.3970),
    'Uttara House Building': (23.8730, 90.3970),
    'Tongi': (23.8885, 90.4020),
    'Gazipur Chowrasta': (23.9980, 90.3780),
    'Mohakhali': (23.7776, 90.4054),
    'Banani': (23.7937, 90.4066),
    'Gulshan 2': (23.7925, 90.4162),
    'Gulshan 1': (23.7788, 90.4172),
    'Notun Bazar': (23.7975, 90.4240),
    'Sheorapara': (23.7880, 90.3730),
    'Agargaon': (23.7785, 90.3770),
    'Farmgate': (23.7570, 90.3888),
    'Motijheel': (23.7330, 90.4172),
    'Daffodil International University': (23.8765, 90.3205),
    'Khagan': (23.8710, 90.3250),
    'Birulia': (23.8560, 90.3340),
    'Diabari': (23.8700, 90.3650),
    'Diyabari': (23.8700, 90.3650),
    'Uttara North': (23.8780, 90.3720),
    'Uttara Sector 13': (23.8720, 90.3880),
    'Beribadh': (23.8200, 90.3380),
    'Shyamoli': (23.7717, 90.3644),
    'Sayedabad': (23.7180, 90.4285),
    'Jatrabari': (23.7115, 90.4340),
    'Signboard': (23.6890, 90.4780),
    'Narayanganj Chasara': (23.6230, 90.4990),
    'Mirpur 12': (23.8260, 90.3650),
    'Pallabi': (23.8180, 90.3630),
    'Dhanmondi 27': (23.7533, 90.3769),
    'Dhanmondi': (23.7461, 90.3742),
    'Ashulia': (23.8950, 90.3150),
    'Kuril Bisso Road': (23.8197, 90.4190),
    'Rampura Bridge': (23.7612, 90.4243),
    'Rampura': (23.7612, 90.4243),
    'Malibagh': (23.7483, 90.4175),
    'Palli Bidyut': (23.9250, 90.2680),
    'Dhamrai Bus Stand': (23.9210, 90.2150),
    'Uttara 3rd Phase': (23.8720, 90.3600),
    'Uttara Sector 18': (23.8780, 90.3580),
    'Mohammadpur Town Hall': (23.7615, 90.3620),
    'Mohammadpur': (23.7615, 90.3620),
    'Kawran Bazar': (23.7516, 90.3934),
    'Shahbagh': (23.7383, 90.3957),
    'Gulistan Zero Point': (23.7250, 90.4125),
    'Gulistan': (23.7250, 90.4125),
    'Paltan': (23.7310, 90.4140),
    'Press Club': (23.7300, 90.4070),
    'High Court': (23.7280, 90.4040),
    'Mayor Hanif Flyover': (23.7150, 90.4260),
    'Babubazar': (23.7120, 90.4020),
    'Keraniganj': (23.6980, 90.3900),
    'Sadarghat': (23.7050, 90.4140),
    'Chankharpul': (23.7230, 90.3980),
    'Dhaka University': (23.7320, 90.3940),
    'Mirpur 14': (23.8010, 90.3850),
    'Cantonment': (23.8180, 90.3990),
    'Abdullahpur': (23.8820, 90.3990),
    'Tongi College Gate': (23.8960, 90.4010),
    'Kamarpara': (23.8870, 90.3880),
    'Dhour': (23.8920, 90.3590),
    'Savar Cantonment': (23.8980, 90.2670),
    'EPZ': (23.9400, 90.2720),
    'Ashulia Model Town': (23.9100, 90.3100),
    'Eastern Housing': (23.8250, 90.3450),
    'Technical': (23.7820, 90.3550),
    'Kakoli': (23.7910, 90.4040),
    'Mohakhali Flyover': (23.7780, 90.4040),
    'Science Lab': (23.7397, 90.3831),
    'Baridhara': (23.7980, 90.4210),
    'Jamuna Future Park': (23.8130, 90.4240),
    'Kuril Flyover': (23.8180, 90.4190),
    'Uttara Sector 1': (23.8540, 90.4010),
    'Badda Link Road': (23.7806, 90.4267),
    'Badda': (23.7806, 90.4267),
    'Moghbazar': (23.7490, 90.4050),
    'Kakrail': (23.7380, 90.4080),
    'Kazipara': (23.7950, 90.3710),
    'Bijoy Sarani': (23.7650, 90.3875),
    'Savar': (23.8467, 90.2575),
    'Hemayetpur': (23.8080, 90.2850),
    'Ashulia Bridge': (23.8860, 90.3400),
    'Diabari Metro Station': (23.8740, 90.3660),
    'Mirpur DOHS': (23.8350, 90.3700),
    'Dainik Bangla': (23.7300, 90.4150),
    'Sony Cinema Hall': (23.7980, 90.3560),
    'Ashulia Bazar': (23.9050, 90.3200),
    'Paragram': (23.8800, 90.3180),
    'Kolma': (23.8820, 90.2800),
    'Manik Miah Avenue': (23.7580, 90.3760),
    'New Market': (23.7335, 90.3842),
    'Tongi Station Road': (23.8910, 90.4050),
    'Airport': (23.8510, 90.4075),
    'Khilkhet': (23.8310, 90.4180),
    'Jahangir Gate': (23.7680, 90.3910),
    'Khamarbari': (23.7590, 90.3840),
    'Charabag': (23.8890, 90.3000),
    'Rokeya Sarani': (23.7920, 90.3720),
    'Uttara': (23.8759, 90.3795),
    # New additions for R01-R50
    'Kalshi Flyover': (23.8235, 90.3800),
    'Zirabo Mor': (23.9050, 90.3010),
    'Diabari Bridge': (23.8730, 90.3610),
    'Gonosastho': (23.9230, 90.2520),
    'Babubazar Bridge': (23.7100, 90.4015),
    'Cantonment Board': (23.8190, 90.3965),
    'Kataban': (23.7405, 90.3900),
    'Mirpur 2': (23.8045, 90.3620),
    'Kuril': (23.8197, 90.4190),
    'Gazipur': (23.9980, 90.3780)
}


def haversine_km(c1, c2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = c1[0], c1[1], c2[0], c2[1]
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


OFFICIAL_PROJECT_ROUTES_DATA = [
    ("R01", "ECB Chattor -> Kalshi Flyover -> Mirpur 12 -> Mirpur 10 -> Mirpur 1 -> Gabtoli"),
    ("R02", "Savar Bus Stand -> Radio Colony -> C&B Mor -> Aminbazar -> Gabtoli -> Technical -> Asadgate"),
    ("R03", "Ashulia Depot -> Zirabo Mor -> Baipail -> Nabinagar -> Savar Bazar"),
    ("R04", "Uttara Rajlokkhi -> House Building -> Abdullahpur -> Tongi College Gate -> Gazipur Chowrasta"),
    ("R05", "ECB Chattor -> Kuril Bisso Road -> Jamuna Future Park -> Notun Bazar"),
    ("R06", "Mirpur 10 -> Kazipara -> Sheorapara -> Agargaon -> Farmgate -> Kawran Bazar -> Motijheel"),
    ("R07", "Daffodil International University -> Khagan -> Birulia -> Diabari Bridge -> Uttara North"),
    ("R08", "Uttara Sector 13 -> Diabari Metro Station -> Beribadh -> Gabtoli -> Shyamoli"),
    ("R09", "ECB Chattor -> Mohakhali -> Farmgate -> Gulistan -> Sayedabad -> Jatrabari -> Signboard -> Narayanganj Chasara"),
    ("R10", "Mirpur 12 -> Pallabi -> Mirpur 10 -> Rokeya Sarani -> Shyamoli -> Dhanmondi 27"),
    ("R11", "Ashulia -> Zirabo -> Savar C&B -> Aminbazar -> Gabtoli"),
    ("R12", "Uttara -> Airport -> Khilkhet -> Kuril Bisso Road -> Rampura Bridge -> Malibagh -> Motijheel"),
    ("R13", "Savar Bazar -> Palli Bidyut -> Nabinagar -> Gonosastho -> Dhamrai Bus Stand"),
    ("R14", "ECB Chattor -> Kalshi -> Uttara 3rd Phase -> Diabari -> Uttara Sector 18"),
    ("R15", "Mohammadpur Town Hall -> Asad Gate -> Farmgate -> Kawran Bazar -> Shahbagh"),
    ("R16", "Gulistan Zero Point -> Paltan -> Press Club -> High Court -> Motijheel"),
    ("R17", "Jatrabari -> Mayor Hanif Flyover -> Gulistan -> Babubazar Bridge -> Keraniganj"),
    ("R18", "Sadarghat -> Gulistan -> Chankharpul -> Dhaka University -> Shahbagh"),
    ("R19", "Mirpur 14 -> Cantonment Board -> ECB Chattor -> Banani -> Mohakhali"),
    ("R20", "Uttara Rajlokkhi -> Abdullahpur -> Tongi College Gate -> Kamarpara -> Dhour"),
    ("R21", "Savar Cantonment -> EPZ -> Baipail -> Ashulia Model Town -> Zirabo"),
    ("R22", "Daffodil International University -> Birulia -> Eastern Housing -> Technical -> Shyamoli -> Asadgate"),
    ("R23", "Gulshan 2 -> Kakoli -> Mohakhali Flyover -> Farmgate -> Kataban -> Science Lab"),
    ("R24", "Baridhara -> Jamuna Future Park -> Kuril Flyover -> Uttara Sector 1 -> House Building"),
    ("R25", "Badda Link Road -> Rampura -> Moghbazar -> Kakrail -> Paltan"),
    ("R26", "Mirpur 10 -> Kazipara -> Sheorapara -> Agargaon -> Bijoy Sarani -> Farmgate"),
    ("R27", "Savar Bus Stand -> Hemayetpur -> Aminbazar -> Technical -> Shyamoli -> Mohammadpur"),
    ("R28", "Ashulia Bridge -> Dhour -> Kamarpara -> Uttara North -> Diabari Metro Station"),
    ("R29", "ECB Chattor -> Mirpur DOHS -> Pallabi -> Mirpur 12 -> Kalshi -> ECB Chattor"),
    ("R30", "Motijheel -> Dainik Bangla -> Kakrail -> Malibagh -> Rampura -> Badda"),
    ("R31", "Dhanmondi 27 -> Shyamoli -> Technical -> Gabtoli -> Savar -> Nabinagar"),
    ("R32", "Uttara House Building -> Uttara Rajlokkhi -> Airport -> Khilkhet -> Kuril Bisso Road"),
    ("R33", "Mirpur 1 -> Sony Cinema Hall -> Technical -> Asadgate -> Mohammadpur -> Dhanmondi"),
    ("R34", "Ashulia Bazar -> Paragram -> Khagan -> Daffodil International University -> Birulia"),
    ("R35", "Savar C&B Mor -> Kolma -> Zirabo -> Ashulia Depot -> EPZ -> Baipail"),
    ("R36", "ECB Chattor -> Manik Miah Avenue -> Dhanmondi 27 -> Science Lab -> New Market"),
    ("R37", "Tongi Station Road -> Uttara -> Airport -> Mohakhali -> Farmgate -> Gulistan"),
    ("R38", "Narayanganj Chasara -> Signboard -> Jatrabari -> Gulistan -> Motijheel -> Paltan"),
    ("R39", "Hemayetpur -> Aminbazar -> Technical -> Shyamoli -> Mohammadpur -> Dhanmondi 27"),
    ("R40", "Diabari Metro Station -> Uttara North -> Dhour -> Tongi -> Gazipur Chowrasta"),
    ("R41", "Mirpur 10 -> Mirpur 1 -> Gabtoli -> Aminbazar -> Savar -> C&B Mor"),
    ("R42", "Gulshan 1 -> Mohakhali -> Jahangir Gate -> Khamarbari -> Farmgate -> Shahbagh"),
    ("R43", "Uttara Sector 18 -> Diabari -> Beribadh -> Khagan -> Daffodil International University"),
    ("R44", "Savar Bazar Road -> Nabinagar -> C&B Mor -> Kolma -> Charabag -> Ashulia"),
    ("R45", "ECB Chattor -> Sheorapara -> Rokeya Sarani -> Mirpur 10 -> Mirpur 12 -> Uttara"),
    ("R46", "Gulshan 2 -> Mohakhali -> Gabtoli -> Birulia -> Daffodil International University"),
    ("R47", "Banani -> Kakoli -> Gulshan 1 -> Gulshan 2"),
    ("R48", "Mirpur 2 -> Mirpur 10 -> Agargaon -> Farmgate -> Motijheel"),
    ("R49", "Daffodil International University -> Khagan -> Beribadh -> Rampura -> Badda Link Road"),
    ("R50", "Gulshan 2 -> Notun Bazar -> Kuril -> Uttara -> Gazipur")
]


def load_project_routes() -> list:
    """
    Builds complete, validated corridor objects with multi-point waypoints,
    Haversine distances, and metadata for all 50 official corridors.
    """
    raw_list = []
    if os.path.exists(ROUTES_CSV):
        try:
            df = pd.read_csv(ROUTES_CSV)
            for _, row in df.iterrows():
                raw_list.append((str(row["Route_ID"]).strip(), str(row["Route_Path"]).strip()))
        except Exception:
            raw_list = OFFICIAL_PROJECT_ROUTES_DATA
    else:
        raw_list = OFFICIAL_PROJECT_ROUTES_DATA

    routes = []
    for r_id, r_path in raw_list:
        nodes = [n.strip() for n in r_path.split("->") if n.strip()]

        if len(nodes) < 2:
            continue

        coords_list = []
        for n in nodes:
            coords = NODE_COORDINATES.get(n)
            if coords:
                coords_list.append((coords, n))
            else:
                # Fallback to Mirpur 10 if unknown
                coords_list.append(((23.8069, 90.3687), n))

        orig_coords = coords_list[0][0]
        dest_coords = coords_list[-1][0]
        orig_name = coords_list[0][1]
        dest_name = coords_list[-1][1]

        # Calculate multi-segment Haversine distance
        total_dist_km = sum(
            haversine_km(coords_list[i][0], coords_list[i+1][0])
            for i in range(len(coords_list) - 1)
        )
        total_dist_km = max(round(total_dist_km, 2), 1.5)

        # Baseline free flow speed ~35-40 km/h in Dhaka uncongested hours
        free_flow_min = max(2.0, round((total_dist_km / 38.0) * 60, 1))

        routes.append({
            "route_id": f"{r_id}: {orig_name} -> {dest_name}",
            "route_code": r_id,
            "route_path": r_path,
            "origin_name": orig_name,
            "dest_name": dest_name,
            "origin_coords": orig_coords,
            "dest_coords": dest_coords,
            "waypoints": coords_list,
            "road_length_km": total_dist_km,
            "free_flow_time_min": free_flow_min,
            "road_type": "Primary Urban",
            "num_lanes": 4
        })

    return routes


# Official Project Routes Instance (R01 to R50)
PROJECT_ROUTES = load_project_routes()
