import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchRoutes, fetchWaypoints } from '../api.js';

// Pin helper
const createPin = (color, label = '') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="${color}" stroke="#fff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3" fill="#fff"/></svg>`;
  return L.divIcon({
    className: '',
    html: `<div title="${label}" style="transform:translate(-12px,-24px)">${svg}</div>`,
    iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [0, -24],
  });
};

const LEVEL_COLORS = {
  NORMAL: '#22c55e', MODERATE: '#f59e0b', HEAVY: '#f97316', SEVERE: '#ef4444',
};

export default function ExploreMap() {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const layerRef      = useRef(null);

  const [routes, setRoutes]       = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [filter, setFilter]       = useState('ALL');
  const [selected, setSelected]   = useState(null);

  // Fetch data
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [rRes, wRes] = await Promise.all([fetchRoutes(), fetchWaypoints()]);
        if (rRes.success) setRoutes(rRes.data || []);
        if (wRes.success) setWaypoints(wRes.waypoints || []);
      } catch (e) {
        setError('Could not load route data. Make sure the backend server is running.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [23.8103, 90.4125], zoom: 12, zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Render routes on map
  useEffect(() => {
    const map = mapRef.current;
    const lg  = layerRef.current;
    if (!map || !lg) return;
    lg.clearLayers();

    const filtered = routes.filter(r => {
      if (filter === 'ALL') return true;
      return (r.traffic_level || '').toUpperCase() === filter;
    });

    filtered.forEach(route => {
      if (!route.waypoints || route.waypoints.length === 0) return;
      const latlngs = route.waypoints.map(wp => wp.coords);
      const level   = (route.traffic_level || 'NORMAL').toUpperCase();
      const color   = LEVEL_COLORS[level] || '#22c55e';
      const isSel   = selected && selected.route_code === route.route_code;

      const poly = L.polyline(latlngs, {
        color, weight: isSel ? 6 : 3.5, opacity: isSel ? 1 : 0.75,
        lineCap: 'round', lineJoin: 'round',
      });

      poly.bindPopup(`
        <div style="font-size:12px">
          <strong style="color:#2563eb">${route.route_code}</strong>
          <span style="margin-left:6px;font-size:10px;padding:2px 6px;border-radius:4px;
            background:${color}22;color:${color};border:1px solid ${color}44;font-weight:600">
            ${level}
          </span>
          <div style="margin-top:4px;color:#64748b">${route.origin_name} → ${route.dest_name}</div>
          <div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">
            <div>Speed: <b>${route.traffic_speed_kmh} km/h</b></div>
            <div>Delay: <b style="color:#f59e0b">+${route.traffic_delay_min}m</b></div>
            <div>ETA: <b>${route.travel_time_min}m</b></div>
            <div>Dist: <b>${route.road_length_km} km</b></div>
          </div>
        </div>
      `);
      poly.on('click', () => setSelected(route));
      poly.addTo(lg);

      if (isSel) {
        L.marker(latlngs[0], { icon: createPin('#16a34a', route.origin_name) })
          .bindTooltip(route.origin_name, { direction: 'top' }).addTo(lg);
        L.marker(latlngs[latlngs.length - 1], { icon: createPin('#dc2626', route.dest_name) })
          .bindTooltip(route.dest_name, { direction: 'top' }).addTo(lg);
        map.fitBounds(poly.getBounds(), { padding: [40, 40], maxZoom: 14 });
      }
    });

    // Waypoint markers
    waypoints.forEach(wp => {
      L.circleMarker([wp.lat, wp.lon], {
        radius: 4, fillColor: '#3b82f6', color: '#fff', weight: 1, fillOpacity: 0.7,
      }).bindTooltip(wp.name, { direction: 'top' }).addTo(lg);
    });
  }, [routes, waypoints, filter, selected]);

  const resetView = () => {
    if (mapRef.current) mapRef.current.setView([23.8103, 90.4125], 12);
    setSelected(null);
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-slate-500 mt-3">Loading map data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Explore Map</h1>
        <p className="text-sm text-slate-500 mt-1">
          Browse {routes.length} corridors and {waypoints.length} locations across Dhaka.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Filter:</span>
        {['ALL', 'NORMAL', 'MODERATE', 'HEAVY', 'SEVERE'].map(lvl => (
          <button key={lvl} onClick={() => setFilter(lvl)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
              filter === lvl
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
            }`}>
            {lvl}
          </button>
        ))}
        <button onClick={resetView}
          className="ml-auto text-xs text-blue-600 hover:underline">
          Reset View
        </button>
      </div>

      {/* Map */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div ref={containerRef} className="w-full h-[500px] sm:h-[580px]" />
      </div>

      {/* Selected route detail strip */}
      {selected && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                {selected.route_code}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                selected.traffic_level === 'SEVERE' ? 'bg-red-50 text-red-600' :
                selected.traffic_level === 'HEAVY'  ? 'bg-orange-50 text-orange-600' :
                selected.traffic_level === 'MODERATE' ? 'bg-amber-50 text-amber-600' :
                'bg-green-50 text-green-600'
              }`}>
                {selected.traffic_level}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-800 mt-1">
              {selected.origin_name} → {selected.dest_name}
            </p>
          </div>
          <div className="flex items-center gap-5 text-center text-xs">
            <div><p className="text-slate-400">Speed</p><p className="font-bold text-slate-800">{selected.traffic_speed_kmh} km/h</p></div>
            <div><p className="text-slate-400">ETA</p><p className="font-bold text-slate-800">{selected.travel_time_min} min</p></div>
            <div><p className="text-slate-400">Delay</p><p className="font-bold text-amber-600">+{selected.traffic_delay_min} min</p></div>
            <div><p className="text-slate-400">Distance</p><p className="font-bold text-slate-800">{selected.road_length_km} km</p></div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="font-medium">Legend:</span>
        {[['Normal','#22c55e'],['Moderate','#f59e0b'],['Heavy','#f97316'],['Severe','#ef4444']].map(([l,c]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded inline-block" style={{ backgroundColor: c }} />
            {l}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Location
        </span>
      </div>
    </div>
  );
}

