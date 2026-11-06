import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MetricsOverview from './components/MetricsOverview';
import TrafficMap from './components/TrafficMap';
import RoutesList from './components/RoutesList';
import RouteAdvisor from './components/RouteAdvisor';
import PredictorView from './components/PredictorView';
import HistoryAnalytics from './components/HistoryAnalytics';
import SystemStatus from './components/SystemStatus';
import { fetchStats, fetchRoutes, fetchWaypoints } from './api';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [stats, setStats] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, routesRes, wpRes] = await Promise.all([
        fetchStats(),
        fetchRoutes(),
        fetchWaypoints()
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (routesRes.success) setRoutes(routesRes.data);
      if (wpRes.success) setWaypoints(wpRes.waypoints);
    } catch (err) {
      console.error('Initial data load failed:', err);
      setError(err.message || 'Failed to connect to Node.js Traffic API Server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleTestBypass = (route) => {
    setSelectedRoute(route);
    setActiveTab('advisor');
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={loadAllData}
        loading={loading}
        stats={stats}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-6 py-5 space-y-5">
        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-950/70 border border-rose-800 rounded-2xl flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Could not load live traffic server: {error}</span>
            </div>
            <button
              onClick={loadAllData}
              className="px-3 py-1 bg-rose-900/60 hover:bg-rose-800 text-white rounded-lg transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Overview KPIs shown on Map and Routes tabs */}
        {(activeTab === 'map' || activeTab === 'routes') && (
          <MetricsOverview
            stats={stats}
            onSelectRoute={(r) => {
              setSelectedRoute(r);
              setActiveTab('map');
            }}
          />
        )}

        {/* Tab 1: Live Map & Overview */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <TrafficMap
              routes={routes}
              selectedRoute={selectedRoute}
              onSelectRoute={setSelectedRoute}
              onTestBypass={handleTestBypass}
            />

            {/* Quick Bottlenecks Strip */}
            {stats?.worstCorridors && stats.worstCorridors.length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Critical Dhaka Congestion Points (Top Delays)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {stats.worstCorridors.map(c => (
                    <div
                      key={c.route_code}
                      onClick={() => {
                        const matched = routes.find(r => r.route_code === c.route_code);
                        if (matched) setSelectedRoute(matched);
                      }}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-cyan-400 text-xs">{c.route_code}</span>
                          <span className="text-[10px] font-bold text-rose-400 uppercase">{c.level}</span>
                        </div>
                        <div className="text-[11px] text-slate-300 truncate max-w-[120px]">
                          {c.name.split(':')[1] || c.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-amber-400">+{c.delay_min}m</div>
                        <div className="text-[10px] text-slate-500">{c.speed_kmh} km/h</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: 50 Official Corridors Explorer */}
        {activeTab === 'routes' && (
          <RoutesList
            routes={routes}
            onSelectRoute={(r) => {
              setSelectedRoute(r);
              setActiveTab('map');
            }}
            onTestBypass={handleTestBypass}
          />
        )}

        {/* Tab 3: Jam Bypass Advisor */}
        {activeTab === 'advisor' && (
          <RouteAdvisor
            routes={routes}
            waypoints={waypoints}
            initialRoute={selectedRoute}
            onSelectRoute={setSelectedRoute}
          />
        )}

        {/* Tab 4: ML Traffic Simulator */}
        {activeTab === 'predictor' && (
          <PredictorView routes={routes} />
        )}

        {/* Tab 5: Dataset & Analytics */}
        {activeTab === 'history' && (
          <HistoryAnalytics />
        )}

        {/* Tab 6: Engine Architecture & System Status */}
        {activeTab === 'system' && (
          <SystemStatus stats={stats} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#0c1220] px-4 lg:px-6 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <strong className="text-slate-300">Dhaka Traffic Prediction & Jam Bypass Machine</strong>
            <span className="mx-2">•</span>
            <span>OSM Road Topology + Google Maps / Waze Dual-Engine Fusion</span>
          </div>
          <div className="text-[11px]">
            Frontend Built on Node.js + React 19 + Leaflet & Tailwind CSS
          </div>
        </div>
      </footer>
    </div>
  );
}
