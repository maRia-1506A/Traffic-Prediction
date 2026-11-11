import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { NODE_COORDINATES } from '../utils/dhakaRoutesData.js';

// ── Pin helpers ───────────────────────────────────────────────────────────────
const createPin = (color, label = '') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
    fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    className: '',
    html: `<div title="${label}" style="transform:translate(-14px,-28px)">${svg}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

const createBypassPin = (name = '') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
    fill="#2563eb" stroke="#fff" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="m12 8 4 4-4 4M8 12h8" stroke="#fff" stroke-width="2"/>
  </svg>`;
  return L.divIcon({
    className: '',
    html: `<div title="${name}" style="transform:translate(-12px,-12px)">${svg}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function JourneyRouteMap({
  fromLocation,
  toLocation,
  primaryRoute,
  alternativeRoute,
  showAlternative = false,
  trafficPrediction = 'Low',
}) {
  const containerRef    = useRef(null);
  const mapRef          = useRef(null);
  const layerGroupRef   = useRef(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [23.8103, 90.4125],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    // Free OpenStreetMap light tiles — no API key needed
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update layers when route changes
  useEffect(() => {
    const map = mapRef.current;
    const lg  = layerGroupRef.current;
    if (!map || !lg) return;

    lg.clearLayers();

    const origCoords = primaryRoute?.origin_coords || NODE_COORDINATES[fromLocation] || [23.8069, 90.3687];
    const destCoords = primaryRoute?.dest_coords   || NODE_COORDINATES[toLocation]   || [23.7570, 90.3888];
    const bounds     = [origCoords, destCoords];

    // Origin marker
    L.marker(origCoords, { icon: createPin('#16a34a', fromLocation) })
      .bindPopup(`<b style="color:#15803d">From:</b> ${fromLocation}`)
      .addTo(lg);

    // Destination marker
    L.marker(destCoords, { icon: createPin('#dc2626', toLocation) })
      .bindPopup(`<b style="color:#dc2626">To:</b> ${toLocation}`)
      .addTo(lg);

    // Primary route colour
    const primColor =
      trafficPrediction === 'High'   ? '#ef4444' :
      trafficPrediction === 'Medium' ? '#f59e0b' : '#22c55e';

    // Build primary path through intermediate steps
    const primaryPts = [origCoords];
    if (primaryRoute?.steps?.length > 2) {
      primaryRoute.steps.slice(1, -1).forEach(step => {
        if (NODE_COORDINATES[step]) {
          primaryPts.push(NODE_COORDINATES[step]);
          bounds.push(NODE_COORDINATES[step]);
        }
      });
    }
    primaryPts.push(destCoords);

    L.polyline(primaryPts, {
      color:    primColor,
      weight:   showAlternative ? 4 : 5,
      opacity:  showAlternative ? 0.5 : 0.85,
      lineCap:  'round',
      lineJoin: 'round',
    }).bindPopup(
      `<b>Primary Route</b><br>${primaryRoute?.name || `${fromLocation} → ${toLocation}`}<br>` +
      `ETA: ${primaryRoute?.travel_time_min ?? '—'} min · ${primaryRoute?.speed_kmh ?? '—'} km/h`
    ).addTo(lg);

    // Alternative route
    if (showAlternative && alternativeRoute) {
      const bypassCoords = alternativeRoute.coords || [
        (origCoords[0] + destCoords[0]) / 2 + 0.012,
        (origCoords[1] + destCoords[1]) / 2 + 0.012,
      ];
      bounds.push(bypassCoords);

      L.polyline([origCoords, bypassCoords, destCoords], {
        color:     '#2563eb',
        weight:    5,
        opacity:   0.9,
        dashArray: '10, 8',
        lineCap:   'round',
        lineJoin:  'round',
      }).bindPopup(
        `<b style="color:#2563eb">Alternative Bypass</b><br>${alternativeRoute.name}<br>` +
        `ETA: ${alternativeRoute.travel_time_min} min · Saves ~${alternativeRoute.time_saved_min} min`
      ).addTo(lg);

      L.marker(bypassCoords, { icon: createBypassPin(alternativeRoute.via || 'Bypass') })
        .bindPopup(
          `<b style="color:#2563eb">${alternativeRoute.via || 'Bypass'}</b><br>` +
          `${alternativeRoute.tag || 'Flyover / Expressway'}<br>` +
          `Speed: ${alternativeRoute.bypass_speed_kmh} km/h`
        ).addTo(lg);
    }

    // Fit bounds
    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
    }
  }, [fromLocation, toLocation, primaryRoute, alternativeRoute, showAlternative, trafficPrediction]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-72 sm:h-80" />

      {/* Map legend */}
      <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 shadow space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-4 h-1 rounded inline-block" style={{ backgroundColor:
            trafficPrediction === 'High' ? '#ef4444' :
            trafficPrediction === 'Medium' ? '#f59e0b' : '#22c55e'
          }}/>
          <span>Primary ({trafficPrediction})</span>
        </div>
        {showAlternative && (
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded inline-block bg-blue-600"/>
            <span className="text-blue-700 font-medium">Alternative Bypass</span>
          </div>
        )}
      </div>
    </div>
  );
}
