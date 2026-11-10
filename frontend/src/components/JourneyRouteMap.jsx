import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { NODE_COORDINATES } from '../utils/dhakaRoutesData.js';

const createCustomPin = (color, text = '') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="${color}" stroke="#0b0f19" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3.5" fill="#ffffff"></circle>
  </svg>`;
  return L.divIcon({
    className: 'custom-route-marker',
    html: `<div style="transform: translate(-13px, -26px); cursor: pointer;" title="${text}">${svg}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26]
  });
};

const createBypassPin = (name = '') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="#38bdf8" stroke="#0f172a" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="m12 8 4 4-4 4M8 12h8" stroke="#0f172a" stroke-width="2.5"></path>
  </svg>`;
  return L.divIcon({
    className: 'bypass-route-marker',
    html: `<div style="transform: translate(-13px, -13px); cursor: pointer;" title="${name}">${svg}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13]
  });
};

export default function JourneyRouteMap({
  fromLocation,
  toLocation,
  primaryRoute,
  alternativeRoute,
  showAlternative = false,
  trafficPrediction = 'High'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayerGroupRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [23.8103, 90.4125],
        zoom: 12,
        zoomControl: true,
        attributionControl: false
      });

      // Free Dark Map Layer (Esri Dark Gray Base + Reference Labels - 100% Free, No Key Required)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: '&copy; Esri & OpenStreetMap contributors'
      }).addTo(map);

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        opacity: 0.85
      }).addTo(map);

      routeLayerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Route Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = routeLayerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // Resolve Origin and Destination Coordinates
    const origCoords =
      primaryRoute?.origin_coords ||
      NODE_COORDINATES[fromLocation] || [23.8069, 90.3687];
    const destCoords =
      primaryRoute?.dest_coords ||
      NODE_COORDINATES[toLocation] || [23.7570, 90.3888];

    const boundsPoints = [origCoords, destCoords];

    // 1. Origin Marker
    const origMarker = L.marker(origCoords, {
      icon: createCustomPin('#10b981', fromLocation)
    }).bindPopup(
      `<div style="color: #0f172a; font-size: 12px; font-weight: bold;">
        <span style="color: #059669;">From:</span> ${fromLocation}
      </div>`
    );
    layerGroup.addLayer(origMarker);

    // 2. Destination Marker
    const destMarker = L.marker(destCoords, {
      icon: createCustomPin('#f43f5e', toLocation)
    }).bindPopup(
      `<div style="color: #0f172a; font-size: 12px; font-weight: bold;">
        <span style="color: #e11d48;">To:</span> ${toLocation}
      </div>`
    );
    layerGroup.addLayer(destMarker);

    // 3. Primary Route Polyline
    // Collect coordinates along the path if intermediate nodes exist
    const primaryPoints = [origCoords];
    if (primaryRoute?.steps && primaryRoute.steps.length > 2) {
      primaryRoute.steps.slice(1, -1).forEach(step => {
        if (NODE_COORDINATES[step]) {
          primaryPoints.push(NODE_COORDINATES[step]);
          boundsPoints.push(NODE_COORDINATES[step]);
        }
      });
    }
    primaryPoints.push(destCoords);

    let primaryColor = '#10b981'; // Green for Low
    if (trafficPrediction === 'High') primaryColor = '#f43f5e'; // Red for High
    else if (trafficPrediction === 'Medium') primaryColor = '#f59e0b'; // Amber for Medium

    const primaryPolyline = L.polyline(primaryPoints, {
      color: primaryColor,
      weight: 5,
      opacity: showAlternative ? 0.45 : 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).bindPopup(
      `<div style="color: #0f172a; font-size: 12px;">
        <strong>Primary Route:</strong> ${primaryRoute?.name || 'Primary Corridor'}<br/>
        <span>ETA: ${primaryRoute?.travel_time_min || 0} mins</span> • 
        <span>Speed: ${primaryRoute?.speed_kmh || 0} km/h</span><br/>
        <span style="color: ${primaryColor}; font-weight: bold;">Traffic: ${trafficPrediction}</span>
      </div>`
    );
    layerGroup.addLayer(primaryPolyline);

    // 4. Alternative Route Polyline & Bypass Pin (when user clicked Yes)
    if (showAlternative && alternativeRoute) {
      const bypassCoords = alternativeRoute.coords || [
        (origCoords[0] + destCoords[0]) / 2 + 0.015,
        (origCoords[1] + destCoords[1]) / 2 + 0.015
      ];
      boundsPoints.push(bypassCoords);

      const altPoints = [origCoords, bypassCoords, destCoords];

      const altPolyline = L.polyline(altPoints, {
        color: '#06b6d4', // Cyan
        weight: 6,
        opacity: 0.95,
        dashArray: '8, 8',
        lineCap: 'round',
        lineJoin: 'round'
      }).bindPopup(
        `<div style="color: #0f172a; font-size: 12px;">
          <strong style="color: #0891b2;">Alternative Bypass:</strong> ${alternativeRoute.name}<br/>
          <span>Bypass ETA: <strong>${alternativeRoute.travel_time_min} mins</strong></span><br/>
          <span style="color: #059669; font-weight: bold;">⚡ Saves ~${alternativeRoute.time_saved_min} minutes!</span>
        </div>`
      );
      layerGroup.addLayer(altPolyline);

      // Bypass Strategic Waypoint Marker
      const bypassMarker = L.marker(bypassCoords, {
        icon: createBypassPin(alternativeRoute.via || 'Bypass Corridor')
      }).bindPopup(
        `<div style="color: #0f172a; font-size: 12px;">
          <strong style="color: #0284c7;">${alternativeRoute.via || 'Bypass Waypoint'}</strong><br/>
          <span>${alternativeRoute.tag || 'Flyover / Expressway Bypass'}</span><br/>
          <span>Speed: ${alternativeRoute.bypass_speed_kmh} km/h</span>
        </div>`
      );
      layerGroup.addLayer(bypassMarker);
    }

    // Auto fit map bounds
    if (boundsPoints.length > 0) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [fromLocation, toLocation, primaryRoute, alternativeRoute, showAlternative, trafficPrediction]);

  return (
    <div className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full bg-[#0b0f19]" />

      {/* Floating Map Legend */}
      <div className="absolute bottom-3 left-3 z-[400] bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-300 backdrop-blur-md shadow-lg space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-1 rounded-full inline-block"
            style={{
              backgroundColor:
                trafficPrediction === 'High'
                  ? '#f43f5e'
                  : trafficPrediction === 'Medium'
                  ? '#f59e0b'
                  : '#10b981'
            }}
          ></span>
          <span>Primary Route ({trafficPrediction})</span>
        </div>
        {showAlternative && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 rounded-full bg-cyan-400 inline-block border-b border-dashed"></span>
            <span className="text-cyan-300 font-semibold">Alternative Bypass</span>
          </div>
        )}
      </div>
    </div>
  );
}

