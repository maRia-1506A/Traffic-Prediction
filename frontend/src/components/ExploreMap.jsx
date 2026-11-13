import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers,
  MapPin,
  Navigation,
  Compass,
  Maximize2,
  Minimize2,
  Filter,
  Search,
  X,
  RotateCcw,
  Activity,
  Gauge,
  Clock,
  CloudRain,
  Sun,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  ChevronRight,
  TrendingUp,
  Info,
  Zap,
  Flame,
  SlidersHorizontal,
  Ruler,
  Crosshair,
  ArrowUpDown,
  Copy,
  Check
} from 'lucide-react';
import { fetchRoutes, fetchWaypoints, fetchCorridorsOverlay, measureExactRoadRoute } from '../api.js';
import { DHAKA_BYPASS_WAYPOINTS } from '../utils/dhakaRoutesData.js';

// ── Color Schemes & Badges ───────────────────────────────────────────────────
const LEVEL_COLORS = {
  NORMAL:   '#16a34a', // Standard traffic green
  LOW:      '#16a34a',
  MODERATE: '#f59e0b', // Amber
  MEDIUM:   '#f59e0b',
  HEAVY:    '#ea580c', // Deep orange
  SEVERE:   '#dc2626', // Traffic red
  HIGH:     '#dc2626',
};

// 100% Free basemap tile providers (Zero API Key required, Zero Watermarks)
const TILE_PROVIDERS = {
  osm: {
    name: 'Street Map',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: '0123',
    fallbackUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Google Maps &copy; Dhaka TrafficPulse',
    maxZoom: 20,
  },
  esriStreet: {
    name: 'World Street Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    subdomains: 'abc',
    fallbackUrl: 'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    maxZoom: 18,
  },
  esriDark: {
    name: 'Dark Gray Canvas',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: '0123',
    fallbackUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Google Maps &copy; Dhaka TrafficPulse',
    maxZoom: 20,
  }
};

// ── Pin Marker Factories (Exact Leaflet Anchors, Zero Translation Drift) ─────
const createPinMarker = (fill, label = '', isStart = true) => {
  const symbol = isStart ? 'A' : 'B';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" style="display:block">
    <path fill="${fill}" stroke="#ffffff" stroke-width="2"
      d="M16 1.5 C8.2 1.5 2 7.7 2 15.5 C2 25.5 16 38.5 16 38.5 C16 38.5 30 25.5 30 15.5 C30 7.7 23.8 1.5 16 1.5Z"/>
    <circle cx="16" cy="15.5" r="7" fill="#ffffff"/>
    <text x="16" y="19" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" fill="${fill}" text-anchor="middle">${symbol}</text>
  </svg>`;
  return L.divIcon({
    className: 'custom-pin-marker',
    html: `<div title="${label}" style="width:32px;height:40px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35))">${svg}</div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 39],
    popupAnchor: [0, -40],
  });
};

const createBypassMarker = (name, speed) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#0284c7" stroke="#ffffff" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="m12 8 4 4-4 4M8 12h8" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`;
  return L.divIcon({
    className: 'bypass-hub-marker',
    html: `<div title="${name} (${speed} km/h)" style="width:24px;height:24px;filter:drop-shadow(0 2px 5px rgba(2,132,199,0.45));cursor:pointer">${svg}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

const createBottleneckRadarMarker = (delay, name) => {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer" title="${name}: +${delay}m delay">
        <div class="bottleneck-pulse-node" style="position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(239,68,68,0.35);border:2px solid #ef4444"></div>
        <div style="position:relative;z-index:2;background:#dc2626;color:#ffffff;font-size:10px;font-weight:800;border-radius:999px;padding:2px 5px;border:1.5px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35)">
          +${delay}m
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
};

// Simple haversine formula for transit measurement tool
const calcDistanceKm = (coord1, coord2) => {
  const R = 6371;
  const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
  const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function ExploreMap() {
  const containerRef         = useRef(null);
  const mapRef               = useRef(null);
  const tileLayerRef         = useRef(null);
  const corridorLayerRef     = useRef(null);
  const bypassLayerRef       = useRef(null);
  const waypointLayerRef     = useRef(null);
  const selectionLayerRef    = useRef(null);
  const bottleneckLayerRef   = useRef(null);
  const measureLayerRef      = useRef(null);

  // Data state
  const [routes, setRoutes]               = useState([]);
  const [waypoints, setWaypoints]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [isOffline, setIsOffline]         = useState(false);

  // Filters & Controls
  const [scope, setScope]                 = useState('50_OFFICIAL'); // '50_OFFICIAL' | 'ALL_ROUTES'
  const [filter, setFilter]               = useState('ALL');         // 'ALL' | 'NORMAL' | 'MODERATE' | 'HEAVY' | 'SEVERE'
  const [velocityFilter, setVelocityFilter] = useState('ALL');       // 'ALL' | 'FAST' | 'CONGESTED' | 'JAM' | 'DELAY'
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);

  // Extra Features Toggles
  const [showBypasses, setShowBypasses]           = useState(true);
  const [showWaypoints, setShowWaypoints]         = useState(false);
  const [flowAnimation, setFlowAnimation]         = useState(false);
  const [showBottlenecks, setShowBottlenecks]     = useState(true);
  const [showDirectoryDrawer, setShowDirectoryDrawer] = useState(false);
  const [directorySort, setDirectorySort]         = useState('DELAY_DESC'); // 'CODE' | 'DELAY_DESC' | 'SPEED_ASC' | 'SPEED_DESC'
  const [tileKey, setTileKey]                     = useState('osm'); // 'osm' | 'esriStreet' | 'esriDark'
  const [isFullscreen, setIsFullscreen]           = useState(false);
  const [copiedTelemetry, setCopiedTelemetry]     = useState(false);

  // Quick Measure Tool State
  const [isMeasuring, setIsMeasuring]             = useState(false);
  const [measurePoints, setMeasurePoints]         = useState([]);
  const [measureResult, setMeasureResult]         = useState(null);
  const [isCalculatingMeasure, setIsCalculatingMeasure] = useState(false);

  // ── Load & Merge OSM Geometry with Telemetry Data ──────────────────────────
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overlayRes, routesRes, waypointsRes] = await Promise.all([
        fetchCorridorsOverlay().catch(() => null),
        fetchRoutes().catch(() => null),
        fetchWaypoints().catch(() => null)
      ]);

      const overlayMap = {};
      if (overlayRes && overlayRes.success && Array.isArray(overlayRes.corridors)) {
        overlayRes.corridors.forEach(c => {
          if (c.route_code) overlayMap[c.route_code] = c;
        });
      }

      let baseList = [];
      if (routesRes && routesRes.success && Array.isArray(routesRes.data)) {
        baseList = routesRes.data;
        setIsOffline(Boolean(routesRes.isOffline));
      } else if (overlayRes && overlayRes.corridors) {
        baseList = overlayRes.corridors;
      }

      // Merge real OSM curved coordinates & calibrated telemetry
      const enriched = baseList.map(r => {
        const overlay = overlayMap[r.route_code];
        const osmCoords = overlay?.coordinates && overlay.coordinates.length >= 2
          ? overlay.coordinates
          : (r.coordinates && r.coordinates.length >= 2)
            ? r.coordinates
            : (r.waypoints || []).map(wp => wp.coords).filter(Boolean);

        const rawLvl = (r.traffic_level || overlay?.raw_level || overlay?.traffic_level || 'NORMAL').toUpperCase();
        let normalizedLevel = 'NORMAL';
        if (rawLvl === 'SEVERE' || rawLvl === 'HIGH' || rawLvl === 'TRAFFIC_JAM') normalizedLevel = 'SEVERE';
        else if (rawLvl === 'HEAVY') normalizedLevel = 'HEAVY';
        else if (rawLvl === 'MODERATE' || rawLvl === 'MEDIUM' || rawLvl === 'SLOW') normalizedLevel = 'MODERATE';

        return {
          ...r,
          road_coords: osmCoords,
          traffic_level: normalizedLevel,
          traffic_speed_kmh: Number(r.traffic_speed_kmh ?? overlay?.speed_kmh ?? 24),
          traffic_delay_min: Number(r.traffic_delay_min ?? overlay?.delay_min ?? 0),
          travel_time_min: Number(r.travel_time_min ?? overlay?.travel_time_min ?? 22),
          road_length_km: Number(r.road_length_km ?? overlay?.road_length_km ?? 7.5),
          road_type: r.road_type || overlay?.road_type || 'Primary Urban Arterial',
          num_lanes: r.num_lanes || overlay?.num_lanes || 4,
          is_official: r.is_official !== undefined ? r.is_official : true,
          weather: r.weather || overlay?.weather || 'Clear',
          temperature_c: r.temperature_c ?? overlay?.temperature_c ?? 28,
          volume_veh_hr: r.volume_veh_hr ?? overlay?.volume_veh_hr ?? 420,
          occupancy_pct: r.occupancy_pct ?? overlay?.occupancy_pct ?? 25,
        };
      });

      setRoutes(enriched);

      if (waypointsRes && waypointsRes.success && Array.isArray(waypointsRes.waypoints)) {
        setWaypoints(waypointsRes.waypoints);
      }
    } catch (e) {
      console.warn('ExploreMap load error:', e);
      setError('Could not load Dhaka road network data. Verify backend server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ── Calculate Live Network Summary Stats ────────────────────────────────────
  const networkStats = useMemo(() => {
    if (!routes || routes.length === 0) {
      return { total: 0, avgSpeed: 0, avgDelay: 0, severeCount: 0, moderateCount: 0, normalCount: 0 };
    }
    const total = routes.length;
    const avgSpeed = (routes.reduce((acc, r) => acc + (r.traffic_speed_kmh || 0), 0) / total).toFixed(1);
    const avgDelay = (routes.reduce((acc, r) => acc + (r.traffic_delay_min || 0), 0) / total).toFixed(1);
    const severeCount = routes.filter(r => r.traffic_level === 'SEVERE' || r.traffic_level === 'HEAVY').length;
    const moderateCount = routes.filter(r => r.traffic_level === 'MODERATE').length;
    const normalCount = routes.filter(r => r.traffic_level === 'NORMAL').length;

    return { total, avgSpeed, avgDelay, severeCount, moderateCount, normalCount };
  }, [routes]);

  // ── Filter Corridors by Scope, Status, Velocity, and Search Query ──────────
  const visibleRoutes = useMemo(() => {
    return routes.filter(r => {
      // 1. Scope filter
      const codeNum = parseInt((r.route_code || '').replace('R', ''), 10);
      if (scope === '50_OFFICIAL' && !isNaN(codeNum) && codeNum > 50) return false;

      // 2. Traffic Level filter
      if (filter !== 'ALL' && r.traffic_level !== filter) return false;

      // 3. Velocity Quick Filter
      if (velocityFilter === 'FAST' && r.traffic_speed_kmh < 26) return false;
      if (velocityFilter === 'CONGESTED' && (r.traffic_speed_kmh >= 22 || r.traffic_delay_min < 4)) return false;
      if (velocityFilter === 'JAM' && (r.traffic_level !== 'SEVERE' && r.traffic_speed_kmh > 14)) return false;
      if (velocityFilter === 'DELAY' && r.traffic_delay_min < 8) return false;

      // 4. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = (r.route_code || '').toLowerCase().includes(q);
        const matchesName = (r.route_id || '').toLowerCase().includes(q);
        const matchesOrig = (r.origin_name || '').toLowerCase().includes(q);
        const matchesDest = (r.dest_name || '').toLowerCase().includes(q);
        const matchesRoad = (r.road_type || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesOrig && !matchesDest && !matchesRoad) {
          return false;
        }
      }

      return true;
    });
  }, [routes, scope, filter, velocityFilter, searchQuery]);

  // ── Sorted Corridors for Directory Drawer ──────────────────────────────────
  const sortedDirectoryRoutes = useMemo(() => {
    return [...visibleRoutes].sort((a, b) => {
      if (directorySort === 'DELAY_DESC') return b.traffic_delay_min - a.traffic_delay_min;
      if (directorySort === 'SPEED_ASC')  return a.traffic_speed_kmh - b.traffic_speed_kmh;
      if (directorySort === 'SPEED_DESC') return b.traffic_speed_kmh - a.traffic_speed_kmh;
      return (a.route_code || '').localeCompare(b.route_code || '');
    });
  }, [visibleRoutes, directorySort]);

  // Top 5 Congested Bottlenecks for Radar Rings
  const topBottlenecks = useMemo(() => {
    return [...routes]
      .filter(r => r.road_coords && r.road_coords.length >= 2)
      .sort((a, b) => b.traffic_delay_min - a.traffic_delay_min)
      .slice(0, 5);
  }, [routes]);

  // ── 1. Initialize Map Instance Once ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [23.795, 90.405],
      zoom: 13,
      zoomSnap: 1,
      zoomDelta: 1,
      minZoom: 10,
      maxZoom: 18,
      zoomControl: false,
    });

    // Dedicated custom panes to keep layers visually layered
    map.createPane('corridorCasingPane').style.zIndex = 410;
    map.createPane('corridorFlowPane').style.zIndex = 420;
    map.createPane('selectedCasingPane').style.zIndex = 450;
    map.createPane('selectedFlowPane').style.zIndex = 460;
    map.createPane('bottleneckPane').style.zIndex = 475;
    map.createPane('waypointPane').style.zIndex = 485;
    map.createPane('measurePane').style.zIndex = 500;
    map.createPane('markerPane').style.zIndex = 520;

    // Add base tile layer (100% Free with zero API key required)
    const attachTileLayer = (prov) => {
      let fellBack = false;
      const layer = L.tileLayer(prov.url, {
        maxZoom: prov.maxZoom,
        subdomains: prov.subdomains || 'abc',
        attribution: prov.attribution,
      });
      layer.on('tileerror', () => {
        if (!fellBack && prov.fallbackUrl) {
          fellBack = true;
          layer.setUrl(prov.fallbackUrl);
        }
      });
      return layer.addTo(map);
    };

    const provider = TILE_PROVIDERS[tileKey] || TILE_PROVIDERS.osm;
    tileLayerRef.current = attachTileLayer(provider);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Layer groups
    corridorLayerRef.current   = L.layerGroup().addTo(map);
    bypassLayerRef.current     = L.layerGroup().addTo(map);
    waypointLayerRef.current   = L.layerGroup().addTo(map);
    bottleneckLayerRef.current = L.layerGroup().addTo(map);
    selectionLayerRef.current  = L.layerGroup().addTo(map);
    measureLayerRef.current    = L.layerGroup().addTo(map);
    mapRef.current             = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── 2. Switch Basemap Tiles Dynamically ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const provider = TILE_PROVIDERS[tileKey] || TILE_PROVIDERS.osm;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    let fellBack = false;
    const nextLayer = L.tileLayer(provider.url, {
      maxZoom: provider.maxZoom,
      subdomains: provider.subdomains || 'abc',
      attribution: provider.attribution,
    });
    nextLayer.on('tileerror', () => {
      if (!fellBack && provider.fallbackUrl) {
        fellBack = true;
        nextLayer.setUrl(provider.fallbackUrl);
      }
    });
    tileLayerRef.current = nextLayer.addTo(map);
  }, [tileKey]);

  // ── 3. Render Corridors on Map along Curved OSM Road Geometry ───────────────
  useEffect(() => {
    const map = mapRef.current;
    const cl  = corridorLayerRef.current;
    if (!map || !cl) return;

    cl.clearLayers();
    const isDarkTheme = tileKey === 'esriDark';

    visibleRoutes.forEach(route => {
      const coords = route.road_coords;
      if (!coords || coords.length < 2) return;

      // Split out unrealistic straight-line jumps (>0.85 km) outside local OSM GeoJSON bounds
      const roadSegments = [];
      let currentSeg = [coords[0]];
      for (let i = 1; i < coords.length; i++) {
        if (calcDistanceKm(coords[i - 1], coords[i]) <= 0.85) {
          currentSeg.push(coords[i]);
        } else {
          if (currentSeg.length >= 2) roadSegments.push(currentSeg);
          currentSeg = [coords[i]];
        }
      }
      if (currentSeg.length >= 2) roadSegments.push(currentSeg);
      if (roadSegments.length === 0) return;

      const level = route.traffic_level || 'NORMAL';
      const color = LEVEL_COLORS[level] || LEVEL_COLORS.NORMAL;
      const isSel = selectedRoute && selectedRoute.route_code === route.route_code;

      roadSegments.forEach(segCoords => {
        // 1. Subtle Road Casing Line (renders beneath flow for crisp edges)
        L.polyline(segCoords, {
          pane: 'corridorCasingPane',
          color: isDarkTheme ? '#020617' : '#ffffff',
          weight: isSel ? 6 : 3.6,
          opacity: isDarkTheme ? 0.8 : 0.88,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(cl);

        // 2. Standard Traffic Flow Polyline
        const polyline = L.polyline(segCoords, {
          pane: 'corridorFlowPane',
          color: isSel ? '#2563eb' : color,
          weight: isSel ? 4.2 : 2.3,
          opacity: isSel ? 1.0 : (level === 'SEVERE' ? 0.92 : 0.85),
          lineCap: 'round',
          lineJoin: 'round',
          interactive: !isMeasuring,
          className: flowAnimation ? 'traffic-flow-animated' : '',
        });

        if (!isMeasuring) {
          // Interactive Rich Popup
          polyline.bindPopup(`
          <div style="font-family:Inter,system-ui,sans-serif;padding:3px;min-width:215px;font-size:12px;color:#0f172a">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
              <span style="font-weight:800;color:#2563eb;font-size:13px">${route.route_code}</span>
              <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:${color}22;color:${color};border:1px solid ${color}44">
                ${level} FLOW
              </span>
            </div>
            <div style="font-size:12px;font-weight:600;color:#1e293b;margin-bottom:6px">
              ${route.origin_name} &rarr; ${route.dest_name}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f8fafc;padding:6px 8px;border-radius:8px;font-size:11px;border:1px solid #e2e8f0;margin-bottom:6px">
              <div>Speed: <b style="color:#0f172a">${route.traffic_speed_kmh} km/h</b></div>
              <div>Delay: <b style="color:#ea580c">+${route.traffic_delay_min} min</b></div>
              <div>ETA: <b style="color:#0f172a">${route.travel_time_min} min</b></div>
              <div>Dist: <b style="color:#0f172a">${route.road_length_km} km</b></div>
            </div>
            <div style="font-size:10px;color:#64748b;display:flex;align-items:center;justify-content:space-between">
              <span>${route.road_type}</span>
              <span style="color:#2563eb;font-weight:600;cursor:pointer">Click to inspect &rarr;</span>
            </div>
          </div>
        `, { maxWidth: 290 });

          // Hover emphasis
          polyline.on('mouseover', () => {
            if (!selectedRoute || selectedRoute.route_code !== route.route_code) {
              polyline.setStyle({ weight: 4.0, opacity: 1.0 });
            }
          });
          polyline.on('mouseout', () => {
            if (!selectedRoute || selectedRoute.route_code !== route.route_code) {
              polyline.setStyle({ weight: 2.3, opacity: 0.85 });
            }
          });

          // Click to select & inspect
          polyline.on('click', () => {
            setSelectedRoute(route);
          });
        }

        polyline.addTo(cl);
      });
    });
  }, [visibleRoutes, selectedRoute, tileKey, flowAnimation, isMeasuring]);

  // ── 4. Render Selected Route Highlight & Start/End Anchor Pins ──────────────
  useEffect(() => {
    const map = mapRef.current;
    const sl  = selectionLayerRef.current;
    if (!map || !sl) return;

    sl.clearLayers();
    if (!selectedRoute || !selectedRoute.road_coords || selectedRoute.road_coords.length < 2) return;

    const coords = selectedRoute.road_coords;
    const startPoint = coords[0];
    const endPoint = coords[coords.length - 1];

    // Highlight Casing
    L.polyline(coords, {
      pane: 'selectedCasingPane',
      color: '#ffffff',
      weight: 8.5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(sl);

    // Highlight Line
    const highlightPoly = L.polyline(coords, {
      pane: 'selectedFlowPane',
      color: '#2563eb',
      weight: 5.5,
      opacity: 1.0,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(sl);

    // Start Pin (A - Emerald Green)
    L.marker(startPoint, {
      icon: createPinMarker('#16a34a', `Origin: ${selectedRoute.origin_name}`, true),
      pane: 'markerPane',
    })
      .bindTooltip(`<b>Start:</b> ${selectedRoute.origin_name}`, { direction: 'top', offset: [0, -38] })
      .addTo(sl);

    // End Pin (B - Rose Red)
    L.marker(endPoint, {
      icon: createPinMarker('#dc2626', `Destination: ${selectedRoute.dest_name}`, false),
      pane: 'markerPane',
    })
      .bindTooltip(`<b>Destination:</b> ${selectedRoute.dest_name}`, { direction: 'top', offset: [0, -38] })
      .addTo(sl);

    // Smoothly fly and frame the selected corridor
    try {
      map.fitBounds(highlightPoly.getBounds(), {
        padding: [60, 60],
        maxZoom: 15,
        animate: true,
      });
    } catch (e) {
      // Bounds fallback
    }
  }, [selectedRoute]);

  // ── 5. Render Strategic Bypass Hubs & Flyovers Layer ────────────────────────
  useEffect(() => {
    const bl = bypassLayerRef.current;
    if (!bl) return;
    bl.clearLayers();

    if (!showBypasses) return;

    DHAKA_BYPASS_WAYPOINTS.forEach(bp => {
      if (!bp.coords || bp.coords.length < 2) return;
      const marker = L.marker(bp.coords, {
        icon: createBypassMarker(bp.name, bp.speed),
        pane: 'markerPane',
      });

      marker.bindPopup(`
        <div style="font-family:Inter,system-ui,sans-serif;font-size:12px;padding:3px;min-width:190px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <strong style="color:#0284c7;font-size:13px">${bp.name}</strong>
          </div>
          <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#0284c718;color:#0284c7;border:1px solid #0284c740">
            ${bp.tag || 'Flyover / Bypass'}
          </span>
          <div style="margin-top:6px;font-size:11px;color:#475569">
            Average Speed: <b style="color:#10b981">${bp.speed} km/h</b>
          </div>
          <div style="font-size:10px;color:#94a3b8;margin-top:4px">
            Strategic alternative bypass avoiding arterial choke points.
          </div>
        </div>
      `);

      marker.addTo(bl);
    });
  }, [showBypasses]);

  // ── 6. Render Strategic Junctions & Waypoints (Optional Toggle) ─────────────
  useEffect(() => {
    const wl = waypointLayerRef.current;
    if (!wl) return;
    wl.clearLayers();

    if (!showWaypoints || !waypoints || waypoints.length === 0) return;

    waypoints.forEach(wp => {
      if (!wp.lat || !wp.lon) return;
      L.circleMarker([wp.lat, wp.lon], {
        pane: 'waypointPane',
        radius: 4,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 1.5,
        fillOpacity: 0.85,
      })
        .bindTooltip(`<b>${wp.name}</b><br><span style="font-size:10px;color:#64748b">Strategic Junction Node</span>`, {
          direction: 'top',
          offset: [0, -5],
        })
        .addTo(wl);
    });
  }, [showWaypoints, waypoints]);

  // ── 7. Render Severe Bottleneck Radar Rings ─────────────────────────────────
  useEffect(() => {
    const bnl = bottleneckLayerRef.current;
    if (!bnl) return;
    bnl.clearLayers();

    if (!showBottlenecks || topBottlenecks.length === 0) return;

    topBottlenecks.forEach(r => {
      if (r.traffic_delay_min < 5) return;
      const midIdx = Math.floor(r.road_coords.length / 2);
      const midCoord = r.road_coords[midIdx];
      if (!midCoord) return;

      const marker = L.marker(midCoord, {
        icon: createBottleneckRadarMarker(r.traffic_delay_min, r.origin_name),
        pane: 'bottleneckPane',
      });

      marker.bindTooltip(`
        <div style="font-family:Inter,sans-serif;font-size:11px">
          <strong style="color:#dc2626">${r.route_code}: Heavy Bottleneck</strong><br>
          <span>${r.origin_name} &rarr; ${r.dest_name}</span><br>
          <span style="color:#ea580c">Delay: +${r.traffic_delay_min}m &middot; Speed: ${r.traffic_speed_kmh} km/h</span>
        </div>
      `, { direction: 'top', offset: [0, -18] });

      marker.on('click', () => setSelectedRoute(r));
      marker.addTo(bnl);
    });
  }, [showBottlenecks, topBottlenecks]);

  // ── 8. Transit Exact Road Routing Measure Tool (Click 2 points on map) ────
  useEffect(() => {
    const map = mapRef.current;
    const ml  = measureLayerRef.current;
    if (!map || !ml) return;

    if (!isMeasuring) {
      ml.clearLayers();
      setMeasurePoints([]);
      setMeasureResult(null);
      setIsCalculatingMeasure(false);
      return;
    }

    const handleClick = async (e) => {
      const newPt = [e.latlng.lat, e.latlng.lng];

      if (measurePoints.length === 0 || measurePoints.length >= 2) {
        // Start fresh: place Point A
        ml.clearLayers();
        setMeasureResult(null);

        const markerA = L.circleMarker(newPt, {
          radius: 7,
          color: '#16a34a',
          fillColor: '#22c55e',
          fillOpacity: 1.0,
          weight: 2.5,
          pane: 'measurePane'
        });
        markerA.bindTooltip("<b>Point A</b>", { permanent: true, direction: 'top', offset: [0, -10] });
        markerA.addTo(ml);

        setMeasurePoints([newPt]);
      } else if (measurePoints.length === 1) {
        // Point B clicked: measure exact road route
        const p1 = measurePoints[0];
        const p2 = newPt;
        setMeasurePoints([p1, p2]);

        const markerB = L.circleMarker(p2, {
          radius: 7,
          color: '#dc2626',
          fillColor: '#ef4444',
          fillOpacity: 1.0,
          weight: 2.5,
          pane: 'measurePane'
        });
        markerB.bindTooltip("<b>Point B</b>", { permanent: true, direction: 'bottom', offset: [0, 10] });
        markerB.addTo(ml);

        // Interim preview while routing
        const tempLine = L.polyline([p1, p2], {
          pane: 'measurePane',
          color: '#3b82f6',
          dashArray: '6, 8',
          weight: 3,
          opacity: 0.7,
        }).addTo(ml);
        tempLine.bindTooltip("Calculating exact road driving distance...", { permanent: true, direction: 'center' });

        setIsCalculatingMeasure(true);
        try {
          const result = await measureExactRoadRoute(p1, p2);
          ml.removeLayer(tempLine);

          if (result && result.coordinates && result.coordinates.length >= 2) {
            // 1. Direct air line guide (thin, subtle gray dashed)
            L.polyline([p1, p2], {
              pane: 'measurePane',
              color: '#94a3b8',
              dashArray: '4, 6',
              weight: 1.8,
              opacity: 0.5,
            })
              .bindTooltip(`Air: ${result.direct_distance_km} km`, { direction: 'center', opacity: 0.85 })
              .addTo(ml);

            // 2. White casing for road curve
            L.polyline(result.coordinates, {
              pane: 'measurePane',
              color: '#ffffff',
              weight: 8,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(ml);

            // 3. Exact curved road polyline along actual streets
            const roadPoly = L.polyline(result.coordinates, {
              pane: 'measurePane',
              color: '#2563eb',
              weight: 5,
              opacity: 1.0,
              lineCap: 'round',
              lineJoin: 'round',
            });

            roadPoly.bindTooltip(`
              <div style="font-family:Inter,system-ui,sans-serif;padding:3px 5px;text-align:center">
                <span style="color:#2563eb;font-weight:800;font-size:13px">Exact Road: ${result.road_distance_km} km</span><br/>
                <span style="font-size:11px;font-weight:600;color:#1e293b">Est. Drive: ~${result.est_travel_time_min} min</span>
              </div>
            `, {
              permanent: false,
              sticky: true,
              direction: 'top',
              offset: [0, -8],
              className: 'map-label-pill',
            });

            roadPoly.addTo(ml);
            setMeasureResult(result);
          }
        } catch (err) {
          console.warn('Measurement error:', err);
        } finally {
          setIsCalculatingMeasure(false);
        }
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [isMeasuring, measurePoints]);

  // ── Helper Actions ─────────────────────────────────────────────────────────
  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.setView([23.795, 90.405], 13, { animate: true });
      mapRef.current.invalidateSize();
    }
    setSelectedRoute(null);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 250);
  };

  const copyTelemetrySummary = (r) => {
    if (!r) return;
    const text = `Corridor ${r.route_code}: ${r.origin_name} -> ${r.dest_name} | Level: ${r.traffic_level} | Speed: ${r.traffic_speed_kmh} km/h | Delay: +${r.traffic_delay_min} min | Travel: ${r.travel_time_min} min | Road: ${r.road_length_km} km (${r.road_type})`;
    navigator.clipboard?.writeText(text);
    setCopiedTelemetry(true);
    setTimeout(() => setCopiedTelemetry(false), 2000);
  };

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-4 overflow-y-auto' : ''}`}>
      {/* ── Page Header & System Telemetry Status ─────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Explore Dhaka Road Network & Corridors
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Curved OSM Telemetry
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time multi-lane road flows, curved OSM geometry, calibrated speeds, animated flow pulse, and strategic flyovers.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {isOffline ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Autonomous Mode (Precomputed OSM)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Live Telemetry Feed (Port 5000)
            </span>
          )}

          <button
            onClick={loadData}
            title="Refresh network telemetry"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Network Summary KPI Strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Scope</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">{visibleRoutes.length}</span>
            <span className="text-xs text-slate-500">/ {routes.length} corridors</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {scope === '50_OFFICIAL' ? 'Official Monitored Grid' : 'Comprehensive Network'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Speed</span>
            <Gauge className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">{networkStats.avgSpeed}</span>
            <span className="text-xs text-slate-500">km/h</span>
          </div>
          <p className="text-[10px] text-emerald-600 mt-0.5 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Live citywide velocity
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Delay</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-amber-600">+{networkStats.avgDelay}</span>
            <span className="text-xs text-slate-500">min</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            Over free-flow baseline
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Congestion Hotspots</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-rose-600">{networkStats.severeCount}</span>
            <span className="text-xs text-slate-500">routes</span>
          </div>
          <p className="text-[10px] text-rose-500 mt-0.5 font-medium">
            Heavy or severe bottlenecks
          </p>
        </div>
      </div>

      {/* ── Interactive Filters & Controls Toolbar ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs space-y-3">
        {/* Row 1: Scope, Level Filters, and Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Pill */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setScope('50_OFFICIAL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  scope === '50_OFFICIAL'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Official 50 Corridors
              </button>
              <button
                onClick={() => setScope('ALL_ROUTES')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  scope === 'ALL_ROUTES'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Corridors ({routes.length})
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            {/* Traffic Level Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" />
                Traffic:
              </span>
              {[
                { id: 'ALL', label: 'All', color: 'bg-blue-600 text-white' },
                { id: 'NORMAL', label: 'Normal', color: 'bg-emerald-600 text-white' },
                { id: 'MODERATE', label: 'Moderate', color: 'bg-amber-600 text-white' },
                { id: 'HEAVY', label: 'Heavy', color: 'bg-orange-600 text-white' },
                { id: 'SEVERE', label: 'Severe', color: 'bg-rose-600 text-white' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                    filter === item.id
                      ? `${item.color} border-transparent shadow-xs`
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 bg-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search corridor or area (e.g. Mirpur, Airport, R01)..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Velocity Triage Quick Filters */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-slate-400" />
            Speed Triage:
          </span>
          {[
            { id: 'ALL', label: 'All Velocities' },
            { id: 'FAST', label: '🚀 Fast Flow (>25 km/h)' },
            { id: 'CONGESTED', label: '⚠️ Congested (<22 km/h)' },
            { id: 'JAM', label: '🛑 Severe Jams (<14 km/h)' },
            { id: 'DELAY', label: '⏱️ High Delay (+8m)' },
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setVelocityFilter(chip.id)}
              className={`px-2.5 py-0.5 text-[11px] font-medium rounded-md border transition ${
                velocityFilter === chip.id
                  ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-2xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Row 3: Feature Toggles Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Corridor List Drawer Toggle */}
            <button
              onClick={() => setShowDirectoryDrawer(!showDirectoryDrawer)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition ${
                showDirectoryDrawer
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="Open full corridor directory drawer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>Corridor Directory ({visibleRoutes.length})</span>
            </button>

            {/* Live Flow Pulse Animation Toggle */}
            <button
              onClick={() => setFlowAnimation(!flowAnimation)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition ${
                flowAnimation
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
              }`}
              title="Toggle animated real-time flow dashes"
            >
              <Zap className={`w-3.5 h-3.5 ${flowAnimation ? 'text-emerald-600 fill-emerald-600 animate-pulse' : 'text-slate-400'}`} />
              <span>Flow Animation</span>
            </button>

            {/* Severe Bottleneck Radar Rings Toggle */}
            <button
              onClick={() => setShowBottlenecks(!showBottlenecks)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition ${
                showBottlenecks
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
              }`}
              title="Highlight top 5 severe choke point radars"
            >
              <Flame className="w-3.5 h-3.5 text-rose-600" />
              <span>Bottleneck Radars</span>
            </button>

            {/* Bypass Hubs Toggle */}
            <button
              onClick={() => setShowBypasses(!showBypasses)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition ${
                showBypasses
                  ? 'bg-sky-50 border-sky-300 text-sky-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
              }`}
              title="Toggle strategic flyovers and expressway bypass hubs"
            >
              <Compass className="w-3.5 h-3.5 text-sky-600" />
              <span>Flyover Hubs ({DHAKA_BYPASS_WAYPOINTS.length})</span>
            </button>

            {/* Junction Nodes Toggle */}
            <button
              onClick={() => setShowWaypoints(!showWaypoints)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition ${
                showWaypoints
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
              }`}
              title="Toggle strategic landmark junction markers"
            >
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Junction Nodes ({waypoints.length})</span>
            </button>

            {/* Transit Measure Tool Toggle */}
            <button
              onClick={() => setIsMeasuring(!isMeasuring)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition ${
                isMeasuring
                  ? 'bg-violet-50 border-violet-400 text-violet-700 ring-2 ring-violet-200'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
              }`}
              title="Click 2 points on map to measure road distance and travel time"
            >
              <Ruler className="w-3.5 h-3.5 text-violet-600" />
              <span>{isMeasuring ? 'Measure Tool Active (Click 2 Pts)' : 'Measure Tool'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Basemap Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 px-1.5 uppercase">Basemap:</span>
              <button
                onClick={() => setTileKey('osm')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition ${
                  tileKey === 'osm' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                OSM Streets
              </button>
              <button
                onClick={() => setTileKey('esriStreet')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition ${
                  tileKey === 'esriStreet' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                World Street
              </button>
              <button
                onClick={() => setTileKey('esriDark')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition ${
                  tileKey === 'esriDark' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dark Canvas
              </button>
            </div>

            <button
              onClick={handleResetView}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="Recenter map on Greater Dhaka"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isFullscreen ? 'Exit' : 'Full'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Map Canvas with Floating Directory & Inspector Card ────── */}
      <div className={`relative ${tileKey === 'esriDark' ? 'bg-slate-950 dark-canvas-map' : 'bg-slate-100 clean-traffic-map'} ${isMeasuring ? 'measuring-mode' : ''} rounded-2xl border border-slate-200 overflow-hidden shadow-md ${isFullscreen ? 'h-[calc(100vh-270px)]' : 'h-[540px] sm:h-[640px]'}`}>
        {loading && (
          <div className="absolute inset-0 z-[1000] bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center">
            <div className="w-9 h-9 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-700 mt-3">Routing curved OSM road geometries...</p>
            <p className="text-[11px] text-slate-400 mt-1">Calibrating Bayesian telemetry for Dhaka corridors</p>
          </div>
        )}

        <div ref={containerRef} className="absolute inset-0 w-full h-full z-0" />

        {/* ── Slide-out Corridor Directory Drawer (Left Overlay) ─────────── */}
        {showDirectoryDrawer && (
          <div className="absolute top-3 left-3 bottom-3 w-80 sm:w-96 z-25 bg-white/98 backdrop-blur-md border border-slate-200 rounded-2xl p-3 shadow-2xl flex flex-col animate-in fade-in slide-in-from-left-3 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Corridor Directory ({visibleRoutes.length})
                </h3>
              </div>
              <button
                onClick={() => setShowDirectoryDrawer(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sorting Tabs */}
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-slate-400" /> Sort:
              </span>
              <div className="flex items-center gap-1">
                {[
                  { id: 'DELAY_DESC', label: 'Worst Delay' },
                  { id: 'SPEED_ASC',  label: 'Slowest' },
                  { id: 'SPEED_DESC', label: 'Fastest' },
                  { id: 'CODE',       label: 'Route ID' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setDirectorySort(s.id)}
                    className={`px-1.5 py-0.5 rounded font-medium transition ${
                      directorySort === s.id ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Corridors List */}
            <div className="mt-2 flex-1 overflow-y-auto space-y-1.5 pr-1">
              {sortedDirectoryRoutes.map(r => {
                const isSel = selectedRoute && selectedRoute.route_code === r.route_code;
                const levelColor = LEVEL_COLORS[r.traffic_level] || '#10b981';
                return (
                  <div
                    key={r.route_code}
                    onClick={() => setSelectedRoute(r)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition ${
                      isSel
                        ? 'bg-blue-50/90 border-blue-400 shadow-2xs ring-1 ring-blue-300'
                        : 'bg-slate-50/70 border-slate-200 hover:border-blue-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black text-blue-700 bg-white border border-blue-200 px-1.5 py-0.5 rounded">
                          {r.route_code}
                        </span>
                        <span className="text-xs font-bold text-slate-800 truncate max-w-[170px]">
                          {r.origin_name} &rarr; {r.dest_name}
                        </span>
                      </div>
                      <span
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                        style={{ background: `${levelColor}22`, color: levelColor, border: `1px solid ${levelColor}44` }}
                      >
                        {r.traffic_level}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Speed: <b className="text-slate-800">{r.traffic_speed_kmh} km/h</b></span>
                      <span>Delay: <b className={r.traffic_delay_min > 5 ? 'text-rose-600' : 'text-amber-600'}>+{r.traffic_delay_min}m</b></span>
                      <span>ETA: <b className="text-slate-800">{r.travel_time_min}m</b></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Road Surface & Weather Telemetry Pill (Top Left Inside Map) ── */}
        <div className="absolute top-4 left-4 z-15 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 shadow-md flex items-center gap-2.5">
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-semibold">Dry Road Surface (Friction: 0.85)</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Speed Multiplier: <b className="text-emerald-600">1.00x</b></span>
        </div>

        {/* ── Measure Tool Instructions & Results Floating Card ─────────── */}
        {isMeasuring && (
          <div className="absolute top-14 left-4 z-20 max-w-sm">
            {!measureResult ? (
              <div className="bg-violet-900/95 text-white backdrop-blur-md px-3.5 py-2 rounded-xl text-xs shadow-xl flex items-center gap-2.5 border border-violet-700 animate-in fade-in">
                <Crosshair className={`w-4 h-4 text-violet-300 shrink-0 ${isCalculatingMeasure ? 'animate-spin' : ''}`} />
                <span>
                  {isCalculatingMeasure
                    ? 'Tracing real road geometry along Dhaka street network...'
                    : measurePoints.length === 1
                    ? 'Point A placed. Now click Point B (Destination) on the map.'
                    : 'Click Point A (Start) on the map to begin measuring road route.'}
                </span>
              </div>
            ) : (
              <div className="bg-white/98 text-slate-800 backdrop-blur-md p-3.5 rounded-2xl text-xs shadow-2xl border border-violet-300 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="font-extrabold text-violet-700 flex items-center gap-1.5 text-xs">
                    <Ruler className="w-4 h-4 text-violet-600" />
                    Exact Road Driving Route
                  </span>
                  <button
                    onClick={() => {
                      setMeasurePoints([]);
                      setMeasureResult(null);
                      if (measureLayerRef.current) measureLayerRef.current.clearLayers();
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                    title="Clear measurement"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 text-center bg-violet-50/60 p-2.5 rounded-xl border border-violet-100">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Driving Road Distance</span>
                    <p className="text-base font-black text-blue-700 mt-0.5">
                      {measureResult.road_distance_km} <span className="text-xs font-normal text-slate-500">km</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Est. Drive Time</span>
                    <p className="text-base font-black text-slate-900 mt-0.5">
                      ~{measureResult.est_travel_time_min} <span className="text-xs font-normal text-slate-500">min</span>
                    </p>
                  </div>
                </div>

                {measureResult.roads && measureResult.roads.length > 0 && (
                  <p className="mt-2 text-[11px] text-slate-600 truncate">
                    Via: <span className="font-semibold text-slate-900">{measureResult.roads.join(' → ')}</span>
                  </p>
                )}

                <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Straight-line air: <b>{measureResult.direct_distance_km} km</b></span>
                  <span className="text-violet-600 font-semibold">
                    Road winding: +{Math.max(0, Math.round((measureResult.road_distance_km / Math.max(measureResult.direct_distance_km, 0.1) - 1) * 100))}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Floating Quick Legend Badge (Bottom Left) ──────────────────── */}
        <div className="hidden sm:flex absolute bottom-4 left-4 z-10 items-center gap-3 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/90 text-[11px] text-slate-700 shadow-lg">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Flow Status:</span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-1.5 rounded-full bg-emerald-500 inline-block" /> Normal
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-1.5 rounded-full bg-amber-500 inline-block" /> Moderate
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-1.5 rounded-full bg-orange-500 inline-block" /> Heavy
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-1.5 rounded-full bg-rose-500 animate-pulse inline-block" /> Severe Jam
          </span>
          {showBypasses && (
            <span className="flex items-center gap-1.5 font-medium text-sky-700 border-l border-slate-200 pl-2">
              <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" /> Bypass Hub
            </span>
          )}
          {showBottlenecks && (
            <span className="flex items-center gap-1.5 font-medium text-rose-700 border-l border-slate-200 pl-2">
              <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" /> Bottleneck
            </span>
          )}
        </div>

        {/* ── Selected Corridor Inspector Drawer / Floating Card (Top/Bottom Right) ── */}
        {selectedRoute && (
          <div className="absolute top-4 right-4 max-w-sm w-full z-20 bg-white/98 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header with Route Code & Congestion Badge */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                  {selectedRoute.route_code}
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                  selectedRoute.traffic_level === 'SEVERE' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                  selectedRoute.traffic_level === 'HEAVY' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                  selectedRoute.traffic_level === 'MODERATE' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {selectedRoute.traffic_level} CONGESTION
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => copyTelemetrySummary(selectedRoute)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                  title="Copy corridor telemetry report"
                >
                  {copiedTelemetry ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setSelectedRoute(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                  title="Close corridor details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Corridor Origin -> Destination */}
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Monitored Corridor</p>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                {selectedRoute.origin_name} &rarr; {selectedRoute.dest_name}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                {selectedRoute.road_type} &middot; {selectedRoute.num_lanes || 4} Lanes
              </p>
            </div>

            {/* Real-time Telemetry Metrics Grid */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Flow Velocity</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">
                  {selectedRoute.traffic_speed_kmh} <span className="text-[10px] font-normal text-slate-500">km/h</span>
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Congestion Delay</span>
                <p className={`font-bold text-sm mt-0.5 ${selectedRoute.traffic_delay_min > 8 ? 'text-rose-600' : selectedRoute.traffic_delay_min > 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  +{selectedRoute.traffic_delay_min} <span className="text-[10px] font-normal text-slate-500">min</span>
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Est. Travel Time</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">
                  {selectedRoute.travel_time_min} <span className="text-[10px] font-normal text-slate-500">min</span>
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Curved Distance</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">
                  {selectedRoute.road_length_km} <span className="text-[10px] font-normal text-slate-500">km</span>
                </p>
              </div>
            </div>

            {/* Environmental & Traffic Density Context */}
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600 px-1">
              <span className="flex items-center gap-1">
                {selectedRoute.rainfall_mm > 0 ? (
                  <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>{selectedRoute.temperature_c}&deg;C &middot; {selectedRoute.weather}</span>
              </span>
              <span className="font-medium text-slate-500">
                Density: <b className="text-slate-800">{selectedRoute.occupancy_pct || 20}%</b>
              </span>
            </div>

            {/* Action Bar */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => {
                  if (mapRef.current && selectedRoute.road_coords) {
                    const bounds = L.latLngBounds(selectedRoute.road_coords);
                    mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
                  }
                }}
                className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition text-center"
              >
                Re-focus Corridor
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Search Match / Result Info Footer ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 px-1">
        <div>
          Showing <b className="text-slate-800">{visibleRoutes.length}</b> corridors matching current criteria.
          {searchQuery && (
            <span className="ml-1 text-blue-600 font-medium">
              Filter: "{searchQuery}"
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Normal Flow (&gt;25 km/h)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Moderate (15-25 km/h)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Heavy/Severe (&lt;15 km/h)
          </span>
        </div>
      </div>
    </div>
  );
}
