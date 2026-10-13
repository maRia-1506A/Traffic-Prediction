"""
Road Data Fetcher — OpenStreetMap Overpass API
===============================================
Fetches road network data (primary, secondary, tertiary roads) for:
  - Mirpur      (already collected)
  - Uttara      (NEW)
  - Savar       (NEW)

Merges everything into: data/dhaka_roads.geojson
"""

import json
import os
import time
import requests

# ─────────────────────────────────────────────
# Output path
# ─────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_PATH = os.path.join(DATA_DIR, "dhaka_roads.geojson")

# ─────────────────────────────────────────────
# Area Bounding Boxes  [south, west, north, east]
# ─────────────────────────────────────────────
AREAS = {
    "Mirpur": {
        "bbox": (23.7649, 90.3308, 23.8370, 90.3934),
        "description": "Mirpur 1-14, Pallabi, Kazipara, Agargaon"
    },
    "Uttara": {
        "bbox": (23.8530, 90.3550, 23.9100, 90.4350),
        "description": "Uttara Sector 1-18, Diabari, Turag, Abdullahpur"
    },
    "Savar": {
        "bbox": (23.8000, 90.2000, 23.9500, 90.3300),
        "description": "Savar Upazila, Hemayetpur, Ashulia, DEPZ, Nishchintapur"
    },
}

# Multiple Overpass API mirrors — tried in order if one fails
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Road types to include
HIGHWAY_FILTER = '["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link)$"]'


def build_overpass_query(bbox):
    """
    Builds an Overpass QL query for all major road types in a bounding box.
    bbox = (south, west, north, east)
    """
    s, w, n, e = bbox
    return (
        "[out:json][timeout:60];"
        "(way" + HIGHWAY_FILTER + "(" + str(s) + "," + str(w) + "," + str(n) + "," + str(e) + "););"
        "out body;>;out skel qt;"
    )


def split_bbox(bbox, tiles=2):
    """
    Splits a large bounding box into a grid of smaller tiles.
    tiles=2 gives a 2x2 grid (4 tiles).
    """
    s, w, n, e = bbox
    lat_step = (n - s) / tiles
    lon_step = (e - w) / tiles
    boxes = []
    for i in range(tiles):
        for j in range(tiles):
            tile_s = round(s + i * lat_step, 6)
            tile_n = round(tile_s + lat_step, 6)
            tile_w = round(w + j * lon_step, 6)
            tile_e = round(tile_w + lon_step, 6)
            boxes.append((tile_s, tile_w, tile_n, tile_e))
    return boxes


def query_overpass(bbox):
    """
    Tries each Overpass endpoint in order until one succeeds.
    Returns parsed JSON dict or None on full failure.
    """
    query = build_overpass_query(bbox)

    for endpoint in OVERPASS_ENDPOINTS:
        short = endpoint.split("/")[2]
        try:
            print(f"    Trying: {short}...")
            response = requests.post(
                endpoint,
                data={"data": query},
                timeout=60,
                headers={"User-Agent": "TrafficPrediction-DhakaRoads/1.0"}
            )
            if response.status_code == 200:
                print(f"    OK from {short}")
                return response.json()
            elif response.status_code == 429:
                print(f"    Rate limited (429) on {short}. Waiting 30s...")
                time.sleep(30)
            else:
                print(f"    HTTP {response.status_code} from {short}")
        except requests.exceptions.Timeout:
            print(f"    Timeout on {short}")
        except Exception as e:
            print(f"    Error on {short}: {e}")

        time.sleep(3)  # Brief pause before next endpoint

    return None


def overpass_to_geojson_features(data):
    """
    Converts Overpass JSON response to a list of GeoJSON Feature (LineString) objects.
    """
    node_map = {}
    for element in data.get("elements", []):
        if element["type"] == "node":
            node_map[element["id"]] = (element["lon"], element["lat"])

    features = []
    for element in data.get("elements", []):
        if element["type"] != "way":
            continue

        coords = [list(node_map[ref]) for ref in element.get("nodes", []) if ref in node_map]
        if len(coords) < 2:
            continue

        tags = element.get("tags", {})
        properties = {"@id": "way/" + str(element["id"])}
        properties.update(tags)

        features.append({
            "type": "Feature",
            "properties": properties,
            "geometry": {"type": "LineString", "coordinates": coords},
            "id": "way/" + str(element["id"])
        })

    return features


def fetch_area(name, bbox):
    """
    Fetches road features for a single area.
    Automatically tiles the bbox into 4 smaller pieces if the full query fails.
    """
    print(f"\n  Fetching roads for: {name}")
    print(f"  Bounding box: S={bbox[0]}, W={bbox[1]}, N={bbox[2]}, E={bbox[3]}")

    # Try full bbox first
    data = query_overpass(bbox)
    if data is not None:
        features = overpass_to_geojson_features(data)
        print(f"  OK: {len(features)} GeoJSON features from full bbox")
        return features

    # Full bbox failed — split into 2x2 tiles and retry
    print(f"  Full bbox failed. Splitting into 4 tiles and retrying...")
    tiles = split_bbox(bbox, tiles=2)
    all_features = []

    for idx, tile in enumerate(tiles, 1):
        print(f"\n  Tile {idx}/{len(tiles)}: {tile}")
        tile_data = query_overpass(tile)
        if tile_data is not None:
            feats = overpass_to_geojson_features(tile_data)
            print(f"  Tile {idx}: {len(feats)} features")
            all_features.extend(feats)
        else:
            print(f"  Tile {idx}: FAILED (skipping)")

        if idx < len(tiles):
            time.sleep(8)

    print(f"  Total from all tiles: {len(all_features)} features")
    return all_features


def deduplicate_features(features):
    """Removes duplicate road segments by OSM way ID."""
    seen_ids = set()
    unique = []
    for f in features:
        fid = f.get("id", "")
        if fid not in seen_ids:
            seen_ids.add(fid)
            unique.append(f)
    return unique


def main():
    print("=" * 60)
    print("  Dhaka Road Network Fetcher -- Overpass API")
    print("=" * 60)

    all_features = []

    # Load existing GeoJSON (keeps Mirpur data safe)
    if os.path.exists(OUTPUT_PATH):
        print(f"\nLoading existing GeoJSON: {OUTPUT_PATH}")
        with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
            existing = json.load(f)
        existing_features = existing.get("features", [])
        print(f"  Found {len(existing_features)} existing road segments")
        all_features.extend(existing_features)
    else:
        print("\nNo existing GeoJSON found. Starting fresh.")

    existing_ids = set(f.get("id", "") for f in all_features)
    area_names = list(AREAS.keys())

    for i, (area_name, area_info) in enumerate(AREAS.items()):
        bbox = area_info["bbox"]
        description = area_info["description"]

        if area_name == "Mirpur" and len(existing_ids) > 0:
            print(f"\nSkipping {area_name} -- already in existing GeoJSON")
            continue

        print(f"\nArea: {area_name}")
        print(f"  Covers: {description}")

        features = fetch_area(area_name, bbox)
        if features:
            new_count = 0
            for f in features:
                fid = f.get("id", "")
                if fid not in existing_ids:
                    all_features.append(f)
                    existing_ids.add(fid)
                    new_count += 1
            print(f"  Added {new_count} new unique road segments")

        # Be polite to the Overpass API
        if i < len(area_names) - 1:
            print("\nWaiting 15s before next area request...")
            time.sleep(15)

    # Write merged GeoJSON
    print(f"\nWriting merged GeoJSON...")
    all_features = deduplicate_features(all_features)

    geojson_output = {
        "type": "FeatureCollection",
        "generator": "overpass-api + fetch_roads.py",
        "copyright": "The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "features": all_features
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(geojson_output, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"  Done! Total road segments: {len(all_features)}")
    print(f"  Saved to: {OUTPUT_PATH}")
    print(f"{'=' * 60}")

    # Summary breakdown by highway type
    from collections import Counter
    highway_types = Counter(
        f["properties"].get("highway", "unknown") for f in all_features
    )
    print("\nRoad type breakdown:")
    for k, v in sorted(highway_types.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
