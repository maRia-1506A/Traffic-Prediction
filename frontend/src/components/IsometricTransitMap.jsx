import React, { useState } from 'react';

// ── Color Palette & Mode Metadata ────────────────────────────────────────────
const MODE_STYLES = {
  bus: {
    color: '#2563eb', // Blue
    roadFill: '#3b82f6',
    roadEdge: '#1d4ed8',
    glow: 'rgba(37, 99, 235, 0.4)',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    title: 'City Bus Corridor',
    icon: '🚌'
  },
  shared_bus: {
    color: '#d97706', // Amber
    roadFill: '#f59e0b',
    roadEdge: '#b45309',
    glow: 'rgba(217, 119, 6, 0.4)',
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
    title: 'Shared Leguna / Human Hauler',
    icon: '🚐'
  },
  metro: {
    color: '#dc2626', // Red track viaduct / Purple train
    roadFill: '#b91c1c',
    roadEdge: '#7f1d1d',
    glow: 'rgba(220, 38, 38, 0.4)',
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
    title: 'Dhaka Metro Rail (MRT Line 6)',
    icon: '🚇'
  },
  auto_rickshaw: {
    color: '#16a34a', // Emerald Green
    roadFill: '#22c55e',
    roadEdge: '#15803d',
    glow: 'rgba(22, 163, 74, 0.4)',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    title: 'CNG Auto-Rickshaw / Easy-bike',
    icon: '🛺'
  },
  rickshaw: {
    color: '#0284c7', // Sky Blue
    roadFill: '#0ea5e9',
    roadEdge: '#0369a1',
    glow: 'rgba(2, 132, 199, 0.4)',
    badgeBg: 'bg-sky-50 text-sky-800 border-sky-200',
    title: 'Dhaka Local Cycle-Rickshaw',
    icon: '🚲'
  },
  walk: {
    color: '#f97316', // Orange
    roadFill: '#fb923c',
    roadEdge: '#c2410c',
    glow: 'rgba(249, 115, 22, 0.4)',
    badgeBg: 'bg-orange-50 text-orange-800 border-orange-200',
    title: 'Pedestrian Footpath',
    icon: '🚶'
  },
  transfer: {
    color: '#eab308', // Amber/Yellow
    roadFill: '#facc15',
    roadEdge: '#ca8a04',
    glow: 'rgba(234, 179, 8, 0.4)',
    badgeBg: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    title: 'Interchange Station',
    icon: '🔄'
  }
};

// ── SVG Isometric 3D Vehicle Figures ─────────────────────────────────────────

// 1. Isometric 3D City Bus
function IsometricBus({ color = '#2563eb', accent = '#60a5fa', isHovered }) {
  return (
    <g
      className={`transition-all duration-300 transform ${isHovered ? 'scale-115 -translate-y-2' : 'hover:scale-110'}`}
      style={{ filter: isHovered ? 'drop-shadow(0 12px 16px rgba(0,0,0,0.35))' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))' }}
    >
      {/* Ground Shadow */}
      <ellipse cx="40" cy="46" rx="36" ry="12" fill="rgba(15, 23, 42, 0.22)" />

      {/* Bus Body Left Side (darker) */}
      <polygon points="12,28 48,10 48,26 12,44" fill={color} />
      {/* Side Windows */}
      <polygon points="15,26 23,22 23,17 15,21" fill="#e0f2fe" opacity="0.95" />
      <polygon points="25,21 33,17 33,12 25,16" fill="#e0f2fe" opacity="0.95" />
      <polygon points="35,16 43,12 43,7 35,11" fill="#e0f2fe" opacity="0.95" />

      {/* Bus Wheels Left Side */}
      <ellipse cx="20" cy="41" rx="4" ry="5.5" fill="#1e293b" />
      <ellipse cx="20" cy="41" rx="2" ry="2.8" fill="#94a3b8" />
      <ellipse cx="40" cy="31" rx="4" ry="5.5" fill="#1e293b" />
      <ellipse cx="40" cy="31" rx="2" ry="2.8" fill="#94a3b8" />

      {/* Bus Body Front Face (lighter) */}
      <polygon points="48,10 68,20 68,36 48,26" fill={accent} />
      {/* Front Windshield */}
      <polygon points="50,13 65,21 65,27 50,19" fill="#bae6fd" opacity="0.9" />
      {/* Headlights */}
      <ellipse cx="65" cy="31" rx="2" ry="3" fill="#fef08a" />
      <ellipse cx="53" cy="25" rx="1.5" ry="2.5" fill="#fef08a" />

      {/* Bus Roof (top surface) */}
      <polygon points="12,28 32,38 68,20 48,10" fill="#f8fafc" opacity="0.95" />
      {/* AC Unit on roof */}
      <polygon points="28,27 38,32 50,26 40,21" fill="#cbd5e1" />

      {/* Front Bumper & Grill */}
      <polygon points="52,27 67,34 67,36 52,29" fill="#0f172a" />
    </g>
  );
}

// 2. Isometric 3D Dhaka Metro Rail Train (MRT Line 6)
function IsometricMetroTrain({ isHovered }) {
  return (
    <g
      className={`transition-all duration-300 transform ${isHovered ? 'scale-115 -translate-y-2' : 'hover:scale-110'}`}
      style={{ filter: isHovered ? 'drop-shadow(0 14px 18px rgba(0,0,0,0.4))' : 'drop-shadow(0 5px 8px rgba(0,0,0,0.25))' }}
    >
      {/* Ground Shadow */}
      <ellipse cx="55" cy="48" rx="52" ry="13" fill="rgba(15, 23, 42, 0.28)" />

      {/* Rear Coach Side */}
      <polygon points="8,26 38,11 38,27 8,42" fill="#475569" />
      <polygon points="12,24 22,19 22,15 12,20" fill="#e2e8f0" opacity="0.9" />
      <polygon points="25,17 35,12 35,8 25,13" fill="#e2e8f0" opacity="0.9" />
      {/* Metro Green/Red stripe */}
      <polygon points="8,35 38,20 38,22 8,37" fill="#16a34a" />
      <polygon points="8,37 38,22 38,24 8,39" fill="#dc2626" />

      {/* Coach Coupler */}
      <polygon points="38,13 44,16 44,25 38,22" fill="#0f172a" />

      {/* Lead Coach Side */}
      <polygon points="44,16 78,0 78,16 44,32" fill="#f8fafc" />
      <polygon points="48,15 58,10 58,6 48,11" fill="#38bdf8" opacity="0.9" />
      <polygon points="62,8 72,3 72,-1 62,4" fill="#38bdf8" opacity="0.9" />
      {/* Green & Red Dhaka Metro line stripe */}
      <polygon points="44,24 78,8 78,10 44,26" fill="#16a34a" />
      <polygon points="44,26 78,10 78,12 44,28" fill="#dc2626" />

      {/* Front Nose Aerodynamic Cockpit */}
      <polygon points="78,0 102,12 102,28 78,16" fill="#e2e8f0" />
      <polygon points="82,3 98,11 98,19 82,11" fill="#0284c7" />
      {/* Metro Logo / Headlight */}
      <circle cx="98" cy="22" r="2.5" fill="#fef08a" />
      <circle cx="86" cy="16" r="2" fill="#fef08a" />

      {/* Train Roof with Pantograph */}
      <polygon points="8,26 30,37 102,12 78,0" fill="#ffffff" opacity="0.95" />
      <path d="M52,18 L58,10 L68,14 L74,6" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      <line x1="64" y1="6" x2="78" y2="7" stroke="#cbd5e1" strokeWidth="2" />
    </g>
  );
}

// 3. Isometric 3D CNG Auto-Rickshaw (Green 3-Wheeler)
function IsometricCNG({ isHovered }) {
  return (
    <g
      className={`transition-all duration-300 transform ${isHovered ? 'scale-115 -translate-y-2' : 'hover:scale-110'}`}
      style={{ filter: isHovered ? 'drop-shadow(0 10px 14px rgba(0,0,0,0.35))' : 'drop-shadow(0 3px 5px rgba(0,0,0,0.2))' }}
    >
      <ellipse cx="36" cy="40" rx="24" ry="9" fill="rgba(15, 23, 42, 0.22)" />

      {/* CNG Body Rear (Green) */}
      <polygon points="14,24 38,12 38,26 14,38" fill="#15803d" />
      {/* Canvas Top / Hood (Black / Yellow) */}
      <polygon points="14,24 30,32 54,20 38,12" fill="#0f172a" />
      <polygon points="16,23 30,30 46,22 32,15" fill="#ca8a04" opacity="0.9" />

      {/* Front Hood & Handlebar */}
      <polygon points="38,12 56,21 56,33 38,24" fill="#16a34a" />
      {/* Front Windshield */}
      <polygon points="40,15 53,22 53,27 40,20" fill="#bae6fd" opacity="0.85" />
      {/* Front Wheel */}
      <ellipse cx="54" cy="35" rx="3" ry="4.5" fill="#1e293b" />
      {/* Rear Wheel */}
      <ellipse cx="22" cy="37" rx="3.5" ry="5" fill="#1e293b" />
      <ellipse cx="22" cy="37" rx="1.5" ry="2.5" fill="#e2e8f0" />
      {/* Headlight */}
      <circle cx="56" cy="28" r="2" fill="#fef08a" />
    </g>
  );
}

// 4. Isometric 3D Dhaka Cycle-Rickshaw
function IsometricRickshaw({ isHovered }) {
  return (
    <g
      className={`transition-all duration-300 transform ${isHovered ? 'scale-115 -translate-y-2' : 'hover:scale-110'}`}
      style={{ filter: isHovered ? 'drop-shadow(0 10px 14px rgba(0,0,0,0.35))' : 'drop-shadow(0 3px 5px rgba(0,0,0,0.2))' }}
    >
      <ellipse cx="34" cy="42" rx="22" ry="8" fill="rgba(15, 23, 42, 0.2)" />

      {/* Passenger Hood (Decorative Arch) */}
      <path d="M12,28 Q18,10 32,16 Q36,26 30,34 Z" fill="#dc2626" />
      <path d="M14,27 Q20,13 30,18 Q34,26 28,32 Z" fill="#eab308" />
      {/* Seat Cushion */}
      <polygon points="18,30 32,23 34,28 20,35" fill="#1e293b" />

      {/* Bicycle Frame */}
      <line x1="30" y1="28" x2="48" y2="24" stroke="#475569" strokeWidth="2" />
      <line x1="48" y1="24" x2="54" y2="34" stroke="#475569" strokeWidth="2" />
      {/* Handlebar */}
      <line x1="47" y1="20" x2="49" y2="25" stroke="#0f172a" strokeWidth="2.5" />
      <line x1="44" y1="20" x2="51" y2="21" stroke="#0f172a" strokeWidth="2" />

      {/* Spoked Wheels */}
      <circle cx="54" cy="36" r="6" stroke="#334155" strokeWidth="2" fill="none" />
      <circle cx="54" cy="36" r="1.5" fill="#0f172a" />
      <circle cx="20" cy="38" r="7" stroke="#334155" strokeWidth="2" fill="none" />
      <circle cx="20" cy="38" r="1.5" fill="#0f172a" />
    </g>
  );
}

// 5. Isometric Walking Person Figure
function IsometricWalker({ isHovered }) {
  return (
    <g
      className={`transition-all duration-300 transform ${isHovered ? 'scale-120 -translate-y-2' : 'hover:scale-110'}`}
      style={{ filter: isHovered ? 'drop-shadow(0 8px 12px rgba(249,115,22,0.45))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    >
      <ellipse cx="20" cy="34" rx="12" ry="4.5" fill="rgba(15, 23, 42, 0.2)" />
      {/* Pedestrian Head */}
      <circle cx="20" cy="8" r="4.5" fill="#ea580c" />
      {/* Body / Torso */}
      <path d="M17,13 L23,13 L22,23 L18,23 Z" fill="#f97316" />
      {/* Backpack */}
      <ellipse cx="16" cy="17" rx="2.5" ry="3.5" fill="#0284c7" />
      {/* Walking Legs */}
      <line x1="19" y1="23" x2="14" y2="33" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="21" y1="23" x2="26" y2="32" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
      {/* Swinging Arms */}
      <line x1="17" y1="15" x2="23" y2="20" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      <line x1="23" y1="15" x2="16" y2="20" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

// ── Master Interactive Isometric Map Component ──────────────────────────────
export default function IsometricTransitMap({ busTransit, fromLocation, toLocation }) {
  const [activeTab, setActiveTab] = useState(0);
  const [hoveredLegIndex, setHoveredLegIndex] = useState(null);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'detailed'

  if (!busTransit && !fromLocation && !toLocation) return null;

  const available = busTransit?.available === true;
  const buses = busTransit?.buses || [];
  const transferRoutes = busTransit?.transfer_routes || [];
  const transfer = busTransit?.transfer_suggestion;

  const activeRoute = transferRoutes[activeTab] || transferRoutes[0] || null;

  // Synthesize legs if direct buses are present
  let displayLegs = [];
  if (available && buses.length > 0) {
    displayLegs = [
      {
        step_num: 1,
        mode: 'walk',
        mode_label: 'Walking Feeder',
        from: fromLocation,
        to: buses[0]?.from_stop || fromLocation,
        est_time_min: 3,
        est_fare_bdt: 0,
        instructions: `Walk 150-250m to ${buses[0]?.from_stop || fromLocation} boarding stand.`
      },
      {
        step_num: 2,
        mode: 'bus',
        mode_label: `Direct Highway Bus (${buses.length} services)`,
        from: buses[0]?.from_stop || fromLocation,
        to: buses[0]?.to_stop || toLocation,
        est_time_min: Math.round(buses[0]?.stops_on_journey * 3.5 || 30),
        est_fare_bdt: buses[0]?.fare_bdt || 25,
        buses: buses,
        instructions: `Board ${buses.slice(0, 3).map(b => b.name_bn || b.name).join(' or ')} directly.`
      },
      {
        step_num: 3,
        mode: 'walk',
        mode_label: 'Arrival Walk',
        from: buses[0]?.to_stop || toLocation,
        to: toLocation,
        est_time_min: 2,
        est_fare_bdt: 0,
        instructions: `Alight at ${buses[0]?.to_stop || toLocation} and walk to your destination.`
      }
    ];
  } else if (activeRoute && activeRoute.legs) {
    displayLegs = activeRoute.legs;
  }

  // Detect whether route includes metro, cng, leguna, etc.
  const hasMetro = displayLegs.some(l => l.mode === 'metro');
  const hasCNG = displayLegs.some(l => l.mode === 'auto_rickshaw');
  const hasRickshaw = displayLegs.some(l => l.mode === 'rickshaw');
  const hasBus = displayLegs.some(l => l.mode === 'bus' || l.mode === 'bus_or_feeder');
  const hasShared = displayLegs.some(l => l.mode === 'shared_bus');

  return (
    <div className="mt-6 pt-6 border-t border-slate-200/90">
      {/* ── Section Header & View Toggle ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">
              🗺️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Route-Wise Multi-Modal Transit Map
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bengali">
                  বাস ও ট্রানজিট ম্যাপ
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {fromLocation} ⇄ {toLocation}
                <span className="ml-2 font-medium text-blue-600">
                  • Hover over any vehicle figure to see authentic bus & transit names
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher: Isometric Map vs Detailed List */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🗺️</span> Isometric Map View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'detailed'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📋</span> Step-by-Step
            </button>
          </div>
        </div>
      </div>

      {/* ── Status Banner (When No Direct Bus Available) ── */}
      {!available && (
        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/80 p-4 mb-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
              ⚠️
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                No direct single bus operates between {fromLocation} and {toLocation}
                <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-amber-200/60 text-amber-900 font-bengali">
                  সরাসরি বাস নেই
                </span>
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Explore the verified <strong className="text-slate-800">connecting transfer routes</strong> below.
                The illustrated map below highlights each leg (Bus, Metro Rail, Shared Leguna, Auto-Rickshaw, Walk) with exact vehicle figures and interactive hover details.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer Route Selector Tabs ── */}
      {transferRoutes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {transferRoutes.map((route, idx) => {
            const isSel = idx === activeTab;
            const isMetro = route.type === 'metro_multimodal';

            return (
              <button
                key={route.id || idx}
                type="button"
                onClick={() => {
                  setActiveTab(idx);
                  setHoveredLegIndex(null);
                }}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                  isSel
                    ? isMetro
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs font-bold'
                      : 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{isMetro ? '🚇' : '🚌'}</span>
                <span>{route.title}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                    isSel ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  ~{route.total_est_time_min}m · ৳{route.total_est_fare_bdt}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── VIEW 1: THE ILLUSTRATED ISOMETRIC MAP ── */}
      {viewMode === 'map' && (
        <div className="relative bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-800 overflow-hidden">
          {/* Top Bar inside Map Canvas: Header, Mode Legend, Time/Fare */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800/80 z-20 relative">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h4 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  {activeRoute?.title || `Direct Bus Corridor: ${fromLocation} → ${toLocation}`}
                </h4>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeRoute?.summary || `Direct connection with ${buses.length} authenticated Dhaka bus lines.`}
              </p>
            </div>

            {/* Quick Stats Pill */}
            <div className="flex items-center gap-4 bg-slate-800/90 backdrop-blur px-4 py-2 rounded-2xl border border-slate-700/80 shrink-0 self-start sm:self-auto text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Est. Time</span>
                <span className="text-sm font-extrabold text-amber-400">
                  ~{activeRoute?.total_est_time_min || 35} mins
                </span>
              </div>
              <div className="w-px h-6 bg-slate-700" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Fare</span>
                <span className="text-sm font-extrabold text-emerald-400">
                  ~৳{activeRoute?.total_est_fare_bdt || 30}
                </span>
              </div>
            </div>
          </div>

          {/* ── SVG Isometric Canvas ── */}
          <div className="relative w-full overflow-x-auto pb-4">
            <div className="min-w-[760px] relative">
              <svg
                viewBox="0 0 920 540"
                className="w-full h-auto select-none rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                  boxShadow: 'inset 0 0 80px rgba(0,0,0,0.6)'
                }}
              >
                <defs>
                  {/* Road Gradients */}
                  <linearGradient id="blueRoadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>

                  <linearGradient id="purpleRoadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#6d28d9" />
                  </linearGradient>

                  <linearGradient id="greenRoadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#16a34a" />
                    <stop offset="100%" stopColor="#15803d" />
                  </linearGradient>

                  <linearGradient id="metroViaductGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#dc2626" />
                    <stop offset="50%" stopColor="#b91c1c" />
                    <stop offset="100%" stopColor="#991b1b" />
                  </linearGradient>

                  {/* Water River Stream Pattern */}
                  <linearGradient id="riverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0369a1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.6" />
                  </linearGradient>

                  {/* City Block Grid Pattern */}
                  <pattern id="cityGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <rect width="38" height="38" fill="rgba(30, 41, 59, 0.4)" rx="4" />
                  </pattern>
                </defs>

                {/* ── Background Map Textures: Greens, Water Stream, City Blocks ── */}
                {/* Turag River / Hatirjheel / Buriganga Water Stream */}
                <path
                  d="M0,320 Q240,260 460,380 T920,440 L920,540 L0,540 Z"
                  fill="url(#riverGrad)"
                  opacity="0.35"
                />

                {/* City Blocks Grid in background */}
                <rect x="20" y="40" width="300" height="180" fill="url(#cityGrid)" />
                <rect x="620" y="240" width="280" height="220" fill="url(#cityGrid)" />
                <rect x="360" y="30" width="220" height="110" fill="url(#cityGrid)" opacity="0.6" />

                {/* Trees / Green Parks */}
                <circle cx="160" cy="180" r="14" fill="#065f46" opacity="0.4" />
                <circle cx="180" cy="190" r="18" fill="#047857" opacity="0.4" />
                <circle cx="205" cy="182" r="12" fill="#065f46" opacity="0.4" />
                <circle cx="780" cy="210" r="16" fill="#047857" opacity="0.4" />
                <circle cx="805" cy="225" r="20" fill="#065f46" opacity="0.4" />

                {/* ── LEG 1: WALKING TRAIL (From Origin Pin) ── */}
                {/* Dotted walking footsteps trail */}
                <path
                  d="M110,95 Q140,140 210,130 T280,165"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="4"
                  strokeDasharray="6,6"
                  strokeLinecap="round"
                  opacity="0.9"
                />

                {/* ── LEG 2: HIGHWAY ROAD (Blue Corridor) ── */}
                {/* Outer shadow of the road */}
                <path
                  d="M280,165 C340,195 380,240 450,230 S580,130 690,145"
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="26"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                {/* Main Blue Road Surface */}
                <path
                  d="M280,165 C340,195 380,240 450,230 S580,130 690,145"
                  fill="none"
                  stroke="url(#blueRoadGrad)"
                  strokeWidth="20"
                  strokeLinecap="round"
                />
                {/* Road Center Dashed Line */}
                <path
                  d="M280,165 C340,195 380,240 450,230 S580,130 690,145"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeDasharray="8,8"
                  opacity="0.75"
                />

                {/* ── ELEVATED METRO RAIL VIADUCT (Spans diagonally across the map) ── */}
                {/* Viaduct Concrete Support Pillars */}
                <g opacity="0.9">
                  <rect x="220" y="320" width="16" height="60" fill="#334155" rx="3" />
                  <rect x="370" y="270" width="16" height="60" fill="#334155" rx="3" />
                  <rect x="520" y="220" width="16" height="60" fill="#334155" rx="3" />
                  <rect x="670" y="170" width="16" height="60" fill="#334155" rx="3" />
                </g>

                {/* Metro Rail Track (Elevated Red Viaduct) */}
                <path
                  d="M140,360 L780,150"
                  fill="none"
                  stroke="#7f1d1d"
                  strokeWidth="22"
                  strokeLinecap="round"
                />
                <path
                  d="M140,360 L780,150"
                  fill="none"
                  stroke="url(#metroViaductGrad)"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                {/* Dual Metro Railway Steel Tracks */}
                <path
                  d="M140,358 L780,148"
                  fill="none"
                  stroke="#fca5a5"
                  strokeWidth="2"
                  opacity="0.9"
                />
                <path
                  d="M140,362 L780,152"
                  fill="none"
                  stroke="#fca5a5"
                  strokeWidth="2"
                  opacity="0.9"
                />
                {/* Rail Ties / Sleepers */}
                <path
                  d="M140,360 L780,150"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="16"
                  strokeDasharray="4,8"
                />

                {/* ── LEG 3: CONNECTING PURPLE ROAD (Towards Destination) ── */}
                {/* Outer shadow */}
                <path
                  d="M480,240 C520,310 460,390 560,420 S720,380 810,470"
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="26"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                {/* Purple Road Surface */}
                <path
                  d="M480,240 C520,310 460,390 560,420 S720,380 810,470"
                  fill="none"
                  stroke="url(#purpleRoadGrad)"
                  strokeWidth="20"
                  strokeLinecap="round"
                />
                {/* Road Center Dashed Line */}
                <path
                  d="M480,240 C520,310 460,390 560,420 S720,380 810,470"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeDasharray="8,8"
                  opacity="0.75"
                />

                {/* ── CONNECTING RED / AMBER TRANSFER LINK AT HUB ── */}
                <line
                  x1="450"
                  y1="230"
                  x2="480"
                  y2="240"
                  stroke="#f59e0b"
                  strokeWidth="6"
                  strokeDasharray="4,4"
                  strokeLinecap="round"
                />

                {/* ───────────────────────────────────────────────────────────── */}
                {/* ── VEHICLE FIGURES (3D Isometric Interactive Markers) ── */}
                {/* ───────────────────────────────────────────────────────────── */}

                {/* 1. WALKING PEDESTRIAN FIGURE (On Walking Trail) */}
                <g
                  transform="translate(155, 95)"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredLegIndex(0)}
                  onMouseLeave={() => setHoveredLegIndex(null)}
                >
                  <IsometricWalker isHovered={hoveredLegIndex === 0} />
                  {/* Label badge */}
                  <rect x="-10" y="42" width="60" height="18" rx="9" fill="#ea580c" />
                  <text x="20" y="54" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">
                    🚶 WALK
                  </text>
                </g>

                {/* 2. BLUE CITY BUS FIGURE (On Blue Highway Corridor) */}
                <g
                  transform="translate(320, 150)"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredLegIndex(1)}
                  onMouseLeave={() => setHoveredLegIndex(null)}
                >
                  <IsometricBus
                    color="#2563eb"
                    accent="#60a5fa"
                    isHovered={hoveredLegIndex === 1}
                  />
                  {/* Glowing Hover Badge */}
                  <g transform="translate(40, -10)">
                    <rect x="-42" y="-14" width="84" height="20" rx="10" fill="#1e40af" stroke="#93c5fd" strokeWidth="1.5" />
                    <text x="0" y="0" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">
                      🚌 BUS LEG 1
                    </text>
                  </g>
                </g>

                {/* 3. METRO RAIL TRAIN FIGURE (On Elevated Viaduct) */}
                <g
                  transform="translate(420, 190)"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredLegIndex('metro')}
                  onMouseLeave={() => setHoveredLegIndex(null)}
                >
                  <IsometricMetroTrain isHovered={hoveredLegIndex === 'metro'} />
                  {/* Metro Station Indicator Pill */}
                  <g transform="translate(60, -12)">
                    <rect x="-56" y="-14" width="112" height="20" rx="10" fill="#991b1b" stroke="#fca5a5" strokeWidth="1.5" />
                    <text x="0" y="0" fill="#ffffff" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                      🚇 METRO LINE 6
                    </text>
                  </g>
                </g>

                {/* 4. PURPLE BUS / CNG / LEGUNA FIGURE (On Leg 2 Purple Road) */}
                <g
                  transform="translate(540, 340)"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredLegIndex(2)}
                  onMouseLeave={() => setHoveredLegIndex(null)}
                >
                  {hasCNG ? (
                    <IsometricCNG isHovered={hoveredLegIndex === 2} />
                  ) : hasRickshaw ? (
                    <IsometricRickshaw isHovered={hoveredLegIndex === 2} />
                  ) : (
                    <IsometricBus
                      color="#7c3aed"
                      accent="#a78bfa"
                      isHovered={hoveredLegIndex === 2}
                    />
                  )}
                  {/* Label badge */}
                  <g transform="translate(40, -10)">
                    <rect x="-44" y="-14" width="88" height="20" rx="10" fill="#5b21b6" stroke="#c4b5fd" strokeWidth="1.5" />
                    <text x="0" y="0" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">
                      {hasCNG ? '🛺 CNG / AUTO' : hasRickshaw ? '🚲 RICKSHAW' : '🚌 BUS LEG 2'}
                    </text>
                  </g>
                </g>

                {/* ───────────────────────────────────────────────────────────── */}
                {/* ── KEY MILESTONE NODES (Origin, Hub, Destination Flag) ── */}
                {/* ───────────────────────────────────────────────────────────── */}

                {/* START PIN: Origin Teardrop Marker */}
                <g transform="translate(90, 45)">
                  <ellipse cx="20" cy="52" rx="14" ry="5" fill="rgba(0,0,0,0.3)" />
                  <path
                    d="M20,6 C11,6 4,13 4,22 C4,34 20,52 20,52 C20,52 36,34 36,22 C36,13 29,6 20,6 Z"
                    fill="#f97316"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                  <circle cx="20" cy="22" r="7" fill="#ffffff" />
                  <text x="20" y="26" fill="#ea580c" fontSize="11" fontWeight="bold" textAnchor="middle">
                    🚶
                  </text>
                  {/* Origin Name Tag */}
                  <rect x="-25" y="58" width="90" height="22" rx="6" fill="#0f172a" stroke="#f97316" strokeWidth="1.5" />
                  <text x="20" y="73" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">
                    {fromLocation}
                  </text>
                </g>

                {/* INTERCHANGE STATION HUB (Circle Node) */}
                <g
                  transform="translate(465, 235)"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredLegIndex('hub')}
                  onMouseLeave={() => setHoveredLegIndex(null)}
                >
                  <circle cx="0" cy="0" r="22" fill="#f59e0b" stroke="#ffffff" strokeWidth="3" opacity="0.9" />
                  <circle cx="0" cy="0" r="14" fill="#78350f" />
                  <text x="0" y="5" fill="#ffffff" fontSize="13" fontWeight="bold" textAnchor="middle">
                    🔄
                  </text>
                  {/* Hub Name Tag */}
                  <rect x="-65" y="26" width="130" height="24" rx="8" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
                  <text x="0" y="42" fill="#fef08a" fontSize="11" fontWeight="extrabold" textAnchor="middle">
                    {activeRoute?.legs?.[1]?.hub_name || 'Interchange Hub'}
                  </text>
                </g>

                {/* DESTINATION FINISH: Checkered Flag */}
                <g transform="translate(820, 440)">
                  <ellipse cx="20" cy="54" rx="18" ry="6" fill="rgba(0,0,0,0.4)" />
                  {/* Flagpole */}
                  <line x1="12" y1="10" x2="12" y2="54" stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />
                  {/* Checkered Flag Graphic */}
                  <rect x="12" y="10" width="10" height="8" fill="#ffffff" />
                  <rect x="22" y="10" width="10" height="8" fill="#0f172a" />
                  <rect x="12" y="18" width="10" height="8" fill="#0f172a" />
                  <rect x="22" y="18" width="10" height="8" fill="#ffffff" />
                  <rect x="12" y="10" width="20" height="16" fill="none" stroke="#0f172a" strokeWidth="1.5" />
                  {/* Destination Name Tag */}
                  <rect x="-35" y="58" width="110" height="22" rx="6" fill="#0f172a" stroke="#22c55e" strokeWidth="1.5" />
                  <text x="20" y="73" fill="#4ade80" fontSize="11" fontWeight="extrabold" textAnchor="middle">
                    🏁 {toLocation}
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* ── INTERACTIVE HOVER FLOATING CARD (Crucial Requirement!) ── */}
          {/* ───────────────────────────────────────────────────────────── */}
          {hoveredLegIndex !== null && (
            <div className="mt-3 p-4 bg-slate-800/95 backdrop-blur-md rounded-2xl border-2 border-blue-400 text-white shadow-2xl transition-all animate-fadeIn">
              {hoveredLegIndex === 1 && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚌</span>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                          Leg 1: Highway City Bus Services
                        </span>
                        <h5 className="text-sm font-extrabold text-white">
                          {activeRoute?.legs?.[0]?.from || fromLocation} → {activeRoute?.legs?.[0]?.to || 'Transit Hub'}
                        </h5>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                        ~{activeRoute?.legs?.[0]?.est_time_min || 35} mins
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        ~৳{activeRoute?.legs?.[0]?.est_fare_bdt || 30}
                      </span>
                    </div>
                  </div>

                  {/* Authentic Bus Names Pills */}
                  <div className="mb-2">
                    <p className="text-[11px] font-semibold text-slate-300 mb-1.5">
                      Available Authenticated Bus Lines (Board any of these):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(activeRoute?.legs?.[0]?.buses || buses).map((b, bIdx) => (
                        <div
                          key={bIdx}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-900/60 border border-blue-400/40 text-xs font-bold text-white shadow-xs"
                        >
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                          <span className="font-bengali text-sm text-yellow-300">{b.name_bn || b.name}</span>
                          {b.name && b.name !== b.name_bn && (
                            <span className="text-[10px] font-normal text-slate-300">({b.name})</span>
                          )}
                          {b.route_code && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-800 text-blue-200 font-mono">
                              {b.route_code}
                            </span>
                          )}
                          {b.fare && (
                            <span className="text-[10px] text-emerald-300 font-bold">৳{b.fare}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 italic">
                    ℹ️ {activeRoute?.legs?.[0]?.instructions || 'Board any available bus towards the hub.'}
                  </p>
                </div>
              )}

              {hoveredLegIndex === 2 && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{hasCNG ? '🛺' : hasRickshaw ? '🚲' : '🚌'}</span>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                          {hasCNG ? 'Leg 2: Auto-Rickshaw / CNG' : hasRickshaw ? 'Leg 2: Cycle-Rickshaw' : 'Leg 2: Connecting Bus Services'}
                        </span>
                        <h5 className="text-sm font-extrabold text-white">
                          {activeRoute?.legs?.[2]?.from || 'Transit Hub'} → {activeRoute?.legs?.[2]?.to || toLocation}
                        </h5>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                        ~{activeRoute?.legs?.[2]?.est_time_min || 25} mins
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        ~৳{activeRoute?.legs?.[2]?.est_fare_bdt || 30}
                      </span>
                    </div>
                  </div>

                  {/* Authentic Connecting Bus Names Pills */}
                  {activeRoute?.legs?.[2]?.buses && activeRoute.legs[2].buses.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[11px] font-semibold text-slate-300 mb-1.5">
                        Direct Onward Connecting Buses:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activeRoute.legs[2].buses.map((b, bIdx) => (
                          <div
                            key={bIdx}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-900/60 border border-purple-400/40 text-xs font-bold text-white shadow-xs"
                          >
                            <span className="w-2 h-2 rounded-full bg-purple-400" />
                            <span className="font-bengali text-sm text-yellow-300">{b.name_bn || b.name}</span>
                            {b.name && b.name !== b.name_bn && (
                              <span className="text-[10px] font-normal text-slate-300">({b.name})</span>
                            )}
                            {b.route_code && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-800 text-purple-200 font-mono">
                                {b.route_code}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Local Transports like CNG / Rickshaw */}
                  {activeRoute?.legs?.[2]?.local_transports && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {activeRoute.legs[2].local_transports.map((lt, ltIdx) => (
                        <span key={ltIdx} className="px-2.5 py-1 rounded-lg bg-emerald-900/50 border border-emerald-400/40 text-emerald-200 text-xs font-bold">
                          🛺 {lt}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-slate-300 italic">
                    ℹ️ {activeRoute?.legs?.[2]?.instructions || 'Board onward service to reach destination.'}
                  </p>
                </div>
              )}

              {hoveredLegIndex === 'metro' && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚇</span>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                          Rapid Transit: Dhaka Metro Rail (MRT Line 6)
                        </span>
                        <h5 className="text-sm font-extrabold text-white">
                          Uttara North (Diabari) ⇄ Agargaon ⇄ Motijheel
                        </h5>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 text-xs">
                      100% Traffic Jam Free · Air Conditioned
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Board the elevated high-speed Metro Rail from Mirpur-10 or Farmgate station to Uttara North (Diabari). Average train frequency is every 6–8 minutes.
                  </p>
                </div>
              )}

              {hoveredLegIndex === 'hub' && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🔄</span>
                    <h5 className="text-sm font-bold text-amber-300">
                      Interchange Hub: {activeRoute?.legs?.[1]?.hub_name || 'Central Transit Interchange'}
                    </h5>
                  </div>
                  <p className="text-xs text-slate-300">
                    {activeRoute?.legs?.[1]?.instructions || 'Alight from Leg 1, cross over to the connecting counter, and board your Leg 2 vehicle.'}
                  </p>
                </div>
              )}

              {hoveredLegIndex === 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🚶</span>
                    <h5 className="text-sm font-bold text-orange-400">
                      Feeder Leg: Walking on Foot
                    </h5>
                  </div>
                  <p className="text-xs text-slate-300">
                    Walk ~150 to 300 meters (~3-5 minutes) from your origin point to the primary bus boarding counter or feeder vehicle stand.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Mode Legend Bar ── */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400">
            <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">
              Transit Modes on Map:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              <span className="text-slate-300">🚌 City Bus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              <span className="text-slate-300">🚇 Metro Rail (MRT-6)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="text-slate-300">🛺 Auto-Rickshaw / CNG</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="text-slate-300">🚐 Shared Leguna</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-sky-400 inline-block" />
              <span className="text-slate-300">🚲 Cycle-Rickshaw</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
              <span className="text-slate-300">🚶 Walk</span>
            </div>
            <span className="ml-auto text-[11px] text-blue-400 font-medium italic">
              💡 Tip: Hover or tap any vehicle figure on the map to see bus names
            </span>
          </div>
        </div>
      )}

      {/* ── VIEW 2: STEP-BY-STEP DETAILED CARDS ── */}
      {viewMode === 'detailed' && (
        <div className="space-y-4">
          {displayLegs.map((leg, lIdx) => {
            const isMetro = leg.mode === 'metro';
            const isTransfer = leg.mode === 'transfer';
            const isWalk = leg.mode === 'walk';

            return (
              <div
                key={lIdx}
                className={`relative flex items-start gap-3.5 p-4 rounded-2xl border transition-all ${
                  isMetro
                    ? 'bg-purple-50/70 border-purple-200'
                    : isTransfer
                    ? 'bg-amber-50/70 border-amber-200'
                    : isWalk
                    ? 'bg-orange-50/70 border-orange-200'
                    : 'bg-white border-slate-200 shadow-2xs'
                }`}
              >
                {/* Step Icon Badge */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm text-white shrink-0 shadow-xs ${
                    isMetro
                      ? 'bg-purple-600'
                      : isTransfer
                      ? 'bg-amber-500'
                      : isWalk
                      ? 'bg-orange-500'
                      : 'bg-blue-600'
                  }`}
                >
                  {isMetro ? '🚇' : isTransfer ? '🔄' : isWalk ? '🚶' : '🚌'}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {leg.mode_label || `Step ${leg.step_num}`}
                    </span>
                    <div className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                      {leg.est_time_min > 0 && <span>~{leg.est_time_min} min</span>}
                      {leg.est_fare_bdt > 0 && (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                          ৳{leg.est_fare_bdt}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                    {leg.instructions}
                  </p>

                  {/* Bus Options Pill List */}
                  {leg.buses && leg.buses.length > 0 && (
                    <div className="pt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-blue-800">
                        🚌 Direct Bus Services:
                      </span>
                      {leg.buses.map((b, bIdx) => (
                        <span
                          key={bIdx}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-slate-800 text-xs font-bold shadow-2xs flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span className="font-bengali text-blue-900">{b.name_bn || b.name}</span>
                          {b.name && b.name !== b.name_bn && (
                            <span className="text-[10px] font-normal text-slate-500">
                              ({b.name})
                            </span>
                          )}
                          {b.route_code && (
                            <span className="text-[9px] px-1 bg-white rounded text-slate-600 font-mono">
                              {b.route_code}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Local transport options */}
                  {leg.local_transports && (
                    <div className="pt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-emerald-800">
                        🛺 Available Local Modes:
                      </span>
                      {leg.local_transports.map((lt, ltIdx) => (
                        <span
                          key={ltIdx}
                          className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold"
                        >
                          {lt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
