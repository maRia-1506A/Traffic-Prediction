import React, { useState } from 'react';

// ── Mode config: color, icon SVG, label ──────────────────────────────────────
const MODE_CONFIG = {
  bus: {
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    lineColor: '#2563eb',
    lineDash: 'none',
    icon: (c = '#fff') => (
      <svg viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="24">
        <rect x="1" y="2" width="34" height="17" rx="4" fill={c === '#fff' ? '#2563eb' : c} />
        <rect x="3" y="5" width="8" height="6" rx="1" fill="white" opacity="0.9" />
        <rect x="13" y="5" width="8" height="6" rx="1" fill="white" opacity="0.9" />
        <rect x="23" y="5" width="8" height="6" rx="1" fill="white" opacity="0.9" />
        <rect x="1" y="15" width="34" height="4" rx="0" fill="rgba(0,0,0,0.15)" />
        <circle cx="8" cy="21" r="3" fill="#1e3a8a" />
        <circle cx="8" cy="21" r="1.5" fill="white" />
        <circle cx="28" cy="21" r="3" fill="#1e3a8a" />
        <circle cx="28" cy="21" r="1.5" fill="white" />
      </svg>
    ),
    label: 'Bus',
  },
  shared_bus: {
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fcd34d',
    lineColor: '#d97706',
    lineDash: '6,4',
    icon: () => (
      <svg viewBox="0 0 36 26" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="26">
        <rect x="1" y="3" width="30" height="14" rx="3" fill="#d97706" />
        <rect x="3" y="6" width="6" height="5" rx="1" fill="white" opacity="0.9" />
        <rect x="11" y="6" width="6" height="5" rx="1" fill="white" opacity="0.9" />
        <rect x="19" y="6" width="6" height="5" rx="1" fill="white" opacity="0.9" />
        <rect x="1" y="13" width="30" height="4" rx="0" fill="rgba(0,0,0,0.15)" />
        <circle cx="8" cy="21" r="3" fill="#78350f" />
        <circle cx="8" cy="21" r="1.5" fill="white" />
        <circle cx="24" cy="21" r="3" fill="#78350f" />
        <circle cx="24" cy="21" r="1.5" fill="white" />
        <text x="32" y="10" fontSize="9" fill="#d97706" fontWeight="bold">LE</text>
      </svg>
    ),
    label: 'Shared/Leguna',
  },
  metro: {
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    lineColor: '#7c3aed',
    lineDash: 'none',
    icon: () => (
      <svg viewBox="0 0 38 26" fill="none" xmlns="http://www.w3.org/2000/svg" width="38" height="26">
        <rect x="1" y="2" width="36" height="16" rx="5" fill="#7c3aed" />
        <rect x="4" y="5" width="7" height="5" rx="1.5" fill="white" opacity="0.95" />
        <rect x="14" y="5" width="7" height="5" rx="1.5" fill="white" opacity="0.95" />
        <rect x="24" y="5" width="7" height="5" rx="1.5" fill="white" opacity="0.95" />
        <path d="M1 14 h36" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        <circle cx="9" cy="21" r="3" fill="#4c1d95" />
        <circle cx="9" cy="21" r="1.5" fill="white" />
        <circle cx="29" cy="21" r="3" fill="#4c1d95" />
        <circle cx="29" cy="21" r="1.5" fill="white" />
        {/* Electric bolt */}
        <path d="M19 2 L16 10 h4 L17 18" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: 'Metro Rail (MRT-6)',
  },
  auto_rickshaw: {
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    lineColor: '#16a34a',
    lineDash: '4,4',
    icon: () => (
      <svg viewBox="0 0 34 26" fill="none" xmlns="http://www.w3.org/2000/svg" width="34" height="26">
        <path d="M4 15 Q6 6 14 5 L28 5 Q32 5 32 10 L32 16 Q32 18 30 18 L4 18 Q2 18 2 16 Z" fill="#16a34a" />
        <rect x="6" y="7" width="8" height="6" rx="1" fill="white" opacity="0.9" />
        <rect x="17" y="7" width="10" height="6" rx="1" fill="white" opacity="0.9" />
        <circle cx="9" cy="21" r="3" fill="#14532d" />
        <circle cx="9" cy="21" r="1.5" fill="white" />
        <circle cx="26" cy="21" r="3" fill="#14532d" />
        <circle cx="26" cy="21" r="1.5" fill="white" />
        <path d="M2 12 L0 15" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    label: 'Auto-Rickshaw / CNG',
  },
  bus_or_feeder: {
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
    lineColor: '#0891b2',
    lineDash: '6,3',
    icon: () => (
      <svg viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="24">
        <rect x="1" y="2" width="34" height="17" rx="4" fill="#0891b2" />
        <rect x="3" y="5" width="8" height="6" rx="1" fill="white" opacity="0.9" />
        <rect x="14" y="5" width="8" height="6" rx="1" fill="white" opacity="0.9" />
        <rect x="24" y="5" width="8" height="6" rx="1" fill="white" opacity="0.9" />
        <rect x="1" y="15" width="34" height="4" rx="0" fill="rgba(0,0,0,0.12)" />
        <circle cx="8" cy="21" r="3" fill="#164e63" />
        <circle cx="8" cy="21" r="1.5" fill="white" />
        <circle cx="28" cy="21" r="3" fill="#164e63" />
        <circle cx="28" cy="21" r="1.5" fill="white" />
      </svg>
    ),
    label: 'Bus / Local Feeder',
  },
  transfer: {
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fcd34d',
    lineColor: '#f59e0b',
    lineDash: 'none',
    icon: () => (
      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
        <circle cx="14" cy="14" r="13" fill="#f59e0b" stroke="white" strokeWidth="2" />
        <path d="M8 10 h12 M16 7 l4 3 -4 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 18 H8 M12 15 l-4 3 4 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: 'Interchange',
  },
  walk: {
    color: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    lineColor: '#94a3b8',
    lineDash: '3,4',
    icon: () => (
      <svg viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="28">
        <circle cx="10" cy="4" r="3.5" fill="#64748b" />
        <path d="M10 8 L8 20 M10 8 L12 20" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M6 13 L14 13" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 20 L5 26 M12 20 L15 26" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    label: 'Walk',
  },
};

// ── Station / Stop node ──────────────────────────────────────────────────────
function StopNode({ label, isStart, isEnd, isHub }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[70px] max-w-[90px]">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md border-2 text-white text-sm font-bold ${
          isStart
            ? 'bg-emerald-500 border-emerald-300'
            : isEnd
            ? 'bg-red-500 border-red-300'
            : isHub
            ? 'bg-amber-400 border-amber-200'
            : 'bg-slate-400 border-slate-200'
        }`}
      >
        {isStart ? '🟢' : isEnd ? '🏁' : isHub ? '🔄' : '●'}
      </div>
      <span
        className={`text-center text-[10px] leading-tight font-semibold px-1 ${
          isStart ? 'text-emerald-700' : isEnd ? 'text-red-700' : isHub ? 'text-amber-700' : 'text-slate-600'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ── Transport leg segment with icon + hover tooltip ───────────────────────────
function TransportLeg({ leg, isLast }) {
  const [hovered, setHovered] = useState(false);
  const cfg = MODE_CONFIG[leg.mode] || MODE_CONFIG['bus'];

  const allServices = [
    ...(leg.buses || []).map(b => ({ name: b.name_bn || b.name, sub: b.name !== b.name_bn ? b.name : null, code: b.route_code, type: 'bus' })),
    ...(leg.shared_transit_services || []).map(s => ({ name: s.name_bn || s.name, type: 'shared' })),
    ...(leg.local_transports || []).map(lt => ({ name: lt, type: 'local' })),
  ];

  const isTransfer = leg.mode === 'transfer';

  return (
    <div className="flex items-center">
      {/* Leg connector segment */}
      <div className="flex flex-col items-center relative" style={{ minWidth: isTransfer ? 70 : 110 }}>
        {/* Connecting line above */}
        {!isTransfer && (
          <div
            className="absolute top-1/2 left-0 right-0 h-0.5"
            style={{
              background: cfg.lineColor,
              opacity: 0.6,
              borderTop: `2px ${cfg.lineDash !== 'none' ? 'dashed' : 'solid'} ${cfg.lineColor}`,
              zIndex: 0,
              transform: 'translateY(-50%)',
              top: '28px',
            }}
          />
        )}

        {/* Icon + Tooltip */}
        <div
          className="relative z-10 cursor-pointer select-none"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onTouchStart={() => setHovered(v => !v)}
        >
          {/* Transport Icon */}
          <div
            className="flex items-center justify-center rounded-xl shadow-md border-2 transition-transform hover:scale-110"
            style={{
              background: cfg.bg,
              borderColor: hovered ? cfg.color : cfg.border,
              padding: '6px 10px',
              boxShadow: hovered ? `0 4px 20px ${cfg.color}44` : undefined,
            }}
          >
            {cfg.icon()}
          </div>

          {/* Mode label */}
          <div
            className="text-center text-[9px] font-bold mt-1 uppercase tracking-wide"
            style={{ color: cfg.color }}
          >
            {cfg.label}
          </div>

          {/* Time + Fare pill */}
          {(leg.est_time_min > 0 || leg.est_fare_bdt > 0) && (
            <div className="flex justify-center gap-1 mt-0.5">
              {leg.est_time_min > 0 && (
                <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-600 font-semibold">
                  ~{leg.est_time_min}m
                </span>
              )}
              {leg.est_fare_bdt > 0 && (
                <span className="text-[9px] px-1 rounded font-bold" style={{ background: cfg.bg, color: cfg.color }}>
                  ৳{leg.est_fare_bdt}
                </span>
              )}
            </div>
          )}

          {/* Hover Tooltip */}
          {hovered && allServices.length > 0 && (
            <div
              className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 rounded-xl shadow-xl border p-3 text-left"
              style={{ background: '#fff', borderColor: cfg.border }}
            >
              {/* Arrow */}
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-b border-r"
                style={{ background: '#fff', borderColor: cfg.border }}
              />

              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: cfg.color }}>
                {cfg.label} Options
              </p>

              <div className="space-y-1">
                {allServices.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                    <div>
                      <span className="text-[11px] font-bold text-slate-800 font-bengali">{s.name}</span>
                      {s.sub && (
                        <span className="text-[10px] text-slate-400 ml-1">({s.sub})</span>
                      )}
                      {s.code && (
                        <span
                          className="ml-1 text-[9px] px-1 rounded font-bold"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {s.code}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Instructions snippet */}
              {leg.instructions && (
                <p className="text-[9px] text-slate-500 mt-2 leading-tight border-t pt-1.5 border-slate-100">
                  {leg.instructions.length > 90 ? leg.instructions.slice(0, 90) + '…' : leg.instructions}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Arrow between legs */}
      {!isLast && (
        <svg width="18" height="16" viewBox="0 0 18 16" fill="none" className="shrink-0 mx-0.5 opacity-40">
          <path d="M2 8 h12 M10 3 l6 5 -6 5" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ── Main Route Map Diagram ───────────────────────────────────────────────────
function RouteMapDiagram({ route, from, to }) {
  const legs = route.legs || [];
  if (!legs.length) return null;

  const cfg = (mode) => MODE_CONFIG[mode] || MODE_CONFIG.bus;

  // Build alternating: StopNode — TransportLeg — StopNode — TransportLeg …
  const nodes = [];
  legs.forEach((leg, idx) => {
    // Before first leg: origin node
    if (idx === 0) {
      nodes.push(
        <StopNode key="origin" label={leg.from || from} isStart />
      );
    }

    // The leg itself
    nodes.push(
      <TransportLeg key={`leg-${idx}`} leg={leg} isLast={idx === legs.length - 1} />
    );

    // After each leg: destination node
    if (leg.mode === 'transfer') {
      nodes.push(
        <StopNode key={`hub-${idx}`} label={leg.hub_name || 'Hub'} isHub />
      );
    } else {
      const isLast = idx === legs.length - 1;
      nodes.push(
        <StopNode key={`stop-${idx}`} label={leg.to || (isLast ? to : '')} isEnd={isLast} />
      );
    }
  });

  return (
    <div className="overflow-x-auto pb-2 -mx-1 px-1">
      <div className="flex items-center gap-1 min-w-max py-4 px-2">
        {nodes}
      </div>
    </div>
  );
}

// ── Legend ───────────────────────────────────────────────────────────────────
function MapLegend() {
  const items = ['bus', 'shared_bus', 'metro', 'auto_rickshaw', 'transfer', 'walk'];
  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
      {items.map(mode => {
        const cfg = MODE_CONFIG[mode];
        return (
          <div key={mode} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm border"
              style={{ background: cfg.bg, borderColor: cfg.color }}
            />
            <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          </div>
        );
      })}
      <span className="text-[10px] text-slate-400 ml-1 italic self-center">Hover over icon to see services</span>
    </div>
  );
}

// ── Exported Section Component (replaces AvailableBusesSection) ──────────────
export default function TransitRouteMapDiagram({ busTransit, fromLocation, toLocation }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!busTransit && !fromLocation && !toLocation) return null;

  const available = busTransit?.available === true;
  const buses = busTransit?.buses || [];
  const transferRoutes = busTransit?.transfer_routes || [];
  const transfer = busTransit?.transfer_suggestion;

  const activeRoute = transferRoutes[activeTab] || null;

  // ── Mode colors for route-type badge ──────────────────────────────────────
  const routeTypeStyle = (type) => {
    if (type === 'metro_multimodal') return { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' };
    if (type === 'two_bus_transfer') return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
    return { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };
  };

  return (
    <div className="mt-6 pt-6 border-t border-slate-200/80">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Transit Route Map
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bengali">
                রুট ম্যাপ
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              {fromLocation} → {toLocation}
              <span className="ml-2 text-[10px] text-slate-400 italic">Hover over transport icons to see bus/service names</span>
            </p>
          </div>
        </div>

        {available && buses.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {buses.length} Direct Bus{buses.length > 1 ? 'es' : ''} Available
          </span>
        )}
      </div>

      {/* ── Case 1: Direct Buses — Inline Route Map ── */}
      {available && buses.length > 0 ? (
        <div className="space-y-3">
          {buses.map((bus, idx) => (
            <div
              key={bus.id || idx}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-emerald-300 transition-colors"
            >
              {/* Bus name + meta */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sm font-bold text-slate-900 font-bengali">{bus.name_bn || bus.name}</span>
                {bus.name && bus.name !== bus.name_bn && (
                  <span className="text-xs text-slate-500">({bus.name})</span>
                )}
                {bus.route_code && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {bus.route_code}
                  </span>
                )}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Every {bus.frequency_min} min
                </span>
                <span className="text-[10px] font-bold text-emerald-700 ml-auto">৳{bus.fare_bdt}</span>
              </div>

              {/* Visual route diagram for direct bus */}
              <div className="overflow-x-auto pb-1">
                <div className="flex items-center gap-2 min-w-max py-2">
                  {/* Origin stop */}
                  <div className="flex flex-col items-center gap-1 min-w-[70px]">
                    <div className="w-9 h-9 rounded-full bg-emerald-500 border-2 border-emerald-300 flex items-center justify-center text-base shadow-sm">🟢</div>
                    <span className="text-[10px] font-semibold text-emerald-700 text-center leading-tight">{bus.from_stop || fromLocation}</span>
                  </div>

                  {/* Dashed line + bus icon */}
                  <div className="flex flex-col items-center relative" style={{ minWidth: 120 }}>
                    <div className="absolute top-[18px] left-0 right-0 border-t-2 border-dashed border-blue-300" />
                    <div
                      className="relative z-10 bg-blue-50 border-2 border-blue-300 rounded-xl px-3 py-2 cursor-default shadow-sm hover:shadow-md hover:border-blue-500 transition-all group"
                    >
                      {MODE_CONFIG.bus.icon()}
                      <div className="text-[9px] font-bold text-blue-700 text-center mt-1 uppercase">Bus</div>

                      {/* Hover: bus names */}
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-52 bg-white border border-blue-200 rounded-xl shadow-xl p-3 hidden group-hover:block z-50 text-left">
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white border-b border-r border-blue-200" />
                        <p className="text-[10px] font-bold text-blue-700 uppercase mb-1.5">🚌 Direct Bus Service</p>
                        <div className="font-bengali font-bold text-[12px] text-slate-800">{bus.name_bn || bus.name}</div>
                        {bus.name !== bus.name_bn && (
                          <div className="text-[10px] text-slate-500">{bus.name}</div>
                        )}
                        <div className="mt-1.5 text-[9px] text-slate-500">
                          Route: {bus.origin} ⇄ {bus.destination}
                        </div>
                        <div className="text-[9px] text-emerald-700 font-bold">{bus.operating_hours}</div>
                      </div>
                    </div>

                    {/* Stops count badge */}
                    <span className="text-[9px] mt-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold">
                      {bus.stops_on_journey} stops
                    </span>
                  </div>

                  {/* Arrow */}
                  <svg width="18" height="16" viewBox="0 0 18 16" fill="none" className="opacity-40 shrink-0">
                    <path d="M2 8 h12 M10 3 l6 5 -6 5" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>

                  {/* Destination stop */}
                  <div className="flex flex-col items-center gap-1 min-w-[70px]">
                    <div className="w-9 h-9 rounded-full bg-red-500 border-2 border-red-300 flex items-center justify-center text-base shadow-sm">🏁</div>
                    <span className="text-[10px] font-semibold text-red-700 text-center leading-tight">{bus.to_stop || toLocation}</span>
                  </div>
                </div>
              </div>

              {/* Journey stoppages inline scrollable */}
              {bus.journey_stoppages && bus.journey_stoppages.length > 0 && (
                <div className="mt-2 overflow-x-auto">
                  <div className="flex items-center gap-1 text-[10px] min-w-max pb-1">
                    {bus.journey_stoppages.map((s, si) => (
                      <React.Fragment key={si}>
                        <span className={`px-1.5 py-0.5 rounded font-medium border ${
                          si === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                          : si === bus.journey_stoppages.length - 1 ? 'bg-red-50 text-red-700 border-red-200 font-bold'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>{s}</span>
                        {si < bus.journey_stoppages.length - 1 && (
                          <span className="text-slate-300 font-bold">›</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

      ) : (
        /* ── Case 2: No Direct Bus → Visual Transfer Route Map ── */
        <div className="space-y-4">
          {/* Notice banner */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                No direct bus for {fromLocation} → {toLocation}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Showing multi-modal connecting routes. <strong>Hover over any transport icon</strong> to see the bus names, service names, and details.
              </p>
            </div>
          </div>

          {/* Route selector tabs */}
          {transferRoutes.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {transferRoutes.map((route, idx) => {
                  const style = routeTypeStyle(route.type);
                  const isActive = idx === activeTab;
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => setActiveTab(idx)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer"
                      style={
                        isActive
                          ? { background: style.text, color: '#fff', borderColor: style.text }
                          : { background: '#fff', color: style.text, borderColor: style.border }
                      }
                    >
                      <span>{route.type === 'metro_multimodal' ? '🚇' : '🚌'} {route.title}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: isActive ? 'rgba(255,255,255,0.2)' : style.bg, color: isActive ? '#fff' : style.text }}
                      >
                        ~{route.total_est_time_min}m · ৳{route.total_est_fare_bdt}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active route map card */}
              {activeRoute && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  {/* Title row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{activeRoute.title}</span>
                        {activeRoute.tag && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                            style={(() => {
                              const s = routeTypeStyle(activeRoute.type);
                              return { background: s.bg, color: s.text, borderColor: s.border };
                            })()}
                          >
                            {activeRoute.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{activeRoute.summary}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shrink-0">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-semibold block">Est. Time</span>
                        <span className="font-bold text-slate-800">~{activeRoute.total_est_time_min} min</span>
                      </div>
                      <div className="w-px h-5 bg-slate-200" />
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-semibold block">Total Fare</span>
                        <span className="font-bold text-emerald-700">~৳{activeRoute.total_est_fare_bdt}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── THE MAP DIAGRAM ── */}
                  <RouteMapDiagram route={activeRoute} from={fromLocation} to={toLocation} />

                  {/* Legend */}
                  <MapLegend />
                </div>
              )}
            </div>
          )}

          {/* Fallback if no transfer routes */}
          {transferRoutes.length === 0 && transfer && (
            <div className="p-3.5 rounded-xl bg-white border border-amber-200 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-amber-900">Recommended Interchange: {transfer.interchange_hub}</p>
              <p className="text-slate-600 text-[11px] leading-relaxed">{transfer.guidance}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

