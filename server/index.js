import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  getAllRoutesTelemetry,
  getDashboardStats,
  loadTrafficData,
  evaluateAlternativeRoutes,
  simulatePrediction,
  predictJourneyService,
  getLiveWeatherService,
  getEngineStatusService,
  getGeoJsonRoadSummary,
  getMonitoredCorridorsOsmOverlay
} from './trafficService.js';
import { NODE_COORDINATES, DHAKA_BYPASS_WAYPOINTS, haversineKm } from './routesConfig.js';
import { buildOsmRouteGeometry } from './osmRouter.js';

// Resilient compression import (safe if module not present)
let compression = null;
try {
  const mod = await import('compression');
  compression = mod.default || mod;
} catch {
  console.warn('[Server] Optional compression module not loaded; proceeding without compression.');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env if present
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const SERVER_START_TIME = Date.now();

// High-performance gzip/brotli compression middleware (if available)
if (compression) {
  app.use(compression({
    threshold: 1024, // Compress responses above 1 KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Response timing and request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${duration}ms`);
    }
    if (process.env.NODE_ENV !== 'test') {
      const statusColor = res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️' : '⚡';
      console.log(`[API] ${statusColor} ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes

// 1. Overview Dashboard Stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = getDashboardStats();
    res.setHeader('Cache-Control', 'public, max-age=15');
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. All 50 Official Corridors with Live Telemetry
app.get('/api/routes', (req, res) => {
  try {
    const routes = getAllRoutesTelemetry();
    const { level, search } = req.query;

    let filtered = routes;
    if (level && level !== 'ALL') {
      filtered = filtered.filter(r => r.traffic_level.toUpperCase() === level.toUpperCase());
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.route_code.toLowerCase().includes(q) ||
        r.route_id.toLowerCase().includes(q) ||
        r.origin_name.toLowerCase().includes(q) ||
        r.dest_name.toLowerCase().includes(q)
      );
    }

    res.setHeader('Cache-Control', 'public, max-age=15');
    res.json({ success: true, count: filtered.length, total: routes.length, data: filtered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Single Corridor Details
app.get('/api/routes/:id', (req, res) => {
  try {
    const code = req.params.id.toUpperCase();
    const routes = getAllRoutesTelemetry();
    const route = routes.find(r => r.route_code === code || r.route_id.includes(code));
    if (!route) {
      return res.status(404).json({ success: false, error: 'Route not found' });
    }
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Strategic Waypoints Registry
app.get('/api/waypoints', (req, res) => {
  try {
    const nodes = Object.entries(NODE_COORDINATES).map(([name, coords]) => ({
      name,
      lat: coords[0],
      lon: coords[1]
    }));
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      success: true,
      count: nodes.length,
      waypoints: nodes,
      bypasses: DHAKA_BYPASS_WAYPOINTS
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Historical Dataset Explorer with Pagination & Filters
app.get('/api/history', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const isAll = req.query.all === 'true' || req.query.limit === 'all';
    const rawLimit = parseInt(req.query.limit, 10);
    const search = req.query.search ? req.query.search.toLowerCase() : '';
    const level = req.query.level;

    let records = loadTrafficData();

    if (level && level !== 'ALL') {
      records = records.filter(r => (r.traffic_level || '').toUpperCase() === level.toUpperCase());
    }

    if (search) {
      records = records.filter(r => {
        const idStr = String(r.road_route_id || '').toLowerCase();
        const osmStr = String(r.osm_id || '').toLowerCase();
        const weatherStr = String(r.weather || '').toLowerCase();
        return idStr.includes(search) || osmStr.includes(search) || weatherStr.includes(search);
      });
    }

    const total = records.length;
    const limit = isAll ? total : (rawLimit && rawLimit > 0 ? rawLimit : 20);
    const page = parseInt(req.query.page, 10) || 1;
    const startIndex = isAll ? 0 : (page - 1) * limit;
    const paginated = isAll ? records : records.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      total,
      page: isAll ? 1 : page,
      limit,
      totalPages: isAll ? 1 : Math.ceil(total / limit),
      data: paginated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5.1 Route Analytics: all 98 corridors ranked from most data to least
app.get('/api/analytics/routes', (req, res) => {
  try {
    const records = loadTrafficData();
    const routeCounts = {};
    records.forEach(r => {
      const id = r.road_route_id || 'Unknown';
      if (!routeCounts[id]) {
        routeCounts[id] = { total: 0, congested: 0, speeds: [] };
      }
      routeCounts[id].total++;
      const lvl = (r.traffic_level || '').toUpperCase();
      if (lvl === 'SLOW' || lvl === 'MODERATE' || lvl === 'TRAFFIC_JAM' || lvl === 'HEAVY' || lvl === 'SEVERE') {
        routeCounts[id].congested++;
      }
      const s = parseFloat(r.traffic_speed_kmh);
      if (!isNaN(s)) routeCounts[id].speeds.push(s);
    });

    const routesRanked = Object.entries(routeCounts).map(([name, v]) => {
      const m = name.match(/^(R\d{2}):\s*(.*)$/);
      return {
        route_id: name,
        route_code: m ? m[1] : '',
        name: m ? m[2] : name,
        total: v.total,
        congested: v.congested,
        pct: Math.round((v.congested / v.total) * 100),
        avg_speed: v.speeds.length ? Number((v.speeds.reduce((a, b) => a + b, 0) / v.speeds.length).toFixed(1)) : 25.0
      };
    }).sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      totalRoutes: routesRanked.length,
      totalRecords: records.length,
      routes: routesRanked
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Alternative Route Advisor / Jam Bypass
app.post('/api/advisor', (req, res) => {
  try {
    const { routeCode, originCoords, destCoords, routeName, delayThreshold } = req.body;

    let origin = originCoords;
    let dest = destCoords;
    let name = routeName || 'Custom Route';

    if (routeCode) {
      const routes = getAllRoutesTelemetry();
      const match = routes.find(r => r.route_code === routeCode.toUpperCase());
      if (match) {
        origin = match.origin_coords;
        dest = match.dest_coords;
        name = match.route_id;
      }
    }

    if (!origin || !dest) {
      return res.status(400).json({
        success: false,
        error: 'Origin and destination coordinates or valid routeCode are required'
      });
    }

    const threshold = parseFloat(delayThreshold) || 4.0;
    const report = evaluateAlternativeRoutes(origin, dest, name, threshold);

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. What-If Traffic ML Simulation / Predictor
app.post('/api/predict', (req, res) => {
  try {
    const inputs = req.body || {};
    const prediction = simulatePrediction(inputs);
    res.json({ success: true, data: prediction });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7b. Day/Date, Time, From, To Journey Predictor & Alternative Route Advisor
// Powered by Google Maps Routes API v2 + OpenWeatherMap API + OSM Network
app.post('/api/predict-journey', async (req, res) => {
  try {
    const { date, day, time, from, to } = req.body || {};
    const result = await predictJourneyService({ date, day, time, from, to });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7b2. Exact Road Distance & Driving Time Measurement Tool (A to B)
app.post('/api/measure-route', async (req, res) => {
  try {
    const { origin, destination } = req.body || {};
    if (!origin || !destination || origin.length < 2 || destination.length < 2) {
      return res.status(400).json({ success: false, error: 'origin and destination [lat, lon] coordinates are required' });
    }

    const origCoords = [Number(origin[0]), Number(origin[1])];
    const destCoords = [Number(destination[0]), Number(destination[1])];
    const directDistKm = haversineKm(origCoords, destCoords);

    let roadCoords = null;
    let roadDistKm = 0;
    let osrmDurationMin = null;
    let roadNames = [];
    let routingEngine = 'OSM A*';

    // 1. Try OSRM full street-level routing (includes residential lanes, bridges, roundabouts)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origCoords[1]},${origCoords[0]};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson&steps=true`;
      const osrmRes = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (osrmRes.ok) {
        const osrmJson = await osrmRes.json();
        if (osrmJson && osrmJson.routes && osrmJson.routes[0]) {
          const r = osrmJson.routes[0];
          const pts = r.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
          if (pts.length >= 2) {
            roadCoords = [origCoords, ...pts, destCoords];
            roadDistKm = Number((r.distance / 1000).toFixed(2));
            osrmDurationMin = r.duration / 60;
            if (r.legs && r.legs[0] && Array.isArray(r.legs[0].steps)) {
              roadNames = [...new Set(r.legs[0].steps.map(s => (s.name || '').trim()).filter(Boolean))];
            }
            routingEngine = 'OSRM Full Street Network';
          }
        }
      }
    } catch (e) {
      // Fallback to local GeoJSON graph
    }

    // 2. Fallback to local Dhaka OSM arterial graph if OSRM unavailable
    if (!roadCoords) {
      const osmRoute = buildOsmRouteGeometry([origCoords, destCoords]);
      roadCoords = osmRoute.coordinates && osmRoute.coordinates.length >= 2
        ? [origCoords, ...osmRoute.coordinates, destCoords]
        : [origCoords, destCoords];

      if (osmRoute.segments && osmRoute.segments.length > 0) {
        roadDistKm = osmRoute.segments.reduce((acc, s) => acc + (s.distance_km || 0), 0);
      } else {
        for (let i = 1; i < roadCoords.length; i++) {
          roadDistKm += haversineKm(roadCoords[i - 1], roadCoords[i]);
        }
      }

      if (roadDistKm < directDistKm * 1.05) {
        roadDistKm = directDistKm * 1.32;
      }

      roadNames = osmRoute.segments
        ? [...new Set(osmRoute.segments.map(s => s.name).filter(n => n && !n.includes('Road Segment') && !n.includes('Primary Corridor')))]
        : [];
    }

    // Realistic Dhaka traffic velocity calibration
    const stats = getDashboardStats();
    const rawCitySpeed = (stats && stats.avgSpeedKmh) ? Number(stats.avgSpeedKmh) : 22.0;
    const effectiveSpeed = Math.min(34, Math.max(14, rawCitySpeed > 36 ? 24.5 : rawCitySpeed));

    const freeFlowMin = osrmDurationMin
      ? Math.max(1, Math.round(osrmDurationMin))
      : Math.max(1, Math.round((roadDistKm / 38) * 60));

    const estTimeMin = Math.max(freeFlowMin, Math.round((roadDistKm / effectiveSpeed) * 60));
    const delayMin = Math.max(0, estTimeMin - freeFlowMin);

    res.json({
      success: true,
      data: {
        road_distance_km: Number(roadDistKm.toFixed(2)),
        direct_distance_km: Number(directDistKm.toFixed(2)),
        coordinates: roadCoords,
        est_travel_time_min: estTimeMin,
        free_flow_time_min: freeFlowMin,
        delay_min: delayMin,
        city_speed_kmh: Number(effectiveSpeed.toFixed(1)),
        roads: roadNames.slice(0, 4),
        engine: routingEngine
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7c. Live Weather from OpenWeatherMap API
app.get('/api/weather', async (req, res) => {
  try {
    const weather = await getLiveWeatherService();
    res.json({ success: true, data: weather });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7d. Engine Telemetry & API Key Status
app.get('/api/engine-status', (req, res) => {
  try {
    const status = getEngineStatusService();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. OpenStreetMap Road Network GeoJSON Summary
app.get('/api/roads/summary', (req, res) => {
  try {
    const summary = getGeoJsonRoadSummary();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8b. Verified Official Monitored Corridors (R01-R50) routed along OSM roads with CSV/live telemetry
app.get('/api/corridors/osm-overlay', (req, res) => {
  try {
    const corridors = getMonitoredCorridorsOsmOverlay();
    res.json({ success: true, count: corridors.length, corridors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Health & System Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    service: 'Dhaka Traffic Prediction & Bypass Engine API',
    version: '1.0.0'
  });
});

// 10. Server Performance & Telemetry Diagnostics
app.get('/api/server-info', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    success: true,
    server: {
      uptime_seconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      memory: {
        rss_mb: Math.round(mem.rss / (1024 * 1024)),
        heap_used_mb: Math.round(mem.heapUsed / (1024 * 1024)),
        heap_total_mb: Math.round(mem.heapTotal / (1024 * 1024))
      }
    },
    features: {
      compression: 'gzip/brotli enabled (threshold: 1KB)',
      caching: 'In-memory TTL for routes (20s), weather (5m), and journey queries (3m)',
      concurrent_runners: 'Dual server & client runner enabled via npm run dev'
    }
  });
});

// Serve logo and favicon requests
app.get(['/favicon.ico', '/favicon.svg'], (req, res) => {
  const iconPath = path.resolve(__dirname, '../frontend/public/logo/logo.svg');
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(iconPath);
});

// Serve frontend build if dist folder exists
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to React index.html for client-side routing
app.use((req, res, next) => {
  // If it's an API route that wasn't matched, return 404 JSON instead of HTML
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: `API route ${req.path} not found` });
  }

  const indexHtml = path.join(distPath, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) {
      res.status(404).send('Frontend static files not yet built. Please run "npm run dev" or "npm run build".');
    }
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[API Error]', err.stack || err.message);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
});

const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Dhaka Traffic Node.js API Server running on http://127.0.0.1:${PORT} and http://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n[API Server] Received ${signal}, closing HTTP server gracefully...`);
  server.close(() => {
    console.log('[API Server] Closed HTTP server.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
