import React, { useState, useEffect, useMemo } from 'react';
import { fetchHistory } from '../api.js';
import { ALL_ROUTES } from '../utils/dhakaRoutesData.js';

// Simple bar chart component (no external library needed)
function BarChart({ data, colorMap, title }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <div className="space-y-1.5">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-20 text-right shrink-0 truncate">{d.label}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max((d.value / max) * 100, 1)}%`,
                  backgroundColor: colorMap?.[d.label] || '#3b82f6',
                }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700 w-12 text-right">{d.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Full interactive corridor list showing all routes from most data to least
function RouteRecordsList({ routes }) {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('MOST_DATA');

  const filtered = useMemo(() => {
    let list = routes || [];
    if (filter === 'OFFICIAL') {
      list = list.filter(r => {
        const num = r.code_num || parseInt((r.route_code || '').replace('R', ''), 10);
        return !isNaN(num) && num <= 50;
      });
    } else if (filter === 'EXTENDED') {
      list = list.filter(r => {
        const num = r.code_num || parseInt((r.route_code || '').replace('R', ''), 10);
        return isNaN(num) || num > 50;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(r =>
        (r.route_code || '').toLowerCase().includes(q) ||
        (r.route_name || '').toLowerCase().includes(q) ||
        (r.label || '').toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    if (sortBy === 'MOST_DATA') {
      sorted.sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value;
        return a.code_num - b.code_num;
      });
    } else if (sortBy === 'ROUTE_NUM') {
      sorted.sort((a, b) => a.code_num - b.code_num);
    } else if (sortBy === 'LEAST_DATA') {
      sorted.sort((a, b) => {
        if (a.value !== b.value) return a.value - b.value;
        return a.code_num - b.code_num;
      });
    } else if (sortBy === 'CONGESTION') {
      sorted.sort((a, b) => {
        if (b.pct !== a.pct) return b.pct - a.pct;
        return b.value - a.value;
      });
    }

    return sorted;
  }, [routes, filter, search, sortBy]);

  const maxVal = Math.max(...(routes || []).map(r => r.value), 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Records by Route</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            All {routes.length} corridors from R01 to R98 ({filtered.length} shown)
          </p>
        </div>

        {/* Filter & Sort controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {[
              { id: 'ALL', label: `All (${routes.length})` },
              { id: 'OFFICIAL', label: 'Official 50' },
              { id: 'EXTENDED', label: 'Extended (48)' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  filter === tab.id
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-400 pl-1.5 pr-0.5 text-[11px] font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-white text-slate-700 font-semibold text-xs rounded-md px-2 py-0.5 border-0 focus:ring-0 focus:outline-none shadow-xs cursor-pointer"
            >
              <option value="MOST_DATA">Most Data to Least</option>
              <option value="ROUTE_NUM">Route ID (R01 → R98)</option>
              <option value="LEAST_DATA">Least Data to Most</option>
              <option value="CONGESTION">Highest Congestion %</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Search corridor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-32 sm:w-40"
          />
        </div>
      </div>

      {/* Routes List */}
      <div className="max-h-[580px] overflow-y-auto space-y-2 pr-1.5">
        {filtered.map((r, idx) => {
          const widthPct = Math.max((r.value / maxVal) * 100, 1.5);
          return (
            <div
              key={r.route_id}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50/80 transition-colors"
            >
              {/* Rank */}
              <span className="w-7 text-right text-[11px] font-bold text-slate-400 shrink-0">
                #{idx + 1}
              </span>

              {/* Code */}
              <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 font-mono border border-blue-100">
                {r.route_code || 'Route'}
              </span>

              {/* Corridor Path */}
              <span className="w-48 sm:w-60 text-xs font-medium text-slate-700 truncate shrink-0" title={r.route_name || r.label}>
                {r.route_name || r.label}
              </span>

              {/* Bar */}
              <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden relative">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${widthPct}%` }}
                />
              </div>

              {/* Count */}
              <span className="text-xs font-bold text-slate-800 w-16 text-right shrink-0">
                {r.value.toLocaleString()}
              </span>

              {/* Congested % */}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded w-20 text-center shrink-0 ${
                r.pct >= 50
                  ? 'bg-red-50 text-red-600 border border-red-100'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {r.pct}% jam
              </span>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">
            No corridors match &quot;{search}&quot;
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrafficInsights() {
  const [records, setRecords]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [isSyncing, setIsSyncing]       = useState(false);
  const [lastSynced, setLastSynced]     = useState(null);
  const [autoSync, setAutoSync]         = useState(true);
  const [syncIntervalSec, setSyncIntervalSec] = useState(20);
  const [error, setError]               = useState(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isOffline, setIsOffline]       = useState(false);
  const [peakSortMode, setPeakSortMode] = useState('volume'); // 'volume' | 'severity'

  const loadData = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setIsSyncing(true);
    }
    setError(null);
    try {
      const res = await fetchHistory({ page: 1, limit: 10000, all: true });
      if (res && res.success) {
        setRecords(res.data || []);
        setTotalRecords(res.total || res.data?.length || 0);
        setIsOffline(Boolean(res.isOffline));
        setLastSynced(new Date());
      }
    } catch (e) {
      console.warn('History load error:', e);
      if (isInitial) {
        setError('Could not load historical data. Make sure the backend server is running.');
      }
    } finally {
      if (isInitial) setLoading(false);
      setIsSyncing(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadData(true);
  }, []);

  // Periodic auto-sync
  useEffect(() => {
    if (!autoSync) return;
    const interval = setInterval(() => {
      loadData(false);
    }, syncIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [autoSync, syncIntervalSec]);

  // Format sync timestamp
  const formatSyncTime = (date) => {
    if (!date) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Compute stats from records
  const stats = useMemo(() => {
    if (!records.length) return null;

    // Traffic level distribution
    const levelCounts = { NORMAL: 0, SLOW: 0, TRAFFIC_JAM: 0 };
    records.forEach(r => {
      const lvl = (r.traffic_level || '').toUpperCase();
      if (lvl === 'NORMAL')      levelCounts.NORMAL++;
      else if (lvl === 'SLOW' || lvl === 'MODERATE') levelCounts.SLOW++;
      else if (lvl === 'TRAFFIC_JAM' || lvl === 'HEAVY' || lvl === 'SEVERE') levelCounts.TRAFFIC_JAM++;
      else levelCounts.NORMAL++;
    });

    // Map to Low / Medium / High for user-friendly display
    const levelDisplay = [
      { label: 'Low (Normal)',  value: levelCounts.NORMAL },
      { label: 'Medium (Slow)', value: levelCounts.SLOW },
      { label: 'High (Jam)',    value: levelCounts.TRAFFIC_JAM },
    ];

    // Commute period labeling helper
    const getCommutePeriod = (h) => {
      if (h >= 7 && h <= 9) return 'Morning Peak Rush';
      if (h >= 10 && h <= 13) return 'Midday Flow';
      if (h >= 14 && h <= 15) return 'Afternoon Commerce';
      if (h === 16) return 'Late Afternoon Peak Volume';
      if (h >= 17 && h <= 19) return 'Evening Peak Gridlock';
      if (h >= 20 && h <= 22) return 'Late Evening Flow';
      return 'Night Free Flow';
    };

    // Congestion by hour (counted from 1 to 24 instead of 0)
    const hourBuckets = {};
    for (let h = 1; h <= 24; h++) {
      hourBuckets[h] = { total: 0, congested: 0, jams: 0, speeds: [], delays: [] };
    }

    records.forEach(r => {
      let h = parseInt(r.hour, 10);
      if (isNaN(h) && r.timestamp) {
        const m = String(r.timestamp).match(/\s(\d{1,2}):/);
        if (m) h = parseInt(m[1], 10);
      }
      if (isNaN(h)) return;
      if (h === 0) h = 24; // 12 AM midnight maps to hour 24
      if (h < 1 || h > 24) return;

      const b = hourBuckets[h];
      b.total++;
      const spd = parseFloat(r.traffic_speed_kmh);
      if (!isNaN(spd)) b.speeds.push(spd);
      const dly = parseFloat(r.traffic_delay_min);
      if (!isNaN(dly)) b.delays.push(dly);

      const lvl = (r.traffic_level || r.target_traffic_level || '').toUpperCase();
      if (['SLOW', 'MODERATE', 'TRAFFIC_JAM', 'HEAVY', 'SEVERE'].includes(lvl)) {
        b.congested++;
      }
      if (['TRAFFIC_JAM', 'HEAVY', 'SEVERE'].includes(lvl)) {
        b.jams++;
      }
    });

    const hourData = Object.entries(hourBuckets)
      .map(([h, v]) => {
        const hourNum = parseInt(h, 10);
        const avgSpeed = v.speeds.length ? Number((v.speeds.reduce((a, c) => a + c, 0) / v.speeds.length).toFixed(1)) : 35.0;
        const avgDelay = v.delays.length ? Number((v.delays.reduce((a, c) => a + c, 0) / v.delays.length).toFixed(1)) : 0.0;
        return {
          label: hourNum === 24 ? '24:00 (Midnight)' : `${String(hourNum).padStart(2, '0')}:00`,
          hour: hourNum,
          period: getCommutePeriod(hourNum),
          value: v.congested,
          congested: v.congested,
          total: v.total,
          jams: v.jams,
          avgSpeed,
          avgDelay,
          pct: v.total > 0 ? Math.round((v.congested / v.total) * 100) : 0,
        };
      })
      .sort((a, b) => a.hour - b.hour);

    // Active hours with recorded data
    const activeHours = hourData.filter(h => h.total > 0);

    // Peak hours ranked by Congested Corridors (Volume across Dhaka)
    const peakHoursByVolume = [...activeHours]
      .sort((a, b) => (b.congested - a.congested) || (b.avgDelay - a.avgDelay))
      .slice(0, 5);

    // Peak hours ranked by Delay & Slowdown Severity
    const peakHoursByDelay = [...activeHours]
      .sort((a, b) => (b.avgDelay - a.avgDelay) || (b.congested - a.congested))
      .slice(0, 5);

    // Default peakHours
    const peakHours = peakHoursByVolume;

    // Per-route breakdown: seed ALL 98 corridors (R01 to R98) and rank from most data to least
    const routeCounts = {};
    (ALL_ROUTES || []).forEach(r => {
      routeCounts[r.route_id] = {
        route_id: r.route_id,
        route_code: r.route_code,
        route_name: `${r.origin_name} -> ${r.dest_name}`,
        total: 0,
        congested: 0,
      };
    });

    records.forEach(r => {
      const id = r.road_route_id;
      if (!id) return;
      if (!routeCounts[id]) {
        const m = id.match(/^(R\d{2}):\s*(.*)$/);
        routeCounts[id] = {
          route_id: id,
          route_code: m ? m[1] : (id.startsWith('R') ? id.split(':')[0] : 'Route'),
          route_name: m ? m[2] : id,
          total: 0,
          congested: 0,
        };
      }
      routeCounts[id].total++;
      const lvl = (r.traffic_level || r.target_traffic_level || '').toUpperCase();
      if (lvl === 'SLOW' || lvl === 'MODERATE' || lvl === 'TRAFFIC_JAM' || lvl === 'HEAVY' || lvl === 'SEVERE') {
        routeCounts[id].congested++;
      }
    });

    const routeData = Object.values(routeCounts).map(v => {
      const codeNum = parseInt((v.route_code || '').replace('R', ''), 10) || 999;
      return {
        ...v,
        code_num: codeNum,
        label: v.route_id,
        value: v.total,
        pct: v.total > 0 ? Math.round((v.congested / v.total) * 100) : 0,
      };
    }).sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value; // Most data to least
      return a.code_num - b.code_num;                    // R01 to last tie-breaker
    });

    // Average speed
    const speeds = records.map(r => parseFloat(r.traffic_speed_kmh)).filter(s => !isNaN(s));
    const avgSpeed = speeds.length ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1) : '—';

    // Date range
    const timestamps = records
      .map(r => r.timestamp)
      .filter(Boolean)
      .sort();
    const dateRange = timestamps.length >= 2
      ? `${timestamps[0].split(' ')[0]} to ${timestamps[timestamps.length - 1].split(' ')[0]}`
      : 'N/A';

    return {
      levelDisplay,
      hourData,
      peakHours,
      peakHoursByVolume,
      peakHoursByDelay,
      routeData,
      avgSpeed,
      dateRange,
      total: totalRecords
    };
  }, [records, totalRecords]);

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 mt-3">Loading traffic history...</p>
      </div>
    );
  }

  if (error && (!records || records.length === 0)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700 flex flex-col items-start gap-3">
        <p>{error}</p>
        <button
          onClick={loadData}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-lg transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">No historical data available yet.</p>
        <p className="text-xs text-slate-400 mt-1">Run the data collection script to start recording traffic.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Traffic Insights</h1>
            {isOffline ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Offline Representative Dataset
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Live Node.js Telemetry (Port 5000)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Analysis of {stats.total.toLocaleString()} recorded traffic observations · {stats.dateRange}
          </p>
        </div>

        {/* Sync Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          {/* Sync status chip */}
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${autoSync ? 'bg-emerald-400' : 'bg-slate-300'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${autoSync ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
            </span>
            <span className="text-slate-600 font-medium">
              {autoSync ? `Auto-sync (${syncIntervalSec}s)` : 'Sync Paused'}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 font-mono text-[11px]" title="Last synced timestamp">
              {lastSynced ? formatSyncTime(lastSynced) : 'Syncing...'}
            </span>
          </div>

          {/* Auto-sync Interval selector / Toggle */}
          <button
            type="button"
            onClick={() => setAutoSync(!autoSync)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
              autoSync
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
            }`}
            title={autoSync ? 'Click to pause auto-synchronization' : 'Click to resume auto-synchronization'}
          >
            {autoSync ? 'Live Active' : 'Resume Auto-Sync'}
          </button>

          {/* Sync Now button */}
          <button
            type="button"
            onClick={() => loadData(false)}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition shadow-xs disabled:opacity-60"
            title="Fetch latest data from CSV and server now"
          >
            <svg
              className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Records',  value: stats.total.toLocaleString() },
          { label: 'Avg Speed',      value: `${stats.avgSpeed} km/h` },
          { label: 'Peak Congestion', value: stats.peakHoursByVolume[0] ? `${stats.peakHoursByVolume[0].label} (${stats.peakHoursByVolume[0].congested} corridors)` : '—' },
          { label: 'Data Range',     value: stats.dateRange.split(' to ')[0] || '—' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-xs text-slate-400 uppercase font-medium">{c.label}</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Traffic level distribution */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <BarChart
          title="Traffic Level Distribution"
          data={stats.levelDisplay}
          colorMap={{
            'Low (Normal)':  '#22c55e',
            'Medium (Slow)': '#f59e0b',
            'High (Jam)':    '#ef4444',
          }}
        />
      </div>

      {/* Congestion by hour */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-700">Congestion by Hour of Day</h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Number of congested observations (Slow + Jam) per hour across Dhaka (Hour 1 to 24)</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-red-500 inline-block" /> Heavy Congestion (≥15 corridors)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-amber-500 inline-block" /> Moderate Congestion (5–14)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-blue-500 inline-block" /> Light Flow (&lt;5)</span>
            </div>
            <button
              type="button"
              onClick={() => loadData(false)}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg transition disabled:opacity-60"
              title="Refresh this chart with latest data"
            >
              <svg
                className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : 'text-slate-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isSyncing ? 'Syncing...' : 'Sync Chart'}</span>
            </button>
          </div>
        </div>

        <div className="h-48 flex items-end gap-1 sm:gap-1.5 pt-6 pb-2 border-b border-slate-100">
          {stats.hourData.map(d => {
            const maxVal = Math.max(...stats.hourData.map(h => h.value), 1);
            const height = d.value > 0 ? Math.max((d.value / maxVal) * 100, 5) : 0;
            const barColor = d.value >= 15 || d.jams >= 4 ? 'bg-red-500' :
                             d.value >= 5 ? 'bg-amber-500' :
                             d.value > 0 ? 'bg-blue-500' : 'bg-slate-200';
            return (
              <div key={d.label} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 group relative">
                {/* Column background track + filled bar */}
                <div className="w-full flex-1 flex flex-col justify-end bg-slate-50 hover:bg-slate-100 rounded-t overflow-hidden transition-colors">
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${barColor} group-hover:brightness-110`}
                    style={{ height: `${height}%`, minHeight: d.value > 0 ? '4px' : '0px' }}
                  />
                </div>
                {/* Hour label */}
                <span className="text-[10px] text-slate-500 font-medium leading-none select-none">
                  {d.hour}
                </span>
                {/* Hover Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-medium rounded-lg px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-lg border border-slate-700">
                  <div className="font-bold text-slate-200">{d.label} · {d.period}</div>
                  <div className="text-slate-300">{d.value.toLocaleString()} congested / {d.total.toLocaleString()} total</div>
                  <div className="text-slate-300">Avg Speed: {d.avgSpeed} km/h · Delay: +{d.avgDelay} min</div>
                  <div className="text-amber-400 font-semibold">{d.pct}% Congestion Rate</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Peak hour analysis */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Top 5 Peak Congestion Hours</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {peakSortMode === 'volume'
                ? 'Ranked by total number of congested road corridors across Dhaka'
                : 'Ranked by longest traffic delays and severe slowdowns'}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setPeakSortMode('volume')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                peakSortMode === 'volume'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Congested Corridors
            </button>
            <button
              type="button"
              onClick={() => setPeakSortMode('severity')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                peakSortMode === 'severity'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Delay & Severity
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {(peakSortMode === 'volume' ? stats.peakHoursByVolume : stats.peakHoursByDelay).map((h, i) => {
            const isTop = i === 0;
            return (
              <div key={h.label} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isTop ? 'bg-red-500 text-white shadow-sm' :
                    i === 1 ? 'bg-orange-100 text-orange-700' :
                    i === 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {i + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{h.label}</span>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {h.period}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span>Avg Speed: <strong className="text-slate-700">{h.avgSpeed} km/h</strong></span>
                      <span>·</span>
                      <span>Avg Delay: <strong className="text-slate-700">+{h.avgDelay} min</strong></span>
                      {h.jams > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-red-600 font-medium">{h.jams} Severe Jam{h.jams > 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs self-start sm:self-auto pl-9 sm:pl-0">
                  <span className="text-slate-500 font-medium">
                    {h.congested} / {h.total} corridors ({h.pct}%)
                  </span>
                  <span className={`font-bold px-2.5 py-1 rounded-lg border ${
                    peakSortMode === 'severity'
                      ? (h.avgDelay >= 25 ? 'bg-red-50 border-red-200 text-red-600' :
                         h.avgDelay >= 10 ? 'bg-amber-50 border-amber-200 text-amber-600' :
                         'bg-blue-50 border-blue-200 text-blue-600')
                      : (h.congested >= 20 ? 'bg-red-50 border-red-200 text-red-600' :
                         h.congested >= 10 ? 'bg-amber-50 border-amber-200 text-amber-600' :
                         'bg-blue-50 border-blue-200 text-blue-600')
                  }`}>
                    {peakSortMode === 'severity' ? `+${h.avgDelay} min Delay` : `${h.congested} Corridors Congested`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-route breakdown: All corridors from most data to least */}
      <RouteRecordsList routes={stats.routeData} />
    </div>
  );
}

