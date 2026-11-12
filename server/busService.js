import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUS_DIR = path.join(__dirname, '..', 'data', 'bus');
const MASTER_JSON = path.join(BUS_DIR, 'dhaka_bus_routes.json');
const STOPS_JSON = path.join(BUS_DIR, 'bus_stops.json');
const ROUTES_DIR = path.join(BUS_DIR, 'routes');

let busRoutesCache = null;
let busStopsCache = null;

function loadBusData() {
  if (!busRoutesCache && fs.existsSync(MASTER_JSON)) {
    try {
      const raw = fs.readFileSync(MASTER_JSON, 'utf-8');
      const parsed = JSON.parse(raw);
      busRoutesCache = parsed.routes || [];
    } catch (err) {
      console.warn('[BusService] Could not parse dhaka_bus_routes.json:', err.message);
      busRoutesCache = [];
    }
  }
  return busRoutesCache || [];
}

function loadBusStops() {
  if (!busStopsCache && fs.existsSync(STOPS_JSON)) {
    try {
      const raw = fs.readFileSync(STOPS_JSON, 'utf-8');
      const parsed = JSON.parse(raw);
      busStopsCache = parsed.stops || [];
    } catch (err) {
      console.warn('[BusService] Could not parse bus_stops.json:', err.message);
      busStopsCache = [];
    }
  }
  return busStopsCache || [];
}

export function getAllBuses(query = {}) {
  const list = loadBusData();
  const { search, corridor, from, to } = query;

  return list.filter(b => {
    // 1. Search term (matches name, english/bengali, route code, or any stoppage)
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = b.name.toLowerCase().includes(q) || (b.name_bn && b.name_bn.includes(q));
      const matchCode = (b.route_code || '').toLowerCase().includes(q);
      const matchEndpoints = b.origin.toLowerCase().includes(q) || b.destination.toLowerCase().includes(q);
      const matchStoppage = (b.stoppages || []).some(s => s.toLowerCase().includes(q));
      if (!matchName && !matchCode && !matchEndpoints && !matchStoppage) return false;
    }

    // 2. Filter by project corridor (e.g. R01, R26)
    if (corridor && corridor.trim()) {
      const cUpper = corridor.toUpperCase().trim();
      const hasCorridor = (b.corridors_covered || []).includes(cUpper);
      if (!hasCorridor) return false;
    }

    // 3. Filter by Origin & Destination route points
    if (from && to) {
      const fLower = from.toLowerCase().trim();
      const tLower = to.toLowerCase().trim();
      const stopsLower = (b.stoppages || []).map(s => s.toLowerCase());
      const fIdx = stopsLower.findIndex(s => s.includes(fLower));
      const tIdx = stopsLower.findIndex(s => s.includes(tLower));
      if (fIdx === -1 || tIdx === -1 || fIdx === tIdx) return false;
    }

    return true;
  });
}

export function getBusById(id) {
  const list = loadBusData();
  const found = list.find(b => b.id.toLowerCase() === id.toLowerCase() || (b.route_code || '').toLowerCase() === id.toLowerCase());
  if (found) return found;

  // Fallback to individual file in data/bus/routes
  const indPath = path.join(ROUTES_DIR, `${id}.json`);
  if (fs.existsSync(indPath)) {
    try {
      return JSON.parse(fs.readFileSync(indPath, 'utf-8'));
    } catch (_) {}
  }
  return null;
}

export function getBusStops() {
  return loadBusStops();
}

