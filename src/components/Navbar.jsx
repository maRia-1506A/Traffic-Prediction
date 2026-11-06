import React from 'react';
import {
  Navigation,
  MapPin,
  Compass,
  Sparkles,
  BarChart3,
  Cpu,
  RefreshCw,
  CloudSun,
  ShieldAlert
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onRefresh, loading, stats }) {
  const tabs = [
    { id: 'map', label: 'Live Map & Overview', icon: MapPin },
    { id: 'routes', label: '50 Corridors (R01-R50)', icon: Navigation },
    { id: 'advisor', label: 'Jam Bypass Advisor', icon: Compass },
    { id: 'predictor', label: 'ML Simulator', icon: Sparkles },
    { id: 'history', label: 'Dataset & Analytics', icon: BarChart3 },
    { id: 'system', label: 'Engine Status', icon: Cpu },
  ];

  const weather = stats?.weatherSummary || { condition: 'Partly Cloudy', temperature_c: 29.4 };

  return (
    <header className="sticky top-0 z-50 bg-[#0c1220]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo & Live Status */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold text-lg">
              <Navigation className="w-5 h-5 -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">DHAKA TRAFFIC</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  AI ENGINE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Real-Time Congestion & OSM Bypass Machine</p>
            </div>
          </div>

          {/* Quick weather pill on mobile */}
          <div className="flex md:hidden items-center gap-1.5 text-xs text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <CloudSun className="w-3.5 h-3.5 text-amber-400" />
            <span>{weather.temperature_c}°C</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right Info & Refresh */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
            <CloudSun className="w-4 h-4 text-amber-400" />
            <span className="text-slate-300 font-medium">{weather.temperature_c}°C</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">{weather.condition}</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh Live Telemetry"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>
    </header>
  );
}

