import json
import collections

with open('data/dhaka_roads.geojson', 'r', encoding='utf-8') as f:
    data = json.load(f)

features = data['features']
print(f"Total features (road segments): {len(features)}")
print(f"Generator: {data['generator']}")
print(f"Timestamp: {data['timestamp']}")
print()

# Geometry types
geom_types = collections.Counter(f['geometry']['type'] for f in features)
print("Geometry types:", dict(geom_types))
print()

# Highway types
highway_types = collections.Counter(f['properties'].get('highway', 'N/A') for f in features)
print("Highway types (top 15):")
for k, v in highway_types.most_common(15):
    print(f"  {k}: {v}")
print()

# Properties coverage
all_props = collections.Counter()
for f in features:
    for k in f['properties']:
        all_props[k] += 1

print(f"Unique property keys ({len(all_props)} total):")
for k, v in sorted(all_props.items(), key=lambda x: -x[1])[:25]:
    pct = v / len(features) * 100
    print(f"  {k}: {v} ({pct:.1f}%)")
print()

# Oneway
oneway = collections.Counter(f['properties'].get('oneway', 'N/A') for f in features)
print("Oneway distribution:", dict(oneway))

# Lanes
lanes = collections.Counter(f['properties'].get('lanes', 'N/A') for f in features)
print("Lanes distribution (top 10):", dict(lanes.most_common(10)))

# Surface
surface = collections.Counter(f['properties'].get('surface', 'N/A') for f in features)
print("Surface types:", dict(surface.most_common(10)))

# Named roads
named = sum(1 for f in features if f['properties'].get('name') or f['properties'].get('name:en'))
print(f"Roads with names: {named} ({named/len(features)*100:.1f}%)")

# Coordinate bounds
all_coords = []
for f in features:
    all_coords.extend(f['geometry']['coordinates'])
lons = [c[0] for c in all_coords]
lats = [c[1] for c in all_coords]
print(f"Bounding box: [{min(lons):.4f}, {min(lats):.4f}, {max(lons):.4f}, {max(lats):.4f}]")
print(f"Center approx: [{sum(lons)/len(lons):.4f}, {sum(lats)/len(lats):.4f}]")

# Maxspeed
maxspeed = collections.Counter(f['properties'].get('maxspeed', 'N/A') for f in features)
print("Maxspeed values:", dict(maxspeed.most_common(10)))

# Lit
lit = collections.Counter(f['properties'].get('lit', 'N/A') for f in features)
print("Lit (street lighting):", dict(lit))

# Sample unique road names
names = set()
for f in features:
    n = f['properties'].get('name:en') or f['properties'].get('name')
    if n:
        names.add(n)
print(f"\nTotal unique road names: {len(names)}")
print("Sample names (first 20):")
for n in sorted(names)[:20]:
    print(f"  - {n}")
