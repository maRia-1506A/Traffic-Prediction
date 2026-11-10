import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Database,
  CloudRain,
  Clock,
  Layers
} from 'lucide-react';
import { fetchHistory } from '../api.js';

export default function HistoryAnalytics() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchHistory({ page, limit, search, level: levelFilter });
      if (res.success) {
        setRecords(res.data);
        setTotal(res.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, levelFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // Export visible rows as CSV
  const handleExportCsv = () => {
    if (records.length === 0) return;
    const headers = Object.keys(records[0]).join(',');
    const rows = records.map(r => Object.values(r).map(v => `"${v}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dhaka_traffic_data_page_${page}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Analytics Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Speed vs Rush Hour Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Speed by Rush Period</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">Morning Rush (8:00 - 10:30 AM)</span>
                <span className="font-bold text-rose-400 font-mono">14.2 km/h</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div style={{ width: '38%' }} className="h-full bg-rose-500 rounded-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">Evening Peak (5:00 - 9:00 PM)</span>
                <span className="font-bold text-orange-400 font-mono">12.8 km/h</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div style={{ width: '32%' }} className="h-full bg-orange-500 rounded-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">Off-Peak / Night (10:00 PM - 6:00 AM)</span>
                <span className="font-bold text-emerald-400 font-mono">38.5 km/h</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div style={{ width: '85%' }} className="h-full bg-emerald-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Road Class Performance */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Road Hierarchy Speeds</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">Trunk / Highways</span>
                <span className="font-bold text-cyan-400 font-mono">32.4 km/h</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div style={{ width: '75%' }} className="h-full bg-cyan-500 rounded-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">Primary Arterials</span>
                <span className="font-bold text-amber-400 font-mono">24.1 km/h</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div style={{ width: '58%' }} className="h-full bg-amber-500 rounded-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">Secondary / Connectors</span>
                <span className="font-bold text-orange-400 font-mono">18.6 km/h</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div style={{ width: '45%' }} className="h-full bg-orange-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Weather Impact */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Weather Degradation</span>
            <CloudRain className="w-4 h-4 text-amber-400" />
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">Dry / Clear Sky</span>
                <span className="font-bold text-emerald-400 font-mono">Baseline (1.0x)</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div style={{ width: '100%' }} className="h-full bg-emerald-500 rounded-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">Monsoon Rain (Waterlogging)</span>
                <span className="font-bold text-rose-400 font-mono">-42% Speed (-12 km/h)</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div style={{ width: '58%' }} className="h-full bg-rose-500 rounded-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">Surface Friction (Wet Asphalt)</span>
                <span className="font-bold text-amber-400 font-mono">+25% Delay Multiplier</span>
              </div>
              <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                <div style={{ width: '75%' }} className="h-full bg-amber-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dataset Browser Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm shadow-xl space-y-4">
        {/* Table Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/70 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Live & Historical ML Dataset</h4>
              <p className="text-[11px] text-slate-400">
                Browsing <strong>{total}</strong> verified records from <code className="text-cyan-400 font-mono">traffic_data.csv</code>
              </p>
            </div>
          </div>

          {/* Search, Filter & Export */}
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                placeholder="Search records..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </form>

            <select
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Levels</option>
              <option value="NORMAL">Normal</option>
              <option value="MODERATE">Moderate / Slow</option>
              <option value="HEAVY">Heavy</option>
              <option value="SEVERE">Severe</option>
            </select>

            <button
              onClick={handleExportCsv}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition disabled:opacity-50"
              title="Export Current Page as CSV"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                <th className="py-2.5 px-3 font-semibold">Route / Corridor</th>
                <th className="py-2.5 px-3 font-semibold">OSM ID</th>
                <th className="py-2.5 px-3 font-semibold">Speed</th>
                <th className="py-2.5 px-3 font-semibold">Delay</th>
                <th className="py-2.5 px-3 font-semibold">Level</th>
                <th className="py-2.5 px-3 font-semibold">Weather</th>
                <th className="py-2.5 px-3 font-semibold">Road Type</th>
                <th className="py-2.5 px-3 font-semibold">Lanes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-slate-400">
                    Loading dataset records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-slate-500">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => {
                  const level = (r.traffic_level || 'NORMAL').toUpperCase();
                  return (
                    <tr key={idx} className="hover:bg-slate-900/50 transition">
                      <td className="py-2 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {r.timestamp}
                      </td>
                      <td className="py-2 px-3 font-semibold text-white whitespace-nowrap">
                        {r.road_route_id}
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">
                        {r.osm_id}
                      </td>
                      <td className="py-2 px-3 text-cyan-400 font-semibold font-mono">
                        {r.traffic_speed_kmh} <span className="text-[10px] text-slate-500 font-normal">km/h</span>
                      </td>
                      <td className="py-2 px-3 text-amber-400 font-mono">
                        +{r.traffic_delay_min}m
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          level === 'SEVERE' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                          level === 'HEAVY' ? 'bg-orange-950 text-orange-400 border border-orange-800' :
                          level === 'MODERATE' || level === 'SLOW' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                          'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}>
                          {level}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {r.weather || 'Cloudy'} ({r.temperature_c}°C)
                      </td>
                      <td className="py-2 px-3 text-slate-400">
                        {r.road_type}
                      </td>
                      <td className="py-2 px-3 text-slate-400">
                        {r.num_lanes || 2}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
          <span>
            Page <strong className="text-white">{page}</strong> of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

