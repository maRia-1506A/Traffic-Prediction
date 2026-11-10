import React from 'react';
import {
  Gauge,
  Clock,
  AlertTriangle,
  Flame,
  CheckCircle2,
  TrendingDown,
  Navigation2
} from 'lucide-react';

export default function MetricsOverview({ stats, onSelectRoute }) {
  if (!stats) return null;

  const {
    totalCorridors = 50,
    avgSpeedKmh = 25.0,
    avgDelayMin = 2.4,
    levelCounts = { NORMAL: 0, MODERATE: 0, HEAVY: 0, SEVERE: 0 },
    worstCorridors = [],
    totalHistoricalRecords = 0
  } = stats;

  const totalLevels = (levelCounts.NORMAL || 0) + (levelCounts.MODERATE || 0) + (levelCounts.HEAVY || 0) + (levelCounts.SEVERE || 0) || 1;
  const normalPct = Math.round(((levelCounts.NORMAL || 0) / totalLevels) * 100);
  const moderatePct = Math.round(((levelCounts.MODERATE || 0) / totalLevels) * 100);
  const heavyPct = Math.round(((levelCounts.HEAVY || 0) / totalLevels) * 100);
  const severePct = Math.round(((levelCounts.SEVERE || 0) / totalLevels) * 100);

  const worst = worstCorridors[0];

  return (
    <div className="space-y-4">
      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Avg Speed */}
        <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Dhaka Network Speed</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-950/70 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{avgSpeedKmh}</span>
            <span className="text-xs text-slate-400 font-semibold">km/h</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            Across 50 major commuter corridors
          </p>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-cyan-500/5 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Card 2: Average Delay */}
        <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Average Transit Delay</span>
            <div className="w-8 h-8 rounded-xl bg-amber-950/70 border border-amber-800/50 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-400 tracking-tight">+{avgDelayMin}</span>
            <span className="text-xs text-slate-400 font-semibold">minutes</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Beyond free-flow travel time</p>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Card 3: Top Bottleneck */}
        <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Primary Jam Bottleneck</span>
            <div className="w-8 h-8 rounded-xl bg-rose-950/70 border border-rose-800/50 flex items-center justify-center text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          {worst ? (
            <div className="mt-2.5">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {worst.route_code}
                </span>
                <span className="text-xs font-semibold text-slate-200 truncate max-w-[150px]">
                  {worst.name?.split(':')[1] || worst.name}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-400">
                <span>Speed: <strong className="text-rose-400">{worst.speed_kmh} km/h</strong></span>
                <span>Delay: <strong className="text-amber-400">+{worst.delay_min}m</strong></span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">All corridors flowing normally</p>
          )}
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-rose-500/5 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Card 4: Historical ML Records */}
        <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">ML Training Records</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-950/70 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400 tracking-tight">{totalHistoricalRecords}</span>
            <span className="text-xs text-slate-400 font-semibold">records</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Multi-feature real-time telemetry</p>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
        </div>
      </div>

      {/* Network Health & Congestion Distribution Bar */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3.5 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">Corridor Congestion Distribution</span>
            <span className="text-[11px] text-slate-500">({totalCorridors} Active Corridors)</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Normal ({levelCounts.NORMAL || 0})
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> Moderate ({levelCounts.MODERATE || 0})
            </span>
            <span className="flex items-center gap-1.5 text-orange-400">
              <span className="w-2 h-2 rounded-full bg-orange-400"></span> Heavy ({levelCounts.HEAVY || 0})
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span> Severe ({levelCounts.SEVERE || 0})
            </span>
          </div>
        </div>

        {/* Multi-segmented Progress Bar */}
        <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden flex">
          <div style={{ width: `${normalPct}%` }} className="bg-emerald-500 transition-all duration-500" title={`Normal: ${normalPct}%`} />
          <div style={{ width: `${moderatePct}%` }} className="bg-amber-500 transition-all duration-500" title={`Moderate: ${moderatePct}%`} />
          <div style={{ width: `${heavyPct}%` }} className="bg-orange-500 transition-all duration-500" title={`Heavy: ${heavyPct}%`} />
          <div style={{ width: `${severePct}%` }} className="bg-rose-500 transition-all duration-500" title={`Severe: ${severePct}%`} />
        </div>
      </div>
    </div>
  );
}

