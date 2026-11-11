import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NODE_COORDINATES, haversineKm } from './routesConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GEOJSON_PATH = path.resolve(__dirname, '../data/dhaka_roads.geojson');

// Cached OSM road graph
let graphCache = null;

const coordKey = (lon, lat) => `${lat.toFixed(5)},${lon.toFixed(5)}`;
const approxKm = (a, b) => {
  const dx = (a[0] - b[0]) * 111.32;
  const dy = (a[1] - b[1]) * 101.8; // cos(23.8 deg) * 111.32
  return Math.hypot(dx, dy);
};

const formatHighwayLabel = (hw) => {
  if (!hw) return 'Dhaka Road Segment';
  const map = {
    motorway: 'Expressway / Highway',
    motorway_link: 'Expressway Ramp',
    trunk: 'Main Trunk Road',
    trunk_link: 'Trunk Link Road',
    primary: 'Primary Arterial Road',
    primary_link: 'Primary Link Road',
    secondary: 'Secondary Road',
    secondary_link: 'Secondary Link Road',
    tertiary: 'Urban Street',
    tertiary_link: 'Connector Street',
  };
  return map[hw] || `${hw.replace(/_/g, ' ')} road`;
};

function loadOsmGraph() {
  if (graphCache) return graphCache;

  const adj = new Map();
  const coordsMap = new Map();
  const grid = new Map(); // 0.02 deg spatial grid for fast nearest-node lookup

  const addGrid = (k, lat, lon) => {
    const gx = Math.floor(lat * 50);
    const gy = Math.floor(lon * 50);
    const gk = `${gx},${gy}`;
    if (!grid.has(gk)) grid.set(gk, []);
    grid.get(gk).push(k);
  };

  if (!fs.existsSync(GEOJSON_PATH)) {
    graphCache = { adj, coordsMap, grid, available: false };
    return graphCache;
  }

  const raw = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf-8'));
  const features = raw.features || [];

  // Slightly prefer major roads in A* cost so routes stay on realistic arterials
  const hwPenalty = {
    motorway: 0.92,
    trunk: 0.95,
    primary: 1.0,
    secondary: 1.08,
    tertiary: 1.22,
    motorway_link: 1.05,
    trunk_link: 1.05,
    primary_link: 1.1,
    secondary_link: 1.15,
    tertiary_link: 1.25,
  };

  for (const f of features) {
    const pts = f.geometry?.coordinates;
    if (!Array.isArray(pts) || pts.length < 2) continue;

    const props = f.properties || {};
    const nameEn = (props['name:en'] || '').trim();
    const nameLocal = (props.name || '').trim();
    const hw = props.highway || 'road';
    const roadName = nameEn || nameLocal || formatHighwayLabel(hw);
    const hasExplicitName = Boolean(nameEn || nameLocal);
    const wayId = props['@id'] || f.id || '';
    const mult = hwPenalty[hw] || 1.15;

    for (let i = 0; i < pts.length; i++) {
      const [lon, lat] = pts[i];
      const k = coordKey(lon, lat);
      if (!coordsMap.has(k)) {
        coordsMap.set(k, [lat, lon]);
        addGrid(k, lat, lon);
      }
      if (!adj.has(k)) adj.set(k, []);

      if (i > 0) {
        const [pLon, pLat] = pts[i - 1];
        const pk = coordKey(pLon, pLat);
        const dKm = approxKm([pLat, pLon], [lat, lon]);
        const edge = { cost: dKm * mult, distKm: dKm, name: roadName, hasExplicitName, highway: hw, wayId };
        adj.get(k).push({ to: pk, ...edge });
        adj.get(pk).push({ to: k, ...edge });
      }
    }
  }

  graphCache = { adj, coordsMap, grid, available: coordsMap.size > 0 };
  return graphCache;
}

function findNearestNode(lat, lon) {
  const { coordsMap, grid, available } = loadOsmGraph();
  if (!available) return null;

  const gx = Math.floor(lat * 50);
  const gy = Math.floor(lon * 50);

  let best = null;
  let bestDist = Infinity;

  // Search 3x3 local grid cells first
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cell = grid.get(`${gx + dx},${gy + dy}`);
      if (!cell) continue;
      for (const k of cell) {
        const c = coordsMap.get(k);
        const d = approxKm([lat, lon], c);
        if (d < bestDist) {
          bestDist = d;
          best = k;
        }
      }
    }
  }

  // Fallback full scan if point is outside immediate cells
  if (!best || bestDist > 3.0) {
    for (const [k, c] of coordsMap) {
      const d = approxKm([lat, lon], c);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
  }

  return bestDist <= 8.0 ? best : null;
}

// Binary min-heap for fast A*
class MinHeap {
  constructor() { this.items = []; }
  push(item) {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.items[p][0] <= this.items[i][0]) break;
      [this.items[p], this.items[i]] = [this.items[i], this.items[p]];
      i = p;
    }
  }
  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      const n = this.items.length;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < n && this.items[l][0] < this.items[smallest][0]) smallest = l;
        if (r < n && this.items[r][0] < this.items[smallest][0]) smallest = r;
        if (smallest === i) break;
        [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
        i = smallest;
      }
    }
    return top;
  }
  get size() { return this.items.length; }
}

function astarHop(c1, c2) {
  const { adj, coordsMap, available } = loadOsmGraph();
  if (!available) return null;

  const s = findNearestNode(c1[0], c1[1]);
  const e = findNearestNode(c2[0], c2[1]);
  if (!s || !e) return null;
  if (s === e) return [{ pt: coordsMap.get(s), name: 'Local Junction', highway: 'primary', wayId: '', distKm: 0 }];

  const endCoord = coordsMap.get(e);
  const gScore = new Map([[s, 0]]);
  const prev = new Map();
  const visited = new Set();
  const pq = new MinHeap();
  pq.push([approxKm(coordsMap.get(s), endCoord), s]);

  let iterations = 0;
  const MAX_ITERS = 35000;

  while (pq.size > 0 && iterations++ < MAX_ITERS) {
    const [, u] = pq.pop();
    if (u === e) break;
    if (visited.has(u)) continue;
    visited.add(u);

    const edges = adj.get(u);
    if (!edges) continue;
    const gu = gScore.get(u);

    for (let i = 0; i < edges.length; i++) {
      const ed = edges[i];
      if (visited.has(ed.to)) continue;
      const ng = gu + ed.cost;
      if (!gScore.has(ed.to) || ng < gScore.get(ed.to)) {
        gScore.set(ed.to, ng);
        prev.set(ed.to, {
          from: u,
          name: ed.name,
          highway: ed.highway,
          wayId: ed.wayId,
          distKm: ed.distKm,
        });
        const h = approxKm(coordsMap.get(ed.to), endCoord) * 0.92;
        pq.push([ng + h, ed.to]);
      }
    }
  }

  if (!prev.has(e)) return null;

  const pathNodes = [];
  let cur = e;
  while (prev.has(cur)) {
    const p = prev.get(cur);
    pathNodes.push({
      pt: coordsMap.get(cur),
      name: p.name,
      highway: p.highway,
      wayId: p.wayId,
      distKm: p.distKm,
    });
    cur = p.from;
  }
  pathNodes.push({ pt: coordsMap.get(s), name: null, highway: null, wayId: '', distKm: 0 });
  return pathNodes.reverse();
}

/**
 * Route through an ordered list of waypoint coordinates using the local OSM GeoJSON road graph.
 * Groups consecutive edges by road name into clean interactive road segments.
 */
export function buildOsmRouteGeometry(waypointCoords, routeLabel = 'Primary Corridor') {
  if (!Array.isArray(waypointCoords) || waypointCoords.length < 2) {
    return { coordinates: waypointCoords || [], segments: [] };
  }

  const allEdgeSteps = [];

  for (let i = 0; i < waypointCoords.length - 1; i++) {
    const c1 = waypointCoords[i];
    const c2 = waypointCoords[i + 1];
    const hop = astarHop(c1, c2);

    if (hop && hop.length >= 2) {
      // Connect exact requested start point if slightly offset from nearest OSM node
      if (i === 0 && approxKm(c1, hop[0].pt) > 0.03) {
        allEdgeSteps.push({
          fromPt: c1,
          toPt: hop[0].pt,
          name: hop[1]?.name || routeLabel,
          highway: hop[1]?.highway || 'primary',
          wayId: hop[1]?.wayId || '',
          distKm: approxKm(c1, hop[0].pt),
        });
      }

      for (let j = 1; j < hop.length; j++) {
        allEdgeSteps.push({
          fromPt: hop[j - 1].pt,
          toPt: hop[j].pt,
          name: hop[j].name || routeLabel,
          highway: hop[j].highway || 'primary',
          wayId: hop[j].wayId || '',
          distKm: hop[j].distKm || approxKm(hop[j - 1].pt, hop[j].pt),
        });
      }

      if (i === waypointCoords.length - 2 && approxKm(hop[hop.length - 1].pt, c2) > 0.03) {
        allEdgeSteps.push({
          fromPt: hop[hop.length - 1].pt,
          toPt: c2,
          name: hop[hop.length - 1]?.name || routeLabel,
          highway: hop[hop.length - 1]?.highway || 'primary',
          wayId: hop[hop.length - 1]?.wayId || '',
          distKm: approxKm(hop[hop.length - 1].pt, c2),
        });
      }
    } else {
      allEdgeSteps.push({
        fromPt: c1,
        toPt: c2,
        name: routeLabel,
        highway: 'primary',
        wayId: '',
        distKm: approxKm(c1, c2),
      });
    }
  }

  // Merge consecutive edges sharing the same road name
  const segments = [];
  for (const edge of allEdgeSteps) {
    const prev = segments[segments.length - 1];
    if (prev && prev.name === edge.name) {
      prev.coordinates.push(edge.toPt);
      prev.distance_km = Number((prev.distance_km + edge.distKm).toFixed(2));
    } else {
      segments.push({
        id: `seg-${segments.length}`,
        name: edge.name,
        highway: edge.highway,
        way_id: edge.wayId,
        distance_km: Number(edge.distKm.toFixed(2)),
        coordinates: [edge.fromPt, edge.toPt],
      });
    }
  }

  // Flatten full polyline coordinates
  const coordinates = [];
  segments.forEach((seg, sIdx) => {
    seg.coordinates.forEach((pt, pIdx) => {
      if (sIdx === 0 || pIdx > 0) coordinates.push(pt);
    });
  });

  return { coordinates, segments };
}

/**
 * Decode a Google Maps encoded polyline string into [[lat, lon], ...]
 */
export function decodeEncodedPolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/**
 * Find real Dhaka intersection checkpoints from NODE_COORDINATES lying along a routed polyline
 */
export function findRouteCheckpoints(routeCoords, fromName, toName, explicitSteps = []) {
  if (!Array.isArray(routeCoords) || routeCoords.length < 2) return [];

  const origCoord = routeCoords[0];
  const destCoord = routeCoords[routeCoords.length - 1];

  // Deduplicate coordinate aliases in NODE_COORDINATES (e.g. Asadgate / Asad Gate)
  const seenPos = new Set();
  seenPos.add(`${origCoord[0].toFixed(3)},${origCoord[1].toFixed(3)}`);
  seenPos.add(`${destCoord[0].toFixed(3)},${destCoord[1].toFixed(3)}`);

  const candidates = [];

  const closestIdx = (c) => {
    let minDist = Infinity;
    let bestIdx = -1;
    const stride = routeCoords.length > 150 ? 2 : 1;
    for (let i = 0; i < routeCoords.length; i += stride) {
      const d = approxKm(routeCoords[i], c);
      if (d < minDist) {
        minDist = d;
        bestIdx = i;
      }
    }
    return { minDist, bestIdx };
  };

  // 1. Always include explicit intermediate corridor steps first (if well away from endpoints)
  if (Array.isArray(explicitSteps) && explicitSteps.length > 2) {
    for (const stepName of explicitSteps.slice(1, -1)) {
      const c = NODE_COORDINATES[stepName];
      if (!c) continue;
      if (haversineKm(origCoord, c) < 1.1 || haversineKm(destCoord, c) < 1.1) continue;
      const pk = `${c[0].toFixed(3)},${c[1].toFixed(3)}`;
      if (seenPos.has(pk)) continue;
      seenPos.add(pk);
      const { bestIdx } = closestIdx(c);
      candidates.push({ name: stepName, coords: c, minRouteIdx: Math.max(1, bestIdx), priority: 1 });
    }
  }

  // 2. Discover nearby strategic nodes along the OSM path
  for (const [name, c] of Object.entries(NODE_COORDINATES)) {
    if (name === fromName || name === toName) continue;
    const pk = `${c[0].toFixed(3)},${c[1].toFixed(3)}`;
    if (seenPos.has(pk)) continue;

    // Must not overlap origin or destination labels
    if (haversineKm(origCoord, c) < 1.3 || haversineKm(destCoord, c) < 1.3) continue;

    const { minDist, bestIdx } = closestIdx(c);

    if (minDist <= 0.4 && bestIdx > 0 && bestIdx < routeCoords.length - 1) {
      seenPos.add(pk);
      candidates.push({ name, coords: c, minRouteIdx: bestIdx, priority: 2 });
    }
  }

  // Order checkpoints along the route from origin to destination
  candidates.sort((a, b) => a.minRouteIdx - b.minRouteIdx);

  // Enforce >= 1.8 km spacing and cap at 4 pills so labels stay airy and readable
  const spaced = [];
  for (const cand of candidates) {
    const tooClose = spaced.some(s => approxKm(s.coords, cand.coords) < 1.8);
    if (!tooClose) spaced.push({ name: cand.name, coords: cand.coords });
    if (spaced.length >= 4) break;
  }

  return spaced;
}

