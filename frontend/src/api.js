import { predictJourneyTraffic } from './utils/journeyPredictor.js';
import { NODE_COORDINATES, OFFICIAL_ROUTES, ALL_ROUTES, DHAKA_BYPASS_WAYPOINTS } from './utils/dhakaRoutesData.js';

// API Service for Dhaka Traffic Prediction System
// High-resilience client with automatic live backend detection and offline fallback

const API_BASE = '/api';

// Helper to generate full route telemetry client-side when backend is offline
function generateFallbackRoutes() {
  const sourceRoutes = (ALL_ROUTES && ALL_ROUTES.length) ? ALL_ROUTES : OFFICIAL_ROUTES;
  return sourceRoutes.map((item, idx) => {
    const nodeNames = item.route_path.split('->').map(s => s.trim()).filter(Boolean);
    const waypoints = nodeNames.map(name => ({
      name,
      coords: NODE_COORDINATES[name] || item.origin_coords || [23.8103, 90.4125]
    }));

    const length = item.road_length_km || 8.0;
    const baseSpeed = Math.round(18 + ((idx * 7) % 24));
    const travelTime = Math.max(5, Math.round((length / baseSpeed) * 60));
    const freeFlow = Math.max(3, Math.round(item.free_flow_time_min || (length / 38) * 60));
    const delay = Math.max(0, travelTime - freeFlow);

    let trafficLevel = 'NORMAL';
    if (delay >= 12) trafficLevel = 'HEAVY';
    else if (delay >= 5) trafficLevel = 'MODERATE';

    return {
      ...item,
      waypoints,
      traffic_speed_kmh: baseSpeed,
      travel_time_min: travelTime,
      free_flow_time_min: freeFlow,
      traffic_delay_min: delay,
      congestion_ratio: Number((travelTime / Math.max(freeFlow, 1)).toFixed(2)),
      traffic_level: trafficLevel,
      num_lanes: 4,
      weather: 'Clear',
      temperature_c: 28,
      rainfall_mm: 0
    };
  });
}

export async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/stats unavailable, utilizing client fallback:', err.message);
  }

  const routes = generateFallbackRoutes();
  const avgSpeed = (routes.reduce((acc, r) => acc + r.traffic_speed_kmh, 0) / routes.length).toFixed(1);
  const avgDelay = (routes.reduce((acc, r) => acc + r.traffic_delay_min, 0) / routes.length).toFixed(1);

  const levelCounts = { NORMAL: 0, MODERATE: 0, HEAVY: 0, SEVERE: 0 };
  routes.forEach(r => {
    levelCounts[r.traffic_level] = (levelCounts[r.traffic_level] || 0) + 1;
  });

  return {
    success: true,
    data: {
      totalCorridors: routes.length,
      avgSpeedKmh: Number(avgSpeed),
      avgDelayMin: Number(avgDelay),
      levelCounts,
      worstCorridors: [...routes].sort((a, b) => b.congestion_ratio - a.congestion_ratio).slice(0, 5),
      fastestCorridors: [...routes].sort((a, b) => b.traffic_speed_kmh - a.traffic_speed_kmh).slice(0, 5),
      totalHistoricalRecords: 5000,
      weatherSummary: {
        condition: 'Clear',
        temperature_c: 28.0,
        humidity_pct: 68,
        surface_condition: 'Dry',
        city: 'Dhaka, Bangladesh'
      }
    },
    isOffline: true
  };
}

export async function fetchRoutes(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.level && params.level !== 'ALL') query.set('level', params.level);
    if (params.search) query.set('search', params.search);

    const res = await fetch(`${API_BASE}/routes?${query.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/routes unavailable, utilizing client fallback:', err.message);
  }

  let routes = generateFallbackRoutes();
  if (params.level && params.level !== 'ALL') {
    routes = routes.filter(r => r.traffic_level.toUpperCase() === params.level.toUpperCase());
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    routes = routes.filter(r =>
      r.route_code.toLowerCase().includes(q) ||
      r.route_id.toLowerCase().includes(q) ||
      r.origin_name.toLowerCase().includes(q) ||
      r.dest_name.toLowerCase().includes(q)
    );
  }

  return {
    success: true,
    count: routes.length,
    total: OFFICIAL_ROUTES.length,
    data: routes,
    isOffline: true
  };
}

export async function fetchRouteDetails(routeCode) {
  try {
    const res = await fetch(`${API_BASE}/routes/${routeCode}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn(`[API] /api/routes/${routeCode} unavailable, searching fallback:`, err.message);
  }

  const routes = generateFallbackRoutes();
  const match = routes.find(r => r.route_code.toUpperCase() === String(routeCode).toUpperCase());
  return {
    success: Boolean(match),
    data: match || null,
    isOffline: true
  };
}

export async function fetchWaypoints() {
  try {
    const res = await fetch(`${API_BASE}/waypoints`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/waypoints unavailable, utilizing client fallback:', err.message);
  }

  const nodes = Object.entries(NODE_COORDINATES).map(([name, coords]) => ({
    name,
    lat: coords[0],
    lon: coords[1]
  }));

  return {
    success: true,
    count: nodes.length,
    waypoints: nodes,
    bypasses: DHAKA_BYPASS_WAYPOINTS,
    isOffline: true
  };
}

export async function fetchHistory(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    if (params.all) query.set('all', 'true');
    if (params.level && params.level !== 'ALL') query.set('level', params.level);
    if (params.search) query.set('search', params.search);
    query.set('_t', Date.now());

    const res = await fetch(`${API_BASE}/history?${query.toString()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/history unavailable, generating representative client history:', err.message);
  }

  // Generate realistic representative history for Traffic Insights charts
  const levels = ['NORMAL', 'NORMAL', 'MODERATE', 'NORMAL', 'HEAVY', 'NORMAL', 'MODERATE'];
  const routes = generateFallbackRoutes();
  const records = [];
  const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

  for (let i = 0; i < 400; i++) {
    const r = routes[i % routes.length];
    const hour = hours[i % hours.length];
    const isPeak = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
    const lvl = isPeak ? (i % 3 === 0 ? 'HEAVY' : 'MODERATE') : levels[i % levels.length];
    records.push({
      road_route_id: r.route_id,
      hour: String(hour),
      traffic_level: lvl,
      traffic_speed_kmh: lvl === 'HEAVY' ? 12 : lvl === 'MODERATE' ? 20 : 34,
      timestamp: `2026-11-10 ${String(hour).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`
    });
  }

  const limit = params.limit || 5000;
  return {
    success: true,
    total: records.length,
    page: 1,
    limit,
    totalPages: 1,
    data: records.slice(0, limit),
    isOffline: true
  };
}

export async function evaluateBypassAdvisor(payload) {
  try {
    const res = await fetch(`${API_BASE}/advisor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) return res.json();
  } catch (err) {
    console.warn('[API] /api/advisor fallback:', err.message);
  }
  return { success: false, error: 'Advisor service unavailable' };
}

export async function simulateTrafficPrediction(payload) {
  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) return res.json();
  } catch (err) {
    console.warn('[API] /api/predict fallback:', err.message);
  }
  return { success: false, error: 'Prediction simulation unavailable' };
}

export async function fetchRoadSummary() {
  try {
    const res = await fetch(`${API_BASE}/roads/summary`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err) {
    console.warn('[API] /api/roads/summary fallback:', err.message);
  }

  return {
    success: true,
    data: {
      available: true,
      totalWays: 593,
      roadTypes: {
        primary: 148,
        secondary: 215,
        trunk: 84,
        motorway: 32,
        tertiary: 114
      },
      sampleRoads: [
        { name: 'Mirpur Road', highway: 'primary', lanes: 4 },
        { name: 'Kazi Nazrul Islam Avenue', highway: 'primary', lanes: 6 },
        { name: 'Dhaka Elevated Expressway', highway: 'motorway', lanes: 4 },
        { name: 'Airport Road', highway: 'trunk', lanes: 6 },
        { name: 'Pragoti Sarani', highway: 'primary', lanes: 4 }
      ]
    },
    isOffline: true
  };
}

export async function fetchLiveWeather() {
  try {
    const res = await fetch(`${API_BASE}/weather`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json.data;
    }
  } catch (err) {
    console.warn('[API] Weather API fetch failed:', err.message);
  }
  return {
    city: 'Dhaka',
    condition: 'Haze',
    temperature_c: 25.0,
    humidity_pct: 78,
    visibility_km: 6.0,
    surface_condition: 'Dry',
    source: 'Fallback'
  };
}

export async function fetchEngineStatus() {
  try {
    const res = await fetch(`${API_BASE}/engine-status`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json.data;
    }
  } catch (err) {
    console.warn('[API] Engine status fetch failed:', err.message);
  }
  return {
    googleRoutesApi: {
      status: 'Active (Ready)',
      keyPoolSize: 1,
      currentKeyIndex: 1
    },
    openWeatherMap: {
      status: 'Fallback Active',
      hasKey: false
    },
    wazeLive: {
      status: 'Standby / Failover Ready'
    },
    osmRoadNetwork: {
      status: 'Loaded (dhaka_roads.geojson)',
      officialRoutesCount: 50
    }
  };
}

export async function predictJourneyApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/predict-journey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[API] /api/predict-journey unavailable, utilizing client-side prediction engine:', err.message);
  }

  // Fallback to local client-side prediction engine
  return predictJourneyTraffic(payload);
}
