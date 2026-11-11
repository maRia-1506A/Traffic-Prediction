import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { NODE_COORDINATES } from '../utils/dhakaRoutesData.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const TRAFFIC_COLORS = {
  High:   '#dc2626', // Red
  Medium: '#eab308', // Yellow
  Low:    '#16a34a', // Green
};

const TRAFFIC_LABELS = {
  High:   'High Congestion (Route-level)',
  Medium: 'Moderate Congestion (Route-level)',
  Low:    'Low Congestion (Route-level)',
};

const PRIMARY_ROUTE_COLOR = '#2563eb'; // Blue

const ALT_STYLES = [
  { color: '#7c3aed', dash: '10, 6',       name: 'Purple', label: 'Alt 1' }, // Alternative 1: Purple
  { color: '#0d9488', dash: '6, 6',        name: 'Teal',   label: 'Alt 2' }, // Alternative 2: Teal
  { color: '#ea580c', dash: '14, 5, 3, 5', name: 'Orange', label: 'Alt 3' }, // Alternative 3: Orange
];

const formatTime12 = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

// ── Icon Factories ────────────────────────────────────────────────────────────
const makePin = (fill, label = '') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path fill="${fill}" stroke="#ffffff" stroke-width="2"
      d="M16 1.5 C8.2 1.5 2 7.7 2 15.5 C2 25.5 16 38.5 16 38.5 C16 38.5 30 25.5 30 15.5 C30 7.7 23.8 1.5 16 1.5Z"/>
    <circle cx="16" cy="15.5" r="5.5" fill="#ffffff"/>
  </svg>`;
  return L.divIcon({
    className: '',
    html: `<div title="${label}" style="transform:translate(-16px,-39px);filter:drop-shadow(0 2px 5px rgba(0,0,0,0.35))">${svg}</div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 39],
    popupAnchor: [0, -40],
  });
};

const makeWarningIcon = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="24" viewBox="0 0 26 24">
    <path d="M13 1.5 L24.5 22 L1.5 22 Z" fill="#f59e0b" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
    <rect x="12" y="8.5" width="2" height="6.5" rx="1" fill="#1e293b"/>
    <circle cx="13" cy="18" r="1.25" fill="#1e293b"/>
  </svg>`;
  return L.divIcon({
    className: '',
    html: `<div style="transform:translate(-13px,-12px);filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">${svg}</div>`,
    iconSize: [26, 24],
    iconAnchor: [13, 12],
    popupAnchor: [0, -14],
  });
};

const makeBypassIcon = (color = '#2563eb', label = '') =>
  L.divIcon({
    className: '',
    html: `<div title="${label}" style="transform:translate(-11px,-11px)">
      <div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid #fff;
        display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;
        box-shadow:0 2px 6px rgba(0,0,0,0.28);">↗</div>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });

const popupShell = (html) =>
  `<div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:1.55;min-width:190px;color:#1e293b">${html}</div>`;

const badgeHtml = (level) => {
  const col = TRAFFIC_COLORS[level] || TRAFFIC_COLORS.Low;
  return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;background:${col};color:#fff;font-size:11px;font-weight:700">${level} Traffic</span>`;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function JourneyRouteMap({
  fromLocation,
  toLocation,
  primaryRoute,
  alternativeRoutes = [],
  alternativeRoute = null,
  showAlternative = false,
  selectedAltIndex = 0, // 'primary' | 0 | 1 | 2
  onSelectAlternative,
  onToggleAlternative,
  trafficPrediction = 'Low',
  selectedDate = '',
  selectedTime = '',
}) {
  const containerRef    = useRef(null);
  const mapRef          = useRef(null);
  const corridorLayerRef = useRef(null);
  const altLayerRef     = useRef(null);
  const routeLayerRef   = useRef(null);

  const [altMenuOpen, setAltMenuOpen]       = useState(false);
  const [showCorridors, setShowCorridors]   = useState(true);
  const [corridorsData, setCorridorsData]   = useState(null);

  // Resolve available 2-3 alternatives cleanly
  const resolvedAlts = alternativeRoutes?.length
    ? alternativeRoutes.slice(0, 3)
    : alternativeRoute
    ? [alternativeRoute]
    : [];

  // ── 1. Initialize Leaflet Map Once ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [23.775, 90.395],
      zoom: 13,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });

    // Bottom-right zoom control matching reference screenshot
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Detailed OpenStreetMap street & label tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Dedicated panes so selected routes always sit cleanly above unselected routes
    map.createPane('corridorPane').style.zIndex = 410;
    map.createPane('unselectedRoutePane').style.zIndex = 420;
    map.createPane('selectedRoutePane').style.zIndex = 440;

    corridorLayerRef.current = L.layerGroup().addTo(map);
    altLayerRef.current      = L.layerGroup().addTo(map);
    routeLayerRef.current    = L.layerGroup().addTo(map);
    mapRef.current           = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── 2. Fetch verified 50 official monitored corridors once ──────────────────
  useEffect(() => {
    let active = true;
    fetch('/api/corridors/osm-overlay')
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (active && json?.success && Array.isArray(json.corridors)) {
          setCorridorsData(json.corridors);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // ── 3. Render verified monitored corridors background layer ─────────────────
  useEffect(() => {
    const cl = corridorLayerRef.current;
    if (!cl) return;
    cl.clearLayers();

    if (!showCorridors || !corridorsData?.length) return;

    corridorsData.forEach(c => {
      if (!c.coordinates || c.coordinates.length < 2) return;
      const color = TRAFFIC_COLORS[c.traffic_level] || TRAFFIC_COLORS.Low;

      // Subtle white road casing so verified traffic corridors look crisp
      L.polyline(c.coordinates, {
        pane: 'corridorPane',
        color: '#ffffff',
        weight: 4.5,
        opacity: 0.55,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(cl);

      L.polyline(c.coordinates, {
        pane: 'corridorPane',
        color,
        weight: 2.8,
        opacity: c.traffic_level === 'High' ? 0.72 : 0.55,
        lineCap: 'round',
        lineJoin: 'round',
      })
        .bindPopup(
          popupShell(`
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${c.route_id}</div>
            ${badgeHtml(c.traffic_level)}
            <div style="margin-top:6px;color:#475569">
              <div>Source: <b>Monitored Corridor Telemetry</b></div>
              <div>Observed Level: <b>${c.raw_level}</b></div>
              <div>Speed: <b>${c.speed_kmh} km/h</b>${c.delay_min > 0 ? ` · Delay: <b>+${c.delay_min} min</b>` : ''}</div>
              <div style="font-size:11px;color:#64748b;margin-top:3px">Updated: ${c.last_updated}</div>
            </div>
          `)
        )
        .addTo(cl);
    });
  }, [corridorsData, showCorridors]);

  // ── 4. Render Alternative Routes (when enabled) ─────────────────────────────
  useEffect(() => {
    const al = altLayerRef.current;
    const map = mapRef.current;
    if (!al || !map) return;
    al.clearLayers();

    if (!showAlternative || resolvedAlts.length === 0) return;

    const origCoords = primaryRoute?.origin_coords || NODE_COORDINATES[fromLocation] || [23.8069, 90.3687];
    const destCoords = primaryRoute?.dest_coords   || NODE_COORDINATES[toLocation]   || [23.7570, 90.3888];
    let selectedAltBounds = null;

    // Draw non-selected routes first, selected last so it stays on top
    const orderedIndices = resolvedAlts
      .map((_, i) => i)
      .sort((a, b) => (a === selectedAltIndex ? 1 : b === selectedAltIndex ? -1 : 0));

    orderedIndices.forEach((idx) => {
      const alt = resolvedAlts[idx];
      const st = ALT_STYLES[idx % ALT_STYLES.length];
      const isSelected = selectedAltIndex === idx;
      const paneName = isSelected ? 'selectedRoutePane' : 'unselectedRoutePane';
      const pts = alt.road_coords?.length >= 2
        ? alt.road_coords
        : alt.coords
        ? [origCoords, alt.coords, destCoords]
        : [origCoords, destCoords];

      if (isSelected) {
        selectedAltBounds = [origCoords, destCoords, ...pts];
        L.polyline(pts, {
          pane: paneName,
          color: 'rgba(15, 23, 42, 0.22)',
          weight: 14,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(al);
      }

      // White casing for every alternative route so Purple / Teal / Orange stay clearly visible
      L.polyline(pts, {
        pane: paneName,
        color: '#ffffff',
        weight: isSelected ? 11 : 7,
        opacity: isSelected ? 0.96 : 0.75,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(al);

      const altPoly = L.polyline(pts, {
        pane: paneName,
        color: st.color,
        weight: isSelected ? 7 : 4.5,
        opacity: isSelected ? 1.0 : 0.72,
        dashArray: isSelected ? null : st.dash,
        lineCap: 'round',
        lineJoin: 'round',
      });

      const altLevel = alt.traffic_prediction || 'Low';
      const timeDiffLabel = alt.time_saved_min > 0
        ? `<div style="color:#16a34a;font-weight:600">Saves ~${alt.time_saved_min} min vs Primary</div>`
        : alt.time_saved_min < 0
        ? `<div style="color:#d97706;font-weight:600">+${Math.abs(alt.time_saved_min)} min slower than Primary</div>`
        : '';

      altPoly.bindPopup(
        popupShell(`
          <div style="font-weight:700;font-size:13px;color:${st.color};margin-bottom:4px">
            ${st.label} (${st.name}): ${alt.via || alt.name}
          </div>
          ${badgeHtml(altLevel)}
          <div style="margin-top:6px;color:#475569">
            <div>${alt.is_estimate !== false ? 'Est. Time' : 'Travel Time'}: <b>${alt.travel_time_min} min</b> · ${alt.distance_km} km</div>
            <div>Est. Speed: <b>${alt.bypass_speed_kmh} km/h</b>${alt.traffic_delay_min > 0 ? ` · Delay: <b>+${alt.traffic_delay_min} min</b>` : ''}</div>
            ${timeDiffLabel}
            ${alt.tag ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${alt.tag}</div>` : ''}
          </div>
        `)
      );

      altPoly.on('mouseover', () => altPoly.setStyle({ weight: isSelected ? 8.5 : 6, opacity: 1 }));
      altPoly.on('mouseout',  () => altPoly.setStyle({ weight: isSelected ? 7 : 4.5, opacity: isSelected ? 1.0 : 0.72 }));
      altPoly.on('click', () => {
        if (onSelectAlternative) onSelectAlternative(idx);
      });

      altPoly.addTo(al);

      const midPt = alt.coords || pts[Math.floor(pts.length / 2)];
      if (isSelected && midPt) {
        L.marker(midPt, { icon: makeBypassIcon(st.color, alt.via || alt.name), zIndexOffset: 500 })
          .bindPopup(
            popupShell(`
              <div style="font-weight:700;font-size:13px;color:${st.color}">${st.label}: ${alt.via || alt.name}</div>
              <div style="color:#475569;margin-top:3px">Est. Time: <b>${alt.travel_time_min} min</b> · ${altLevel} Traffic</div>
            `)
          )
          .addTo(al);
      }
    });

    // Automatically adjust map bounds so the selected alternative route is fully visible
    if (selectedAltBounds && selectedAltBounds.length > 1) {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(selectedAltBounds), { padding: [55, 55], maxZoom: 14.5 });
    }
  }, [showAlternative, resolvedAlts, selectedAltIndex, primaryRoute, fromLocation, toLocation, onSelectAlternative]);

  // ── 5. Render Primary Route Segments, Markers, Labels, & Hotspots ───────────
  useEffect(() => {
    const map = mapRef.current;
    const rl  = routeLayerRef.current;
    if (!map || !rl) return;

    rl.clearLayers();
    if (!fromLocation || !toLocation) return;

    const origCoords = primaryRoute?.origin_coords || NODE_COORDINATES[fromLocation] || [23.8069, 90.3687];
    const destCoords = primaryRoute?.dest_coords   || NODE_COORDINATES[toLocation]   || [23.7570, 90.3888];
    const bounds     = [origCoords, destCoords];

    const isAltActive = showAlternative && typeof selectedAltIndex === 'number' && selectedAltIndex >= 0 && selectedAltIndex < resolvedAlts.length;
    const isPrimarySelected = !isAltActive;
    const formattedTime = formatTime12(selectedTime);

    // Prepare road segments along OSM street geometry
    const segments = primaryRoute?.road_segments?.length
      ? primaryRoute.road_segments
      : [{
          id: 'primary-0',
          name: primaryRoute?.matchedCorridor || `${fromLocation} → ${toLocation}`,
          highway: 'primary',
          distance_km: primaryRoute?.distance_km,
          coordinates: primaryRoute?.road_coords?.length >= 2
            ? primaryRoute.road_coords
            : [origCoords, destCoords],
        }];

    // Collect bounds across all route points
    segments.forEach(seg => seg.coordinates?.forEach(pt => bounds.push(pt)));

    // 1. Subtle dark shadow & crisp white halo under the primary route
    const fullCoords = primaryRoute?.road_coords?.length >= 2
      ? primaryRoute.road_coords
      : segments.flatMap(s => s.coordinates || []);

    const primaryPane = isPrimarySelected ? 'selectedRoutePane' : 'unselectedRoutePane';

    if (fullCoords.length >= 2) {
      if (isPrimarySelected) {
        L.polyline(fullCoords, {
          pane: primaryPane,
          color: 'rgba(15, 23, 42, 0.22)',
          weight: 14,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(rl);
      }

      L.polyline(fullCoords, {
        pane: primaryPane,
        color: '#ffffff',
        weight: isPrimarySelected ? 11 : 7,
        opacity: isPrimarySelected ? 0.96 : 0.75,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(rl);
    }

    // 2. Render each named OSM road segment interactively in Primary Blue (#2563eb)
    segments.forEach((seg) => {
      if (!seg.coordinates || seg.coordinates.length < 2) return;

      const poly = L.polyline(seg.coordinates, {
        pane: primaryPane,
        color: PRIMARY_ROUTE_COLOR,
        weight: isPrimarySelected ? 7 : 4.5,
        opacity: isPrimarySelected ? 1.0 : 0.68,
        dashArray: isPrimarySelected ? null : '8, 6',
        lineCap: 'round',
        lineJoin: 'round',
      });

      poly.on('mouseover', () => poly.setStyle({ weight: isPrimarySelected ? 8.5 : 6, opacity: 1 }));
      poly.on('mouseout',  () => poly.setStyle({ weight: isPrimarySelected ? 7 : 4.5, opacity: isPrimarySelected ? 1.0 : 0.68 }));
      poly.on('click', () => {
        if (showAlternative && onSelectAlternative) onSelectAlternative('primary');
      });

      const obsHtml = seg.observed_telemetry
        ? `<div style="margin-top:5px;padding-top:5px;border-top:1px solid #f1f5f9;font-size:11px">
             <div>CSV Segment Observation (${seg.way_id}):</div>
             <div><b style="color:${TRAFFIC_COLORS[seg.observed_telemetry.level]}">${seg.observed_telemetry.level}</b> (${seg.observed_telemetry.speed_kmh} km/h · ${seg.observed_telemetry.timestamp})</div>
           </div>`
        : `<div style="margin-top:6px;padding-top:5px;border-top:1px solid #f1f5f9;font-size:10.5px;color:#64748b">
             Route-level estimate (${TRAFFIC_LABELS[trafficPrediction] || trafficPrediction})
           </div>`;

      poly.bindPopup(
        popupShell(`
          <div style="font-weight:700;font-size:13.5px;color:${PRIMARY_ROUTE_COLOR};margin-bottom:4px">
            Primary Route · ${seg.name}
          </div>
          ${badgeHtml(trafficPrediction)}
          <div style="margin-top:6px;color:#475569">
            <div>Journey: <b>${fromLocation} → ${toLocation}</b></div>
            ${seg.distance_km ? `<div>Segment length: <b>${seg.distance_km} km</b></div>` : ''}
            ${selectedDate ? `<div>Date: <b>${selectedDate}</b></div>` : ''}
            <div>Time: <b>${formattedTime}</b></div>
          </div>
          ${obsHtml}
        `),
        { maxWidth: 265 }
      );

      poly.addTo(rl);
    });

    // 3. Intermediate intersection dots + alternating clean pill labels
    const checkpoints = primaryRoute?.checkpoints || [];
    checkpoints.forEach((cp, idx) => {
      if (!cp.coords) return;
      const side = idx % 2 === 0 ? 'left' : 'right';
      const offsetX = side === 'left' ? -8 : 8;
      L.circleMarker(cp.coords, {
        radius: 5,
        fillColor: '#64748b',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
      })
        .bindTooltip(cp.name, {
          permanent: true,
          direction: side,
          offset: [offsetX, 0],
          className: 'map-label-pill',
        })
        .bindPopup(
          popupShell(`
            <div style="font-weight:700;font-size:13px">${cp.name}</div>
            <div style="color:#64748b;font-size:11px;margin-top:2px">Intermediate waypoint along ${fromLocation} → ${toLocation}</div>
          `)
        )
        .addTo(rl);
    });

    // 4. Congestion Hotspot Warning Marker (with road name for High/Medium congestion)
    if ((trafficPrediction === 'High' || trafficPrediction === 'Medium') && fullCoords.length >= 2) {
      const delayStr = primaryRoute?.traffic_delay_min > 0
        ? `+${Math.round(primaryRoute.traffic_delay_min)}m`
        : '';
      const pt = fullCoords[Math.floor(fullCoords.length * 0.5)];
      let nearestSegName = `${fromLocation} → ${toLocation}`;
      let bestD = Infinity;
      segments.forEach(s => {
        const mid = s.coordinates?.[Math.floor(s.coordinates.length / 2)];
        if (!mid) return;
        const d = Math.hypot(mid[0] - pt[0], mid[1] - pt[1]);
        if (d < bestD) { bestD = d; nearestSegName = s.name; }
      });

      const marker = L.marker(pt, { icon: makeWarningIcon(), zIndexOffset: 650 });
      const shortRoad = nearestSegName.length > 22 ? `${nearestSegName.slice(0, 20)}…` : nearestSegName;

      // Only show permanent badge pill if well away from origin & destination pins
      const distOrigKm = Math.hypot((pt[0] - origCoords[0]) * 111, (pt[1] - origCoords[1]) * 102);
      const distDestKm = Math.hypot((pt[0] - destCoords[0]) * 111, (pt[1] - destCoords[1]) * 102);
      if (trafficPrediction === 'High' && distOrigKm >= 1.1 && distDestKm >= 1.1) {
        marker.bindTooltip(
          `⚠ ${shortRoad}${delayStr ? ` (${delayStr})` : ''}`,
          {
            permanent: true,
            direction: 'right',
            offset: [12, 0],
            className: 'map-hotspot-pill',
          }
        );
      }

      const alertColor = trafficPrediction === 'High' ? '#dc2626' : '#d97706';
      const alertTitle = trafficPrediction === 'High' ? '⚠ Heavy Congestion Alert' : '⚠ Moderate Congestion';
      marker.bindPopup(
        popupShell(`
          <div style="color:${alertColor};font-weight:700;font-size:13px;margin-bottom:4px">
            ${alertTitle}
          </div>
          <div style="color:#475569">
            <div>Road: <b>${nearestSegName}</b></div>
            <div>Predicted Level: <b style="color:${alertColor}">${trafficPrediction} Traffic</b></div>
            ${selectedDate ? `<div>Date: <b>${selectedDate}</b></div>` : ''}
            <div>Time: <b>${formattedTime}</b></div>
            ${primaryRoute?.traffic_delay_min > 0
              ? `<div>Est. Route Delay: <b style="color:${alertColor}">+${primaryRoute.traffic_delay_min} min</b></div>`
              : ''}
            <div style="margin-top:4px;font-size:10.5px;color:#64748b">Route-level congestion estimate</div>
          </div>
        `),
        { maxWidth: 250 }
      );

      marker.addTo(rl);
    }

    // 5. Origin Marker (Green pin + label positioned clear of route)
    const origIsSouth = origCoords[0] <= destCoords[0];
    L.marker(origCoords, { icon: makePin('#16a34a', fromLocation), zIndexOffset: 1000 })
      .bindTooltip(
        `<span style="color:#15803d">${fromLocation}</span> <span style="color:#64748b;font-weight:500">(Start)</span>`,
        {
          permanent: true,
          direction: origIsSouth ? 'bottom' : 'top',
          offset: origIsSouth ? [0, 6] : [0, -40],
          className: 'map-label-pill',
        }
      )
      .bindPopup(
        popupShell(`
          <div style="color:#15803d;font-weight:700;font-size:13px">Origin / Starting Point</div>
          <div style="font-size:14px;font-weight:600;margin-top:2px">${fromLocation}</div>
        `)
      )
      .addTo(rl);

    // 6. Destination Marker (Red pin + label positioned clear of route)
    L.marker(destCoords, { icon: makePin('#dc2626', toLocation), zIndexOffset: 1000 })
      .bindTooltip(
        `<span style="color:#dc2626">${toLocation} (End Point)</span>`,
        {
          permanent: true,
          direction: origIsSouth ? 'top' : 'bottom',
          offset: origIsSouth ? [0, -40] : [0, 6],
          className: 'map-label-pill',
        }
      )
      .bindPopup(
        popupShell(`
          <div style="color:#dc2626;font-weight:700;font-size:13px">Destination / End Point</div>
          <div style="font-size:14px;font-weight:600;margin-top:2px">${toLocation}</div>
        `)
      )
      .addTo(rl);

    // 7. Auto-center & fit tightly to the journey route when Primary is selected
    if (isPrimarySelected && bounds.length > 1) {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(bounds), { padding: [55, 55], maxZoom: 14.5 });
    }
  }, [fromLocation, toLocation, primaryRoute, showAlternative, selectedAltIndex, resolvedAlts.length, onSelectAlternative, trafficPrediction, selectedDate, selectedTime]);

  // Ensure Leaflet adjusts size cleanly on resize
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [fromLocation, toLocation, primaryRoute]);

  const isAltSelected = showAlternative && typeof selectedAltIndex === 'number' && selectedAltIndex >= 0 && selectedAltIndex < resolvedAlts.length;
  const activeAlt = isAltSelected ? resolvedAlts[selectedAltIndex] : null;
  const activeAltStyle = isAltSelected ? ALT_STYLES[selectedAltIndex % ALT_STYLES.length] : null;

  const eta         = activeAlt ? activeAlt.travel_time_min : primaryRoute?.travel_time_min;
  const dist        = activeAlt ? activeAlt.distance_km : primaryRoute?.distance_km;
  const delay       = activeAlt ? activeAlt.traffic_delay_min : primaryRoute?.traffic_delay_min;
  const isEstimate  = activeAlt ? activeAlt.is_estimate !== false : primaryRoute?.is_estimate !== false;
  const activeLevel = activeAlt ? (activeAlt.traffic_prediction || 'Low') : trafficPrediction;
  const activeColor = activeAltStyle ? activeAltStyle.color : PRIMARY_ROUTE_COLOR;
  const activeLabel = activeAlt
    ? `${activeAltStyle.label}: ${activeAlt.via || activeAlt.name}`
    : 'Primary Route';

  return (
    <div className="relative w-full h-[520px] sm:h-[620px] lg:h-[670px] bg-slate-100 clean-traffic-map">

      {/* ── Map Canvas ──────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* ── Top-Left Compact Floating Route Info Panel ──────────────────────── */}
      {fromLocation && toLocation && (
        <div className="absolute top-3 left-3 z-[500] bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg w-[255px] sm:w-[280px] overflow-hidden">
          <div className="px-4 py-3 space-y-1.5">
            {/* Active route badge */}
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: activeColor }} />
                <span className="truncate">{activeLabel}</span>
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: TRAFFIC_COLORS[activeLevel] || TRAFFIC_COLORS.Low }}
              >
                {activeLevel}
              </span>
            </div>

            <div className="text-sm font-bold text-slate-800 leading-snug">
              {isEstimate ? 'Est. Time' : 'Travel Time'}: {eta ?? '—'} min{' '}
              <span className="font-semibold text-slate-500">({dist ?? '—'} km)</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              {delay > 0 ? (
                <span className="font-semibold text-red-600">
                  +{delay} min est. delay
                </span>
              ) : (
                <span className="font-semibold text-green-600">
                  No significant delay
                </span>
              )}

              {activeAlt && activeAlt.time_saved_min !== undefined && (
                <span className={`font-semibold ${
                  activeAlt.time_saved_min > 0
                    ? 'text-green-600'
                    : activeAlt.time_saved_min < 0
                    ? 'text-amber-600'
                    : 'text-slate-500'
                }`}>
                  · {activeAlt.time_saved_min > 0
                    ? `Saves ${activeAlt.time_saved_min}m`
                    : activeAlt.time_saved_min < 0
                    ? `+${Math.abs(activeAlt.time_saved_min)}m slower`
                    : 'Same ETA'}
                </span>
              )}
            </div>

            {/* Alternative Routes dropdown button */}
            {resolvedAlts.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const nextOpen = !altMenuOpen;
                    setAltMenuOpen(nextOpen);
                    if (nextOpen && !showAlternative && onToggleAlternative) {
                      onToggleAlternative(true);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    showAlternative
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-50 text-blue-600 border-slate-200 hover:bg-blue-50'
                  }`}
                >
                  <span>Alternative Routes ({resolvedAlts.length})</span>
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${altMenuOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Expandable Route & Alternative Selector List */}
          {altMenuOpen && resolvedAlts.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-2 space-y-1.5 max-h-64 overflow-y-auto">
              {/* Primary route option */}
              <button
                type="button"
                onClick={() => {
                  if (onSelectAlternative) onSelectAlternative('primary');
                }}
                className={`w-full text-left p-2 rounded-xl border transition text-xs ${
                  !isAltSelected
                    ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-200'
                    : 'bg-white/70 border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-800 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PRIMARY_ROUTE_COLOR }} />
                    <span className="truncate">Primary Route (Blue)</span>
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: TRAFFIC_COLORS[trafficPrediction] || TRAFFIC_COLORS.Low }}
                  >
                    {trafficPrediction}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>{primaryRoute?.travel_time_min ?? '—'} min · {primaryRoute?.distance_km ?? '—'} km</span>
                  {primaryRoute?.traffic_delay_min > 0 && (
                    <span className="text-red-600 font-medium">+{primaryRoute.traffic_delay_min}m delay</span>
                  )}
                </div>
              </button>

              {/* Alternative routes 1..3 */}
              {resolvedAlts.map((alt, idx) => {
                const st = ALT_STYLES[idx % ALT_STYLES.length];
                const isSel = showAlternative && selectedAltIndex === idx;
                const altLvl = alt.traffic_prediction || 'Low';
                return (
                  <button
                    key={alt.id || idx}
                    type="button"
                    onClick={() => {
                      if (onToggleAlternative && !showAlternative) onToggleAlternative(true);
                      if (onSelectAlternative) onSelectAlternative(idx);
                    }}
                    className={`w-full text-left p-2 rounded-xl border transition text-xs ${
                      isSel
                        ? 'bg-white shadow-sm ring-1'
                        : 'bg-white/70 border-slate-200 hover:border-slate-300'
                    }`}
                    style={isSel ? { borderColor: st.color, '--tw-ring-color': st.color } : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-800 truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                        <span className="truncate">{st.label}: {alt.via || alt.name}</span>
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: TRAFFIC_COLORS[altLvl] || TRAFFIC_COLORS.Low }}
                      >
                        {altLvl}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span>{alt.travel_time_min} min · {alt.distance_km} km</span>
                      {alt.time_saved_min > 0 ? (
                        <span className="text-green-600 font-semibold">-{alt.time_saved_min}m saved</span>
                      ) : alt.time_saved_min < 0 ? (
                        <span className="text-amber-600 font-semibold">+{Math.abs(alt.time_saved_min)}m slower</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}

              {showAlternative && onToggleAlternative && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleAlternative(false);
                    setAltMenuOpen(false);
                  }}
                  className="w-full text-center py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
                >
                  Hide alternatives (Primary only)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Top-Right Monitored Network Toggle ──────────────────────────────── */}
      <div className="absolute top-3 right-3 z-[500]">
        <button
          type="button"
          onClick={() => setShowCorridors(v => !v)}
          title="Toggle verified telemetry overlay for Dhaka's 50 official monitored corridors"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border shadow-sm backdrop-blur-md transition ${
            showCorridors
              ? 'bg-white/95 text-slate-700 border-slate-200'
              : 'bg-white/80 text-slate-400 border-slate-200/70'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${showCorridors ? 'bg-green-500' : 'bg-slate-300'}`} />
          <span>Monitored Corridors</span>
        </button>
      </div>

      {/* ── Bottom-Left Compact Traffic & Route Legend ──────────────────────── */}
      <div className="absolute bottom-4 left-3 z-[500] bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-md px-3.5 py-2.5">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
          Traffic Level
        </p>
        <div className="space-y-1">
          {[
            { label: 'Low',       color: TRAFFIC_COLORS.Low },
            { label: 'Moderate',  color: TRAFFIC_COLORS.Medium },
            { label: 'High',      color: TRAFFIC_COLORS.High },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs font-medium text-slate-700">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Routes
          </p>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1 rounded shrink-0" style={{ backgroundColor: PRIMARY_ROUTE_COLOR }} />
            <span className="text-[11px] font-medium text-slate-700">Primary</span>
          </div>
          {showAlternative && resolvedAlts.map((alt, idx) => {
            const st = ALT_STYLES[idx % ALT_STYLES.length];
            return (
              <div key={alt.id || idx} className="flex items-center gap-2">
                <span className="w-3.5 h-1 rounded shrink-0" style={{ backgroundColor: st.color }} />
                <span className="text-[11px] font-medium text-slate-600">{st.label} ({st.name})</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
