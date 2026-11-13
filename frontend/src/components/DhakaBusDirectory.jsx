import React, { useState, useEffect } from 'react';
import { ALL_DHAKA_LOCATIONS } from '../utils/journeyPredictor.js';

export default function DhakaBusDirectory() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search mode: 'route' (From -> To) or 'keyword' (Search by Name / Stop)
  const [searchMode, setSearchMode] = useState('route');

  // Route search state
  const [fromLoc, setFromLoc] = useState('Savar');
  const [toLoc, setToLoc] = useState('Mirpur 10');
  const [routeResult, setRouteResult] = useState(null);
  const [routeSearching, setRouteSearching] = useState(false);
  const [activeTransferTab, setActiveTransferTab] = useState(0);

  // Keyword search state
  const [keyword, setKeyword] = useState('');
  const [expandedBusId, setExpandedBusId] = useState(null);

  // Load master bus directory on mount
  useEffect(() => {
    async function loadMasterBuses() {
      try {
        setLoading(true);
        const res = await fetch('/api/buses');
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            setBuses(json.data || []);
          }
        }
      } catch (err) {
        setError('Could not load Dhaka bus directory: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadMasterBuses();
  }, []);

  // Trigger initial route search for Savar -> Mirpur 10 on mount
  useEffect(() => {
    handleSearchRoute();
  }, []);

  const handleSearchRoute = async (e) => {
    if (e) e.preventDefault();
    if (!fromLoc || !toLoc) return;

    setRouteSearching(true);
    setError(null);

    try {
      const res = await fetch(`/api/buses?from=${encodeURIComponent(fromLoc)}&to=${encodeURIComponent(toLoc)}`);
      if (res.ok) {
        const json = await res.json();
        setRouteResult(json);
      } else {
        setRouteResult({
          available: false,
          count: 0,
          from: fromLoc,
          to: toLoc,
          buses: [],
          message: `No direct bus is available for this route (${fromLoc} → ${toLoc}).`
        });
      }
    } catch (err) {
      setError('Search failed. Please ensure the backend server is running.');
    } finally {
      setRouteSearching(false);
    }
  };

  const handleSwap = () => {
    setFromLoc(toLoc);
    setToLoc(fromLoc);
  };

  const toggleExpand = (id) => {
    setExpandedBusId(prev => (prev === id ? null : id));
  };

  // Filtered list for keyword search
  const filteredBuses = buses.filter(b => {
    if (!keyword.trim()) return true;
    const q = keyword.toLowerCase().trim();
    const nameMatch = (b.name && b.name.toLowerCase().includes(q)) || (b.name_bn && b.name_bn.includes(q));
    const codeMatch = (b.route_code && b.route_code.toLowerCase().includes(q));
    const stopsMatch = (b.stoppages || []).some(s => s.toLowerCase().includes(q));
    const originMatch = (b.origin && b.origin.toLowerCase().includes(q)) || (b.destination && b.destination.toLowerCase().includes(q));
    return nameMatch || codeMatch || stopsMatch || originMatch;
  });

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-emerald-600/20 shrink-0">
              🚌
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                  Dhaka Bus Route Directory
                </h1>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  DTCA Verified
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Authentic route-wise public bus network across Greater Dhaka with fares, schedules & stoppages
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 self-start sm:self-auto text-xs font-semibold">
            <button
              onClick={() => setSearchMode('route')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                searchMode === 'route'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Route Finder (A → B)
            </button>
            <button
              onClick={() => setSearchMode('keyword')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                searchMode === 'keyword'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Browse All ({buses.length})
            </button>
          </div>
        </div>
      </div>

      {/* ── MODE 1: Point to Point (A to B) Route Query ── */}
      {searchMode === 'route' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-2">
              <span>Find Direct Buses Between Any Two Locations</span>
              <span className="text-[11px] font-normal text-slate-400 capitalize">
                (Real-time stoppage matching)
              </span>
            </h2>

            <form onSubmit={handleSearchRoute} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Origin */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Initial Place (Start Point / কোথা থেকে)
                </label>
                <input
                  type="text"
                  list="dhaka-origin-stops"
                  value={fromLoc}
                  onChange={(e) => setFromLoc(e.target.value)}
                  placeholder="e.g. Savar, Chandra, Gabtoli..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                />
                <datalist id="dhaka-origin-stops">
                  {ALL_DHAKA_LOCATIONS.map(loc => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>

              {/* Swap Button */}
              <div className="sm:col-span-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors"
                  title="Swap Origin and Destination"
                >
                  ⇄
                </button>
              </div>

              {/* Destination */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Destination (End Point / কোথায় যাবেন)
                </label>
                <input
                  type="text"
                  list="dhaka-dest-stops"
                  value={toLoc}
                  onChange={(e) => setToLoc(e.target.value)}
                  placeholder="e.g. Mirpur 10, Farmgate, Motijheel..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                />
                <datalist id="dhaka-dest-stops">
                  {ALL_DHAKA_LOCATIONS.map(loc => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>

              {/* Search Button */}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={routeSearching}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {routeSearching ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <span>Search Bus</span>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Popular Routes Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-medium">Popular:</span>
              {[
                ['Badda', 'Ashulia'],
                ['Savar', 'Mirpur 10'],
                ['Savar', 'Motijheel'],
                ['Mirpur 10', 'Farmgate'],
                ['Uttara', 'Sayedabad'],
                ['Mohammadpur', 'Abdullahpur'],
                ['Gazipur', 'Sadarghat']
              ].map(([o, d]) => (
                <button
                  key={`${o}-${d}`}
                  type="button"
                  onClick={() => {
                    setFromLoc(o);
                    setToLoc(d);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 text-slate-600 text-xs font-medium transition-colors"
                >
                  {o} → {d}
                </button>
              ))}
            </div>
          </div>

          {/* ── Route Search Results ── */}
          {routeResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Query Results for <span className="text-emerald-700">{routeResult.from}</span> → <span className="text-emerald-700">{routeResult.to}</span>
                </h3>
                {routeResult.available && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {routeResult.count} Direct Service{routeResult.count > 1 ? 's' : ''} Available
                  </span>
                )}
              </div>

              {routeResult.available && routeResult.buses && routeResult.buses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {routeResult.buses.map((bus) => {
                    const isExpanded = expandedBusId === bus.id;
                    const stops = bus.journey_stoppages || [];

                    return (
                      <div
                        key={bus.id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-lg font-bold text-slate-900 leading-tight">
                                {bus.name_bn || bus.name}
                              </h4>
                              {bus.name && bus.name !== bus.name_bn && (
                                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                  {bus.name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {bus.route_code && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  {bus.route_code}
                                </span>
                              )}
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {bus.type}
                              </span>
                            </div>
                          </div>

                          {/* Quick Stats Grid */}
                          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Fare</span>
                              <span className="text-sm font-bold text-emerald-700 block mt-0.5">
                                ৳{bus.fare_bdt || 25}
                              </span>
                            </div>

                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Frequency</span>
                              <span className="text-sm font-bold text-slate-800 block mt-0.5">
                                ~{bus.frequency_min} min
                              </span>
                            </div>

                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Trip Stops</span>
                              <span className="text-sm font-bold text-blue-700 block mt-0.5">
                                {bus.stops_on_journey} Stops
                              </span>
                            </div>
                          </div>

                          {/* Origin & Destination Stops */}
                          <div className="mt-3.5 space-y-1.5 text-xs text-slate-700 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span className="text-slate-400 text-[11px]">Board:</span>
                              <span className="font-semibold truncate">{bus.from_stop}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              <span className="text-slate-400 text-[11px]">Dropoff:</span>
                              <span className="font-semibold truncate">{bus.to_stop}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 text-[11px] pt-1 border-t border-slate-200/60">
                              <span>⏰ Service Hours: {bus.operating_hours}</span>
                            </div>
                          </div>

                          {/* Expandable Stoppages */}
                          {stops.length > 0 && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => toggleExpand(bus.id)}
                                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 focus:outline-none"
                              >
                                <span>{isExpanded ? 'Hide Route Details' : `Show All ${stops.length} Journey Stops`}</span>
                                <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                              </button>

                              {isExpanded && (
                                <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {stops.map((s, idx) => (
                                      <React.Fragment key={idx}>
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                          idx === 0
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                                            : idx === stops.length - 1
                                            ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
                                            : 'bg-white text-slate-700 border-slate-200'
                                        }`}>
                                          {s}
                                        </span>
                                        {idx < stops.length - 1 && (
                                          <span className="text-slate-400 text-[10px]">→</span>
                                        )}
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {bus.operator && (
                          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>Operator: {bus.operator}</span>
                            <span className="text-emerald-600 font-medium">Daily Direct</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* No Direct Bus Available -> Rich Multi-Modal Connecting Transit Options */
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-slate-800">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shrink-0">
                        ℹ️
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-slate-900">
                          No direct bus is available for this route ({routeResult.from} → {routeResult.to})
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          Currently, no single bus operates direct from <strong>{routeResult.from}</strong> to <strong>{routeResult.to}</strong>.
                          Explore the recommended connecting transit routes below using <strong>2-bus transfers</strong>, <strong>Dhaka Metro Rail (MRT-6)</strong>, and local feeder transit (Auto-rickshaw, CNG, Rickshaw):
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Transfer Routes Tabs */}
                  {routeResult.transfer_routes && routeResult.transfer_routes.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {routeResult.transfer_routes.map((tr, trIdx) => {
                          const isSel = trIdx === activeTransferTab;
                          return (
                            <button
                              key={tr.id}
                              type="button"
                              onClick={() => setActiveTransferTab(trIdx)}
                              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                                isSel
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <span>{tr.type === 'metro_multimodal' ? '🚇' : '🚌'}</span>
                              <span className="font-bold">{tr.title}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                isSel ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                ~{tr.total_est_time_min}m · ৳{tr.total_est_fare_bdt}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Transfer Route Card */}
                      {(() => {
                        const activeTR = routeResult.transfer_routes[activeTransferTab] || routeResult.transfer_routes[0];
                        if (!activeTR) return null;

                        return (
                          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-base font-bold text-slate-900">
                                    {activeTR.title}
                                  </h4>
                                  {activeTR.tag && (
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                      activeTR.type === 'metro_multimodal'
                                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}>
                                      {activeTR.tag}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {activeTR.summary}
                                </p>
                              </div>

                              <div className="flex items-center gap-3 text-xs bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100 shrink-0 self-start sm:self-auto">
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Est. Travel Time</span>
                                  <span className="font-bold text-slate-800 text-sm">~{activeTR.total_est_time_min} mins</span>
                                </div>
                                <div className="w-px h-6 bg-slate-200"></div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Total Fare</span>
                                  <span className="font-bold text-emerald-700 text-sm">~৳{activeTR.total_est_fare_bdt}</span>
                                </div>
                              </div>
                            </div>

                            {/* Stepper */}
                            <div className="space-y-3.5">
                              {activeTR.legs.map((leg) => {
                                const isMetro = leg.mode === 'metro';
                                const isTransfer = leg.mode === 'transfer';

                                return (
                                  <div
                                    key={leg.step_num}
                                    className={`flex items-start gap-3 p-4 rounded-xl border ${
                                      isMetro
                                        ? 'bg-purple-50/70 border-purple-200'
                                        : isTransfer
                                        ? 'bg-amber-50/70 border-amber-200'
                                        : 'bg-slate-50/80 border-slate-200'
                                    }`}
                                  >
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                      isMetro
                                        ? 'bg-purple-600 text-white shadow-xs'
                                        : isTransfer
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'bg-blue-600 text-white shadow-xs'
                                    }`}>
                                      {leg.step_num}
                                    </div>

                                    <div className="flex-1 space-y-1.5">
                                      <div className="flex flex-wrap items-center justify-between gap-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                            {leg.mode_label}
                                          </span>
                                          {leg.mode_icon && <span>{leg.mode_icon}</span>}
                                        </div>

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

                                      {/* Buses */}
                                      {leg.buses && leg.buses.length > 0 && (
                                        <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                                          <span className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
                                            🚌 Direct Bus Services:
                                          </span>
                                          {leg.buses.map((b, bIdx) => (
                                            <span
                                              key={bIdx}
                                              className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-slate-800 text-xs font-bold shadow-2xs flex items-center gap-1"
                                            >
                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                              {b.name_bn || b.name}
                                              {b.name && b.name !== b.name_bn && (
                                                <span className="text-[10px] font-normal text-slate-400">
                                                  ({b.name})
                                                </span>
                                              )}
                                              {b.route_code && (
                                                <span className="text-[9px] px-1 bg-slate-100 rounded text-slate-500">
                                                  {b.route_code}
                                                </span>
                                              )}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Shared Bus & Leguna Services */}
                                      {leg.shared_transit_services && leg.shared_transit_services.length > 0 && (
                                        <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                                          <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                                            🚐 Shared Bus / Leguna:
                                          </span>
                                          {leg.shared_transit_services.map((st, stIdx) => (
                                            <span
                                              key={stIdx}
                                              className="px-2.5 py-1 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-950 text-xs font-bold shadow-2xs flex items-center gap-1"
                                            >
                                              🚐 {st.name_bn || st.name}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Local Transports */}
                                      {leg.local_transports && leg.local_transports.length > 0 && (
                                        <div className="pt-1 flex flex-wrap items-center gap-1.5">
                                          <span className="text-[11px] font-medium text-slate-500">
                                            Available Local Modes:
                                          </span>
                                          {leg.local_transports.map((lt, ltIdx) => (
                                            <span
                                              key={ltIdx}
                                              className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold"
                                            >
                                              🛺 {lt}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Metro Line Details */}
                                      {leg.metro_line && (
                                        <div className="pt-1 flex items-center gap-2">
                                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white">
                                            MRT LINE 6
                                          </span>
                                          <span className="text-[11px] text-purple-700 font-medium">
                                            {leg.from} → {leg.to}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : routeResult.transfer_suggestion && (
                    <div className="mt-3 p-4 rounded-xl bg-white border border-amber-200/80 shadow-2xs space-y-1">
                      <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                        Suggested Transit Interchange:
                      </p>
                      <p className="text-sm font-bold text-slate-800">
                        {routeResult.transfer_suggestion.interchange_hub}
                      </p>
                      <p className="text-xs text-slate-600">
                        {routeResult.transfer_suggestion.guidance}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODE 2: Comprehensive Dhaka Bus Master Catalog ── */}
      {searchMode === 'keyword' && (
        <div className="space-y-4">
          {/* Keyword Search Input */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex items-center gap-3">
            <span className="text-slate-400 text-lg">🔍</span>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search by bus name (e.g. ইতিহাস, রাজধানী, বৈশাখী, Welcome) or stoppage (Gabtoli, Savar)..."
              className="w-full text-sm font-medium text-slate-800 focus:outline-none"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 rounded"
              >
                Clear
              </button>
            )}
          </div>

          {/* Bus Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBuses.map((bus) => {
              const isExpanded = expandedBusId === bus.id;
              const stops = bus.stoppages || [];

              return (
                <div
                  key={bus.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-base font-bold text-slate-900 font-bengali">
                          {bus.name_bn || bus.name}
                        </h4>
                        {bus.name && bus.name !== bus.name_bn && (
                          <p className="text-xs text-slate-500 font-medium">
                            {bus.name}
                          </p>
                        )}
                      </div>
                      {bus.route_code && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                          {bus.route_code}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-emerald-800 mt-2 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      {bus.origin} ⇄ {bus.destination}
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Fare Range</span>
                        <span className="font-bold text-slate-800">৳{bus.fare_min_bdt || 15} - ৳{bus.fare_max_bdt || 45}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Frequency</span>
                        <span className="font-bold text-slate-800">Every {bus.frequency_min}m</span>
                      </div>
                    </div>

                    {/* Stoppages */}
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(bus.id)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 focus:outline-none"
                      >
                        <span>{isExpanded ? 'Hide Stoppages' : `View ${stops.length} Stoppages`}</span>
                        <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs max-h-48 overflow-y-auto">
                          <div className="flex flex-wrap gap-1">
                            {stops.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[11px]"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
                    Operating: {bus.first_bus || '06:00 AM'} - {bus.last_bus || '11:00 PM'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

