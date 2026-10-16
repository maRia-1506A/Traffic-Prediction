"""
Analyze GeoJSON Road Network
=============================
Inspects statistics, geometry types, road classifications,
and property tag coverage of the fetched OpenStreetMap road network.

Run:
    py -3 tools/analyze_geojson.py
"""

import os
import sys
import json
import collections

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GEOJSON_PATH = os.path.join(BASE_DIR, "data", "dhaka_roads.geojson")

if not os.path.exists(GEOJSON_PATH):
    print(f"[Error] {GEOJSON_PATH} not found. Run 'py -3 src/fetch_roads.py' first.")
    sys.exit(1)

with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

features = data["features"]
print("=" * 60)
print(f"  OSM GeoJSON Road Network Analysis")
print(f"  File: {GEOJSON_PATH}")
print("=" * 60)
print(f"Total features (road segments): {len(features):,}")
print(f"Generator: {data.get('generator', 'N/A')}")
print(f"Timestamp: {data.get('timestamp', 'N/A')}")
print()

# Geometry types
geom_types = collections.Counter(f["geometry"]["type"] for f in features)
print("Geometry types:", dict(geom_types))
print()

# Highway types
highway_types = collections.Counter(f["properties"].get("highway", "N/A") for f in features)
print("Highway types (distribution):")
for k, v in highway_types.most_common():
    pct = v / len(features) * 100
    print(f"  {k:<16}: {v:>4} ({pct:.1f}%)")
print()

# Properties coverage
all_props = collections.Counter()
for f in features:
    for k in f["properties"]:
        all_props[k] += 1

print(f"Top Property Tags ({len(all_props)} unique tags):")
for k, v in sorted(all_props.items(), key=lambda x: -x[1])[:20]:
    pct = v / len(features) * 100
    print(f"  {k:<22}: {v:>4} ({pct:.1f}%)")
print()

# Oneway distribution
oneway = collections.Counter(f["properties"].get("oneway", "no") for f in features)
print("Oneway distribution:", dict(oneway))
print("=" * 60)
