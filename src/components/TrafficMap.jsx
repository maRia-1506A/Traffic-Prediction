import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Layers,
  MapPin,
  Navigation,
  Compass,
  Maximize2,
  Filter,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

// Marker icon generator using SVG Data URI so we don't depend on external image files
const createCustomPin = (color, text = '') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="#0b0f19" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
  </svg>`;
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="transform: translate(-12px, -24px); cursor: pointer;">${svg}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  });
};

const createBypassPin = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#38bdf8" stroke="#0f172a" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="m12 8 4 4-4 4M8 12h8" stroke="#0f172a" stroke-width="2"></path>
  </svg>`;
  return L.divIcon({
    className: 'bypass-leaflet-marker',
    html: `<div style="transform: translate(-11px, -11px); cursor: pointer;" title="Strategic OSM Bypass">${svg}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11]
  });
};

export default function TrafficMap({ routes = [], selectedRoute, onSelectRoute, onTestBypass }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const bypassLayerGroupRef = useRef(null);

  const [filterLevel, setFilterLevel] = useState('ALL');
  const [showBypasses, setShowBypasses] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Dhaka Center
      const map = L.map(mapContainerRef.current, {
        center: [23.8103, 90.4125],
        zoom: 12,
        minZoom: 10,
        maxZoom: 18,
        zoomControl: true,
      });

      // CartoDB Dark Matter Tiles (high contrast, ultra dark)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      bypassLayerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Render Routes and Corridors
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const filtered = routes.filter(r => {
      if (filterLevel === 'ALL') return true;
      return (r.traffic_level || '').toUpperCase() === filterLevel;
    });

    filtered.forEach(route => {
      if (!route.waypoints || route.waypoints.length === 0) return;

      const latlngs = route.waypoints.map(wp => wp.coords);
      const isSelected = selectedRoute && selectedRoute.route_code === route.route_code;

      let color = '#10b981'; // Green / Normal
      let weight = isSelected ? 6 : 3.5;
      let opacity = isSelected ? 1.0 : 0.8;

      const level = (route.traffic_level || 'NORMAL').toUpperCase();
      if (level === 'SEVERE') {
        color = '#ef4444';
        weight = isSelected ? 7 : 4.5;
      } else if (level === 'HEAVY') {
        color = '#f97316';
        weight = isSelected ? 6 : 4;
      } else if (level === 'MODERATE' || level === 'SLOW') {
        color = '#f59e0b';
      }

      const polyline = L.polyline(latlngs, {
        color,
        weight,
        opacity,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: isSelected ? null : null
      });

      // Popup Content
      const popupHtml = `
        <div style="font-family: inherit; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <strong style="color: #38bdf8; font-size: 13px;">${route.route_code}</strong>
            <span style="font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: ${color}22; color: ${color}; border: 1px solid ${color}44;">
              ${level}
            </span>
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">${route.origin_name} &rarr; ${route.dest_name}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; background: #0b0f19; padding: 6px 8px; border-radius: 6px;">
            <div>Speed: <strong style="color: #f1f5f9;">${route.traffic_speed_kmh} km/h</strong></div>
            <div>Delay: <strong style="color: #fbbf24;">+${route.traffic_delay_min}m</strong></div>
            <div>Travel: <strong style="color: #f1f5f9;">${route.travel_time_min}m</strong></div>
            <div>Dist: <strong style="color: #f1f5f9;">${route.road_length_km} km</strong></div>
          </div>
          <div style="margin-top: 8px; font-size: 10px; color: #64748b;">
            Corridor: ${route.road_type || 'Urban Arterial'}
          </div>
        </div>
      `;

      polyline.bindPopup(popupHtml);

      polyline.on('click', () => {
        if (onSelectRoute) {
          onSelectRoute(route);
        }
      });

      polyline.addTo(layerGroup);

      // If selected, add origin & destination pins and zoom to bounds
      if (isSelected) {
        const startPoint = latlngs[0];
        const endPoint = latlngs[latlngs.length - 1];

        L.marker(startPoint, { icon: createCustomPin('#10b981', 'Start') })
          .bindTooltip(`Origin: ${route.origin_name}`, { permanent: false, direction: 'top' })
          .addTo(layerGroup);

        L.marker(endPoint, { icon: createCustomPin('#ef4444', 'End') })
          .bindTooltip(`Destination: ${route.dest_name}`, { permanent: false, direction: 'top' })
          .addTo(layerGroup);

        mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [40, 40], maxZoom: 14 });
      }
    });
  }, [routes, selectedRoute, filterLevel, onSelectRoute]);

  // Render Strategic Bypass Waypoints
  useEffect(() => {
    if (!mapInstanceRef.current || !bypassLayerGroupRef.current) return;
    const bypassGroup = bypassLayerGroupRef.current;
    bypassGroup.clearLayers();

    if (!showBypasses) return;

    const bypassPoints = [
      { name: "Dhaka Elevated Expressway / Airport", coords: [23.8510, 90.4075], tag: "Expressway", speed: 50 },
      { name: "Mirpur-Airport / ECB Chattar Flyover", coords: [23.8228, 90.3932], tag: "Flyover", speed: 42 },
      { name: "Kalshi Flyover Bypass", coords: [23.8241, 90.3780], tag: "Flyover", speed: 40 },
      { name: "Bijoy Sarani / Link Bypass", coords: [23.7650, 90.3875], tag: "Arterial", speed: 36 },
      { name: "Manik Mia Ave / Asad Gate Bypass", coords: [23.7600, 90.3725], tag: "Arterial", speed: 35 },
      { name: "Hatirjheel Expressway Bypass", coords: [23.7712, 90.4105], tag: "Expressway", speed: 48 },
      { name: "Kuril - Purbachal 300ft Expressway", coords: [23.8197, 90.4190], tag: "Expressway", speed: 52 },
      { name: "Gabtoli - Ring Road Bypass", coords: [23.7845, 90.3475], tag: "Arterial", speed: 38 },
      { name: "Rampura - Badda Link Bypass", coords: [23.7788, 90.4267], tag: "Arterial", speed: 35 },
      { name: "Mayor Hanif Flyover (Jatrabari)", coords: [23.7115, 90.4340], tag: "Flyover", speed: 46 }
    ];

    bypassPoints.forEach(bp => {
      const marker = L.marker(bp.coords, { icon: createBypassPin() });
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 11px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <strong style="color: #38bdf8;">${bp.name}</strong>
          </div>
          <span style="font-size: 9px; padding: 2px 5px; border-radius: 4px; background: #0284c722; color: #38bdf8; border: 1px solid #38bdf844;">
            ${bp.tag} Bypass
          </span>
          <div style="margin-top: 6px; color: #94a3b8;">
            Estimated transit speed: <strong style="color: #34d399;">${bp.speed} km/h</strong>
          </div>
        </div>
      `);
      marker.addTo(bypassGroup);
    });
  }, [showBypasses]);

  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([23.8103, 90.4125], 12);
    }
  };

  return (
    <div className="relative w-full h-[580px] lg:h-[650px] rounded-2xl overflow-hidden border border-slate-800 bg-[#090d16] shadow-2xl">
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Control Overlay (Top Left) */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 bg-[#0c1220]/90 backdrop-blur-md p-2 rounded-xl border border-slate-800/90 shadow-xl">
        <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-300">
          <Filter className="w-3.5 h-3.5 text-cyan-400" />
          <span>Filter:</span>
        </div>
        {['ALL', 'NORMAL', 'MODERATE', 'HEAVY', 'SEVERE'].map(lvl => (
          <button
            key={lvl}
            onClick={() => setFilterLevel(lvl)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
              filterLevel === lvl
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {lvl}
          </button>
        ))}
      </div>

      {/* Map Control Overlay (Top Right) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={() => setShowBypasses(!showBypasses)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border backdrop-blur-md transition shadow-lg ${
            showBypasses
              ? 'bg-cyan-950/80 border-cyan-800 text-cyan-400'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Toggle OSM Flyover & Bypass Hubs"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Bypass Hubs</span>
        </button>

        <button
          onClick={handleResetView}
          className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white backdrop-blur-md shadow-lg transition"
          title="Recenter on Dhaka"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Floating Card when Corridor is Selected */}
      {selectedRoute && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-10 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-lg text-xs font-extrabold bg-cyan-950 text-cyan-400 border border-cyan-800">
                {selectedRoute.route_code}
              </span>
              <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                selectedRoute.traffic_level === 'SEVERE' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                selectedRoute.traffic_level === 'HEAVY' ? 'bg-orange-950 text-orange-400 border border-orange-800' :
                selectedRoute.traffic_level === 'MODERATE' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}>
                {selectedRoute.traffic_level}
              </span>
            </div>
            <button
              onClick={() => onSelectRoute(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          <h4 className="mt-2 text-sm font-semibold text-white leading-snug">
            {selectedRoute.origin_name} &rarr; {selectedRoute.dest_name}
          </h4>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 text-xs">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">Speed</div>
              <div className="font-bold text-cyan-400 mt-0.5">{selectedRoute.traffic_speed_kmh} <span className="text-[10px] font-normal text-slate-500">km/h</span></div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">Delay</div>
              <div className="font-bold text-amber-400 mt-0.5">+{selectedRoute.traffic_delay_min} <span className="text-[10px] font-normal text-slate-500">min</span></div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-medium">ETA</div>
              <div className="font-bold text-slate-100 mt-0.5">{selectedRoute.travel_time_min} <span className="text-[10px] font-normal text-slate-500">min</span></div>
            </div>
          </div>

          {onTestBypass && (
            <button
              onClick={() => onTestBypass(selectedRoute)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-cyan-600/20 transition"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Test Jam Bypass for this Corridor</span>
            </button>
          )}
        </div>
      )}

      {/* Map Legend Overlay (Bottom Left) */}
      <div className="hidden sm:flex absolute bottom-4 left-4 z-10 items-center gap-3 bg-[#0c1220]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 shadow-lg">
        <span className="font-semibold text-slate-400">Flow:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Normal
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Moderate
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Heavy
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span> Severe Jam
        </span>
      </div>
    </div>
  );
}

