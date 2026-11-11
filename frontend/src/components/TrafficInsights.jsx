import React, { useState, useEffect, useMemo } from 'react';
import { fetchHistory } from '../api.js';

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

export default function TrafficInsights() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [totalRecords, setTotalRecords] = useState(0);

  // Fetch all historical data (up to 5000 records for analysis)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetchHistory({ page: 1, limit: 5000 });
        if (res.success) {
          setRecords(res.data || []);
          setTotalRecords(res.total || res.data?.length || 0);
        }
      } catch (e) {
        setError('Could not load historical data. Make sure the backend server is running.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

    // Congestion by hour
    const hourBuckets = {};
    for (let h = 0; h < 24; h++) hourBuckets[h] = { total: 0, congested: 0 };
    records.forEach(r => {
      const h = parseInt(r.hour, 10);
      if (isNaN(h)) return;
      hourBuckets[h].total++;
      const lvl = (r.traffic_level || '').toUpperCase();
      if (lvl === 'SLOW' || lvl === 'MODERATE' || lvl === 'TRAFFIC_JAM' || lvl === 'HEAVY' || lvl === 'SEVERE') {
        hourBuckets[h].congested++;
      }
    });

    const hourData = Object.entries(hourBuckets)
      .filter(([, v]) => v.total > 0)
      .map(([h, v]) => ({
        label: `${String(h).padStart(2, '0')}:00`,
        value: v.congested,
        total: v.total,
        pct: Math.round((v.congested / v.total) * 100),
      }))
      .sort((a, b) => parseInt(a.label) - parseInt(b.label));

    // Top congested hours (peak hours)
    const peakHours = [...hourData].sort((a, b) => b.pct - a.pct).slice(0, 5);

    // Per-route breakdown
    const routeCounts = {};
    records.forEach(r => {
      const id = r.road_route_id || 'Unknown';
      if (!routeCounts[id]) routeCounts[id] = { total: 0, congested: 0 };
      routeCounts[id].total++;
      const lvl = (r.traffic_level || '').toUpperCase();
      if (lvl !== 'NORMAL') routeCounts[id].congested++;
    });

    const routeData = Object.entries(routeCounts)
      .map(([name, v]) => ({
        label: name.length > 28 ? name.slice(0, 26) + '…' : name,
        value: v.total,
        congested: v.congested,
        pct: Math.round((v.congested / v.total) * 100),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);

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

    return { levelDisplay, hourData, peakHours, routeData, avgSpeed, dateRange, total: totalRecords };
  }, [records, totalRecords]);

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 mt-3">Loading traffic history...</p>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">{error}</div>;
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
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Traffic Insights</h1>
        <p className="text-sm text-slate-500 mt-1">
          Analysis of {stats.total.toLocaleString()} recorded traffic observations · {stats.dateRange}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Records',  value: stats.total.toLocaleString() },
          { label: 'Avg Speed',      value: `${stats.avgSpeed} km/h` },
          { label: 'Peak Hours',     value: stats.peakHours[0] ? stats.peakHours[0].label : '—' },
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
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Congestion by Hour of Day</h3>
        <p className="text-xs text-slate-400 mb-4">Number of congested observations (Slow + Jam) per hour</p>
        <div className="flex items-end gap-1 h-40">
          {stats.hourData.map(d => {
            const height = stats.hourData.length ? Math.max((d.value / Math.max(...stats.hourData.map(h => h.value), 1)) * 100, 2) : 2;
            const isHot = d.pct >= 50;
            return (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className={`w-full rounded-t transition-all ${isHot ? 'bg-red-400' : 'bg-blue-400'} hover:opacity-80`}
                  style={{ height: `${height}%` }}
                  title={`${d.label}: ${d.value} congested / ${d.total} total (${d.pct}%)`}
                />
                <span className="text-[9px] text-slate-400 leading-none">
                  {parseInt(d.label)}
                </span>
                {/* Tooltip */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                  {d.label}: {d.pct}% congested
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-blue-400 inline-block" /> &lt;50% congested</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-400 inline-block" /> ≥50% congested</span>
        </div>
      </div>

      {/* Peak hour analysis */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Top 5 Peak Congestion Hours</h3>
        <div className="divide-y divide-slate-100">
          {stats.peakHours.map((h, i) => (
            <div key={h.label} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-slate-800">{h.label}</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-500">{h.congested} / {h.total} records</span>
                <span className={`font-bold px-2 py-0.5 rounded ${
                  h.pct >= 60 ? 'bg-red-50 text-red-600' :
                  h.pct >= 40 ? 'bg-amber-50 text-amber-600' :
                  'bg-green-50 text-green-600'
                }`}>
                  {h.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-route breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <BarChart
          title="Records by Route"
          data={stats.routeData}
          colorMap={{}}
        />
      </div>
    </div>
  );
}

