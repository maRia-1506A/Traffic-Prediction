import React, { useState, useEffect } from 'react';
import {
  Compass,
  ArrowRight,
  Zap,
  Clock,
  Navigation,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Sliders,
  TrendingUp,
  MapPin
} from 'lucide-react';
import { evaluateBypassAdvisor } from '../api.js';

export default function RouteAdvisor({ routes = [], waypoints = [], initialRoute, onSelectRoute }) {
  const [mode, setMode] = useState('corridor'); // 'corridor' or 'custom'
  const [selectedRouteCode, setSelectedRouteCode] = useState(initialRoute?.route_code || 'R06');
  const [originName, setOriginName] = useState('Mirpur 10');
  const [destName, setDestName] = useState('Farmgate');
  const [delayThreshold, setDelayThreshold] = useState(3.0);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  // Sync when initialRoute changes
  useEffect(() => {
    if (initialRoute) {
      setSelectedRouteCode(initialRoute.route_code);
      setOriginName(initialRoute.origin_name);
      setDestName(initialRoute.dest_name);
      setMode('corridor');
      handleAnalyze(initialRoute.route_code);
    }
  }, [initialRoute]);

  const handleAnalyze = async (codeOverride = null) => {
    setLoading(true);
    setError(null);

    try {
      let payload = {
        delayThreshold
      };

      if (mode === 'corridor' || codeOverride) {
        payload.routeCode = codeOverride || selectedRouteCode;
      } else {
        const origWp = waypoints.find(w => w.name === originName);
        const destWp = waypoints.find(w => w.name === destName);
        if (!origWp || !destWp) {
          throw new Error('Please select valid origin and destination waypoints');
        }
        payload.originCoords = [origWp.lat, origWp.lon];
        payload.destCoords = [destWp.lat, destWp.lon];
        payload.routeName = `${originName} -> ${destName}`;
      }

      const res = await evaluateBypassAdvisor(payload);
      if (res.success) {
        setReport(res.data);
      } else {
        setError(res.error || 'Failed to evaluate route');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run on mount once
  useEffect(() => {
    handleAnalyze();
  }, []);

  return (
    <div className="space-y-5">
      {/* Configuration Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-600/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Alternative Route & Jam Bypass Suggester</h3>
              <p className="text-xs text-slate-400">
                Calculates fastest OpenStreetMap bypasses (Flyovers, Expressways) when excessive delays occur.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setMode('corridor')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                mode === 'corridor' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              50 Official Corridors
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                mode === 'custom' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom Waypoints (118 Nodes)
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {mode === 'corridor' ? (
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Select Corridor to Monitor:
              </label>
              <select
                value={selectedRouteCode}
                onChange={(e) => setSelectedRouteCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {routes.map(r => (
                  <option key={r.route_code} value={r.route_code}>
                    {r.route_code}: {r.origin_name} &rarr; {r.dest_name} ({r.road_length_km} km)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Origin Landmark:</label>
                <select
                  value={originName}
                  onChange={(e) => setOriginName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {waypoints.map(w => (
                    <option key={w.name} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Destination Landmark:</label>
                <select
                  value={destName}
                  onChange={(e) => setDestName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {waypoints.map(w => (
                    <option key={w.name} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Delay Sensitivity Slider & Action Button */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span className="font-semibold">Delay Threshold:</span>
              <span className="font-bold text-amber-400">+{delayThreshold} min</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="15.0"
              step="0.5"
              value={delayThreshold}
              onChange={(e) => setDelayThreshold(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-950 rounded-lg"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => handleAnalyze()}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
          >
            <Compass className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Evaluating Corridors...' : 'Analyze & Discover Jam Bypasses'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Advisory Report View */}
      {report && (
        <div className="space-y-4">
          {/* Recommendation Banner */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3.5 backdrop-blur-md shadow-lg ${
            report.is_excessive_jam
              ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
              : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
          }`}>
            {report.is_excessive_jam ? (
              <Flame className="w-6 h-6 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm tracking-tight text-white mb-0.5">
                {report.is_excessive_jam ? 'Congestion Bypass Activated' : 'Flowing Optimal'}
              </div>
              <p className="text-xs leading-relaxed opacity-95">
                {report.recommendation}
              </p>
            </div>
          </div>

          {/* Primary Route vs Best Bypass Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Route Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Primary Corridor</span>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase border ${
                  report.primary.traffic_level === 'SEVERE' ? 'bg-rose-950 text-rose-400 border-rose-800' :
                  report.primary.traffic_level === 'HEAVY' ? 'bg-orange-950 text-orange-400 border-orange-800' :
                  report.primary.traffic_level === 'MODERATE' ? 'bg-amber-950 text-amber-400 border-amber-800' :
                  'bg-emerald-950 text-emerald-400 border-emerald-800'
                }`}>
                  {report.primary.traffic_level}
                </span>
              </div>

              <h4 className="text-sm font-bold text-white mb-3">{report.primary.name}</h4>

              <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">ETA</div>
                  <div className="text-sm font-extrabold text-white mt-0.5">{report.primary.travel_time_min}m</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Delay</div>
                  <div className="text-sm font-extrabold text-amber-400 mt-0.5">+{report.primary.traffic_delay_min}m</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium">Speed</div>
                  <div className="text-sm font-extrabold text-cyan-400 mt-0.5">{report.primary.traffic_speed_kmh} <span className="text-[9px] font-normal text-slate-400">km/h</span></div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Direct Distance: {report.primary.distance_km} km</span>
                <span>Free-Flow Time: {report.primary.free_flow_time_min}m</span>
              </div>
            </div>

            {/* Best Alternative Card */}
            {report.best_alternative ? (
              <div className="bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-slate-900/60 border border-cyan-800/60 rounded-2xl p-4 backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 fill-cyan-400" />
                    Recommended Fast Bypass
                  </span>
                  {report.best_alternative.time_saved_min > 0 && (
                    <span className="px-2 py-0.5 rounded-full font-extrabold text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ⚡ Saves {report.best_alternative.time_saved_min} mins
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-white mb-3">{report.best_alternative.name}</h4>

                <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-xl border border-cyan-900/40 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">Bypass ETA</div>
                    <div className="text-sm font-extrabold text-emerald-400 mt-0.5">{report.best_alternative.travel_time_min}m</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">Time Saved</div>
                    <div className="text-sm font-extrabold text-cyan-400 mt-0.5">{report.best_alternative.time_saved_min}m</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">Transit Speed</div>
                    <div className="text-sm font-extrabold text-white mt-0.5">{report.best_alternative.traffic_speed_kmh} <span className="text-[9px] font-normal text-slate-400">km/h</span></div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Detour Distance: {report.best_alternative.distance_km} km</span>
                  <span className="text-cyan-400 font-semibold">{report.best_alternative.tag} Network</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mb-2" />
                <h4 className="text-sm font-semibold text-white">No Bypass Detour Needed</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  The primary corridor transit is already optimal.
                </p>
              </div>
            )}
          </div>

          {/* All Evaluated Alternatives Table */}
          {report.alternatives && report.alternatives.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                All Evaluated Strategic Dhaka Bypasses
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="pb-2 font-medium">Bypass Route</th>
                      <th className="pb-2 font-medium">Infrastructure</th>
                      <th className="pb-2 font-medium">Distance</th>
                      <th className="pb-2 font-medium">Transit Speed</th>
                      <th className="pb-2 font-medium">ETA</th>
                      <th className="pb-2 font-medium">Time Saved</th>
                      <th className="pb-2 font-medium">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {report.alternatives.map((alt, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 font-semibold text-white">{alt.name}</td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950 text-slate-300 border border-slate-800">
                            {alt.tag}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-300">{alt.distance_km} km</td>
                        <td className="py-2.5 text-cyan-400 font-semibold">{alt.traffic_speed_kmh} km/h</td>
                        <td className="py-2.5 text-white font-bold">{alt.travel_time_min} min</td>
                        <td className="py-2.5">
                          {alt.time_saved_min > 0 ? (
                            <span className="text-emerald-400 font-bold">+{alt.time_saved_min} min</span>
                          ) : (
                            <span className="text-slate-500">{alt.time_saved_min} min</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          {alt.is_faster ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Faster Detour
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Equal / Slower</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

