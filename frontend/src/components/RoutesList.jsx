import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Navigation,
  ArrowRight,
  Clock,
  Gauge,
  Compass,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';

export default function RoutesList({ routes = [], onSelectRoute, onTestBypass }) {
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [sortBy, setSortBy] = useState('code'); // 'code', 'delay', 'speed', 'distance'
  const [expandedId, setExpandedId] = useState(null);

  const filteredRoutes = useMemo(() => {
    let list = [...routes];

    if (filterLevel !== 'ALL') {
      list = list.filter(r => (r.traffic_level || '').toUpperCase() === filterLevel);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.route_code.toLowerCase().includes(q) ||
        r.route_id.toLowerCase().includes(q) ||
        r.origin_name.toLowerCase().includes(q) ||
        r.dest_name.toLowerCase().includes(q) ||
        (r.route_path && r.route_path.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'delay') {
      list.sort((a, b) => (b.traffic_delay_min || 0) - (a.traffic_delay_min || 0));
    } else if (sortBy === 'speed') {
      list.sort((a, b) => (b.traffic_speed_kmh || 0) - (a.traffic_speed_kmh || 0));
    } else if (sortBy === 'distance') {
      list.sort((a, b) => (b.road_length_km || 0) - (a.road_length_km || 0));
    } else {
      list.sort((a, b) => a.route_code.localeCompare(b.route_code));
    }

    return list;
  }, [routes, search, filterLevel, sortBy]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800 backdrop-blur-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by corridor (e.g. Mirpur, Uttara, Farmgate, R06)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {['ALL', 'NORMAL', 'MODERATE', 'HEAVY', 'SEVERE'].map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition ${
                filterLevel === lvl
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800/80'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="code">Route Code (R01-R50)</option>
            <option value="delay">Highest Delay</option>
            <option value="speed">Highest Speed</option>
            <option value="distance">Longest Distance</option>
          </select>
        </div>
      </div>

      {/* Corridor Count */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Showing <strong className="text-white">{filteredRoutes.length}</strong> of {routes.length} Corridors</span>
        <span>Tap any corridor to view intermediate waypoints or trigger jam bypass</span>
      </div>

      {/* Corridors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredRoutes.map(route => {
          const isExpanded = expandedId === route.route_code;
          const level = (route.traffic_level || 'NORMAL').toUpperCase();

          const badgeClasses =
            level === 'SEVERE' ? 'bg-rose-950/80 text-rose-400 border-rose-800/80' :
            level === 'HEAVY' ? 'bg-orange-950/80 text-orange-400 border-orange-800/80' :
            level === 'MODERATE' ? 'bg-amber-950/80 text-amber-400 border-amber-800/80' :
            'bg-emerald-950/80 text-emerald-400 border-emerald-800/80';

          return (
            <div
              key={route.route_code}
              className="bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 transition duration-200 shadow-sm backdrop-blur-sm"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg text-xs font-extrabold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                    {route.route_code}
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${badgeClasses}`}>
                    {level}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectRoute && onSelectRoute(route)}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition"
                    title="View on Map"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onTestBypass && onTestBypass(route)}
                    className="p-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-400 border border-cyan-800/50 transition"
                    title="Run Bypass Advisor"
                  >
                    <Compass className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Title & Origin-Dest */}
              <div className="mt-2.5">
                <div className="text-sm font-semibold text-white flex items-center gap-1.5 flex-wrap">
                  <span>{route.origin_name}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>{route.dest_name}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {route.road_type} • {route.num_lanes || 4} Lanes • {route.road_length_km} km
                </div>
              </div>

              {/* Metrics strip */}
              <div className="mt-3 grid grid-cols-4 gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 text-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Speed</div>
                  <div className="font-bold text-cyan-400 mt-0.5">{route.traffic_speed_kmh} <span className="text-[9px] font-normal text-slate-500">km/h</span></div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Delay</div>
                  <div className={`font-bold mt-0.5 ${route.traffic_delay_min > 5 ? 'text-rose-400' : route.traffic_delay_min > 2 ? 'text-amber-400' : 'text-slate-300'}`}>
                    +{route.traffic_delay_min} <span className="text-[9px] font-normal text-slate-500">m</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">ETA</div>
                  <div className="font-bold text-slate-200 mt-0.5">{route.travel_time_min} <span className="text-[9px] font-normal text-slate-500">m</span></div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Congestion</div>
                  <div className="font-bold text-slate-200 mt-0.5">{route.congestion_ratio}x</div>
                </div>
              </div>

              {/* Expand Toggle for Waypoints */}
              <button
                onClick={() => toggleExpand(route.route_code)}
                className="mt-3 w-full flex items-center justify-between text-[11px] font-medium text-slate-400 hover:text-slate-200 pt-2 border-t border-slate-800/60 transition"
              >
                <span>Waypoints Path ({route.waypoints?.length || 0} nodes)</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {/* Expanded Waypoints */}
              {isExpanded && (
                <div className="mt-2.5 p-2.5 bg-slate-950/90 rounded-xl border border-slate-800 text-xs animate-in fade-in duration-150">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 tracking-wider">
                    Full Corridor Sequence
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {route.waypoints?.map((wp, i) => (
                      <React.Fragment key={i}>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          i === 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' :
                          i === route.waypoints.length - 1 ? 'bg-rose-950 text-rose-400 border border-rose-800/60' :
                          'bg-slate-900 text-slate-300 border border-slate-800'
                        }`}>
                          {wp.name}
                        </span>
                        {i < route.waypoints.length - 1 && (
                          <span className="text-slate-600">&rarr;</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => onSelectRoute && onSelectRoute(route)}
                      className="px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition"
                    >
                      Locate on Map
                    </button>
                    <button
                      onClick={() => onTestBypass && onTestBypass(route)}
                      className="px-2.5 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition"
                    >
                      Evaluate Jam Detours
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

