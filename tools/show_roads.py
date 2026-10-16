"""
OSM Road Segments Viewer — Interactive Pager
=============================================
Displays road segments from dhaka_roads.geojson in an
interactive terminal table. Navigate page by page.

Run:
    py -3 tools/show_roads.py                     (all segments)
    py -3 tools/show_roads.py --type=primary      (filter by highway type)
    py -3 tools/show_roads.py --named             (only named roads)
    py -3 tools/show_roads.py --search=mirpur     (search road names)

Controls:
    Enter / n     next page
    p             previous page
    q             quit
    number        jump to that page (e.g. type 3 then Enter)
"""

import os
import sys
import json
import math
from collections import Counter

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GEOJSON_PATH = os.path.join(BASE_DIR, "data", "dhaka_roads.geojson")
PAGE_SIZE    = 25   # rows per screen

# ── Load GeoJSON ──────────────────────────────────────────────────────────────
with open(GEOJSON_PATH, encoding="utf-8") as f:
    data = json.load(f)

features  = data["features"]
timestamp = data.get("timestamp", "unknown")

# ── Haversine segment length ───────────────────────────────────────────────────
def haversine_km(coords):
    total = 0.0
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[i + 1]
        R    = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2
             + math.cos(math.radians(lat1))
             * math.cos(math.radians(lat2))
             * math.sin(dlon / 2) ** 2)
        total += R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return total

# ── Parse CLI args ────────────────────────────────────────────────────────────
filter_type = None
named_only  = "--named" in sys.argv
search_term = None

for arg in sys.argv[1:]:
    if arg.startswith("--type="):
        filter_type = arg.split("=", 1)[1].lower()
    if arg.startswith("--search="):
        search_term = arg.split("=", 1)[1].lower()

# ── Build rows ────────────────────────────────────────────────────────────────
IMPORTANCE = [
    "motorway", "motorway_link", "trunk", "trunk_link",
    "primary", "primary_link", "secondary", "secondary_link",
    "tertiary", "tertiary_link",
]
HW_TAG = {
    "motorway":       "MOTORWAY ",
    "motorway_link":  "MWAY-LINK",
    "trunk":          "TRUNK    ",
    "trunk_link":     "TRNK-LINK",
    "primary":        "PRIMARY  ",
    "primary_link":   "PRIM-LINK",
    "secondary":      "SECONDARY",
    "secondary_link": "SEC-LINK ",
    "tertiary":       "TERTIARY ",
    "tertiary_link":  "TERT-LINK",
}

rows = []
for feat in features:
    p      = feat["properties"]
    coords = feat["geometry"]["coordinates"]
    hw     = p.get("highway", "")

    if filter_type and hw != filter_type:
        continue

    name = p.get("name:en") or p.get("name") or ""
    if named_only and not name:
        continue
    if search_term and search_term not in name.lower():
        continue

    lanes   = p.get("lanes", "-")
    surface = (p.get("surface") or "-")[:7]
    oneway  = ("YES" if p.get("oneway") == "yes"
                else ("NO " if p.get("oneway") == "no" else " - "))
    maxspd  = p.get("maxspeed", "-")
    lit     = p.get("lit", "-")
    km      = haversine_km(coords)

    rows.append({
        "name":    name if name else "(unnamed)",
        "hw":      hw,
        "hw_tag":  HW_TAG.get(hw, hw.upper()[:9]),
        "lanes":   str(lanes),
        "surface": surface,
        "oneway":  oneway,
        "maxspd":  str(maxspd),
        "lit":     str(lit),
        "km":      km,
        "pts":     len(coords),
        "osm_id":  p.get("@id", ""),
    })

# Sort: named first → by highway importance → alphabetical
rows.sort(key=lambda r: (
    r["name"] == "(unnamed)",
    IMPORTANCE.index(r["hw"]) if r["hw"] in IMPORTANCE else 99,
    r["name"].lower(),
))

# ── Stats ─────────────────────────────────────────────────────────────────────
total       = len(rows)
total_pages = max(1, math.ceil(total / PAGE_SIZE))
total_km    = sum(r["km"] for r in rows)
named_count = sum(1 for r in rows if r["name"] != "(unnamed)")
hw_counts   = Counter(r["hw"] for r in rows)

# ── Display helpers ───────────────────────────────────────────────────────────
SEP  = "=" * 114
THIN = "-" * 114

def print_page(page):
    start     = (page - 1) * PAGE_SIZE
    page_rows = rows[start: start + PAGE_SIZE]

    os.system("cls" if os.name == "nt" else "clear")
    print(SEP)
    print(f"  OSM ROAD NETWORK  |  Dhaka, Bangladesh  |  Fetched: {timestamp[:10]}")
    print(f"  Total segments: {total:,}  |  Named: {named_count:,}  |  Total length: {total_km:.1f} km")
    if filter_type:
        print(f"  Filter: highway = {filter_type}")
    if search_term:
        print(f"  Search: '{search_term}'")
    print(SEP)
    print(
        f"  {'#':<4} "
        f"{'Road Name':<33} "
        f"{'Type':<9} "
        f"{'Lanes':>5} "
        f"{'Surface':>8} "
        f"{'1-Way':>5} "
        f"{'Speed':>5} "
        f"{'Lit':>4} "
        f"{'Len km':>7} "
        f"{'Pts':>4}"
    )
    print(THIN)

    for i, r in enumerate(page_rows, start + 1):
        name_disp = r["name"][:32] if len(r["name"]) > 32 else r["name"]
        print(
            f"  {i:<4} "
            f"{name_disp:<33} "
            f"{r['hw_tag']:<9} "
            f"{r['lanes']:>5} "
            f"{r['surface']:>8} "
            f"{r['oneway']:>5} "
            f"{r['maxspd']:>5} "
            f"{r['lit']:>4} "
            f"{r['km']:>7.3f} "
            f"{r['pts']:>4}"
        )

    print(SEP)

    # Type breakdown (compact)
    counts_line = "  Types: " + "  ".join(
        f"{hw[:4].upper()}:{hw_counts.get(hw,0)}"
        for hw in IMPORTANCE if hw_counts.get(hw, 0) > 0
    )
    print(counts_line)
    print(SEP)
    print(
        f"  Page {page}/{total_pages}  |  Rows {start+1}-{min(start+PAGE_SIZE, total)} of {total}"
        f"   [Enter/n=next  p=prev  q=quit  or type page number]"
    )

# ── Interactive loop ──────────────────────────────────────────────────────────
current = 1
print_page(current)

while True:
    try:
        raw = input("  > ").strip().lower()
    except (KeyboardInterrupt, EOFError):
        print("\nExiting.")
        break

    if raw in ("q", "quit", "exit"):
        print("Exiting.")
        break
    elif raw in ("", "n", "next"):
        if current < total_pages:
            current += 1
        else:
            print(f"  Already on last page ({total_pages}). Press q to quit.")
            continue
    elif raw in ("p", "prev", "back"):
        if current > 1:
            current -= 1
        else:
            print("  Already on page 1.")
            continue
    elif raw.isdigit():
        pg = int(raw)
        if 1 <= pg <= total_pages:
            current = pg
        else:
            print(f"  Page must be between 1 and {total_pages}.")
            continue
    else:
        print("  Unknown command. Use: Enter, n, p, q, or a page number.")
        continue

    print_page(current)
