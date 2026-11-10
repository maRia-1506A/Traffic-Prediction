import React, { useState, useEffect } from 'react';
import {
  Cpu,
  CheckCircle2,
  Server,
  Database,
  Map,
  CloudSun,
  ShieldCheck,
  Terminal,
  Activity,
  Layers
} from 'lucide-react';
import { fetchRoadSummary } from '../api.js';

export default function SystemStatus({ stats }) {
  const [roadSummary, setRoadSummary] = useState(null);
  const [loadingRoads, setLoadingRoads] = useState(false);

  useEffect(() => {
    setLoadingRoads(true);
    fetchRoadSummary()
      .then(res => {
        if (res.success) setRoadSummary(res.data);
      })
      .catch(console.error)
      .finally(() => setLoadingRoads(false));
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-cyan-600/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">System Architecture & Engine Telemetry</h3>
            <p className="text-xs text-slate-400">
              Dual-Engine traffic fusion, OpenStreetMap infrastructure topology, and real-time sensor pipelines.
            </p>
          </div>
        </div>

        {/* Engine Status Grid */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Engine 1: Google Maps */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white">Google Maps Routes API</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Primary
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              High-precision live travel durations, traffic delay calculations, and corridor lane topology.
            </p>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Integrated via .env GOOGLE_MAPS_API_KEY</span>
            </div>
          </div>

          {/* Engine 2: Waze Live */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white">Waze Crowdsourced Engine</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                Failover Ready
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Zero-downtime crowdsourced mobile probe speeds, live jam delay alerts across Greater Dhaka.
            </p>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Zero-key instant failover enabled</span>
            </div>
          </div>

          {/* Engine 3: OpenStreetMap Topology */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white">OpenStreetMap (OSM) Graph</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                Topology
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Physical road network loaded from Overpass API: lane counts, one-way flags, surface & junction proximity.
            </p>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Loaded from data/dhaka_roads.geojson</span>
            </div>
          </div>
        </div>
      </div>

      {/* OpenStreetMap GeoJSON Topology Details */}
      {roadSummary && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">OSM Road Topology Breakdown</h4>
            </div>
            <span className="text-xs text-slate-400">
              Total Road Segments: <strong className="text-white">{roadSummary.totalWays?.toLocaleString() || '1,000+'}</strong>
            </span>
          </div>

          {/* Road Type Tag Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {roadSummary.roadTypes && Object.entries(roadSummary.roadTypes).slice(0, 12).map(([type, count]) => (
              <div key={type} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400 font-mono uppercase truncate">{type}</div>
                <div className="text-sm font-extrabold text-cyan-400 mt-0.5">{count}</div>
              </div>
            ))}
          </div>

          {/* Sample Road Segments */}
          {roadSummary.sampleRoads && (
            <div className="mt-4 pt-4 border-t border-slate-800/80">
              <div className="text-xs font-semibold text-slate-400 mb-2">Sample High-Capacity Arterials:</div>
              <div className="flex flex-wrap gap-2">
                {roadSummary.sampleRoads.slice(0, 10).map((road, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg text-xs bg-slate-950 border border-slate-800 text-slate-300"
                  >
                    <strong>{road.name}</strong> <span className="text-slate-500">({road.highway}, {road.lanes} lanes)</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Project Team & Work Distribution */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>Team Collaboration & Tasks Allocation</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs font-bold text-cyan-400">@Fathum</div>
            <div className="text-xs font-semibold text-white mt-1">Google Maps + Waze Engine</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Dual-provider consensus, probe speed ingestion, zero-key failover.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs font-bold text-emerald-400">@Rohan (You)</div>
            <div className="text-xs font-semibold text-white mt-1">Frontend Engineering</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Interactive Node.js + React UI, Leaflet Dark Command Map, Jam Advisor, ML Simulator.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs font-bold text-purple-400">@Maria</div>
            <div className="text-xs font-semibold text-white mt-1">Database & API Architecture</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Postgres / SQLite schemas, ML feature store pipelines, and database endpoints.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

