import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Gauge,
  Clock,
  CloudRain,
  AlertOctagon,
  Calendar,
  Layers,
  CheckCircle,
  TrendingDown,
  Info
} from 'lucide-react';
import { simulateTrafficPrediction } from '../api.js';

export default function PredictorView({ routes = [] }) {
  const [corridorCode, setCorridorCode] = useState('R01');
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [weather, setWeather] = useState('Cloudy');
  const [hasAccident, setHasAccident] = useState(false);
  const [hasConstruction, setHasConstruction] = useState(false);
  const [hasSpecialEvent, setHasSpecialEvent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);

  const runPrediction = async () => {
    setLoading(true);
    try {
      const res = await simulateTrafficPrediction({
        corridorCode,
        hour,
        minute,
        dayOfWeek,
        weather,
        hasAccident,
        hasConstruction,
        hasSpecialEvent
      });
      if (res.success) {
        setPrediction(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runPrediction();
  }, [corridorCode, hour, minute, dayOfWeek, weather, hasAccident, hasConstruction, hasSpecialEvent]);

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">What-If Machine Learning Traffic Simulator</h3>
            <p className="text-xs text-slate-400">
              Simulate dynamic traffic speed, delay, and congestion levels by adjusting time, weather, and road events.
            </p>
          </div>
        </div>

        {/* Form Controls Grid */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Corridor */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Corridor:</label>
            <select
              value={corridorCode}
              onChange={(e) => setCorridorCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {routes.map(r => (
                <option key={r.route_code} value={r.route_code}>
                  {r.route_code}: {r.origin_name} &rarr; {r.dest_name}
                </option>
              ))}
            </select>
          </div>

          {/* Time of Day */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-slate-300 mb-1.5">
              <span>Time of Day:</span>
              <span className="font-bold text-cyan-400 font-mono">
                {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="23"
              step="1"
              value={hour}
              onChange={(e) => setHour(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-950 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>12 AM</span>
              <span>8 AM (Rush)</span>
              <span>1 PM</span>
              <span>6 PM (Rush)</span>
              <span>11 PM</span>
            </div>
          </div>

          {/* Day of Week */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Day of Week:</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                <option key={d} value={d}>
                  {d} {d === 'Friday' || d === 'Saturday' ? '(Weekend)' : '(Workday)'}
                </option>
              ))}
            </select>
          </div>

          {/* Weather */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Weather Factor:</label>
            <select
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="Clear">Clear / Sunny (1.0x)</option>
              <option value="Cloudy">Cloudy (1.0x)</option>
              <option value="Light Rain">Light Rain (+25% Delay)</option>
              <option value="Heavy Rain">Heavy Monsoon Rain (+55% Delay)</option>
              <option value="Fog">Winter Fog (+20% Delay)</option>
            </select>
          </div>
        </div>

        {/* Real-Time Road Event Toggles */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">Road Disruptions:</span>

          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs select-none">
            <input
              type="checkbox"
              checked={hasAccident}
              onChange={(e) => setHasAccident(e.target.checked)}
              className="rounded accent-rose-500"
            />
            <span className={hasAccident ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
              🚨 Traffic Accident (+45%)
            </span>
          </label>

          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs select-none">
            <input
              type="checkbox"
              checked={hasConstruction}
              onChange={(e) => setHasConstruction(e.target.checked)}
              className="rounded accent-amber-500"
            />
            <span className={hasConstruction ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
              🚧 Road Construction (+25%)
            </span>
          </label>

          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs select-none">
            <input
              type="checkbox"
              checked={hasSpecialEvent}
              onChange={(e) => setHasSpecialEvent(e.target.checked)}
              className="rounded accent-purple-500"
            />
            <span className={hasSpecialEvent ? 'text-purple-400 font-semibold' : 'text-slate-400'}>
              🎪 Public / VIP Event (+30%)
            </span>
          </label>
        </div>
      </div>

      {/* Prediction Output Display */}
      {prediction && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main KPI Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg text-xs font-extrabold bg-cyan-950 text-cyan-400 border border-cyan-800">
                  {prediction.route_code}
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                  prediction.traffic_level === 'SEVERE' ? 'bg-rose-950 text-rose-400 border-rose-800' :
                  prediction.traffic_level === 'HEAVY' ? 'bg-orange-950 text-orange-400 border-orange-800' :
                  prediction.traffic_level === 'MODERATE' ? 'bg-amber-950 text-amber-400 border-amber-800' :
                  'bg-emerald-950 text-emerald-400 border-emerald-800'
                }`}>
                  Predicted Level: {prediction.traffic_level}
                </span>
              </div>
              <span className="text-xs text-slate-400 font-medium">Confidence: <strong className="text-emerald-400">{prediction.confidence_score}</strong></span>
            </div>

            <h4 className="mt-3 text-base font-bold text-white">{prediction.route_name}</h4>

            {/* Big Metrics */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <div className="text-[10px] text-slate-400 font-medium uppercase">Predicted Speed</div>
                <div className="text-2xl font-extrabold text-cyan-400 mt-1">{prediction.predicted_speed_kmh} <span className="text-xs text-slate-500 font-normal">km/h</span></div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <div className="text-[10px] text-slate-400 font-medium uppercase">Predicted Delay</div>
                <div className="text-2xl font-extrabold text-amber-400 mt-1">+{prediction.predicted_delay_min} <span className="text-xs text-slate-500 font-normal">min</span></div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <div className="text-[10px] text-slate-400 font-medium uppercase">Total Transit ETA</div>
                <div className="text-2xl font-extrabold text-white mt-1">{prediction.predicted_travel_time_min} <span className="text-xs text-slate-500 font-normal">min</span></div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <div className="text-[10px] text-slate-400 font-medium uppercase">Congestion Ratio</div>
                <div className="text-2xl font-extrabold text-purple-400 mt-1">{prediction.congestion_ratio}x</div>
              </div>
            </div>

            {/* Travel Time Bar Comparison */}
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Free-Flow Baseline: <strong className="text-slate-200">{prediction.free_flow_time_min} min</strong></span>
                <span>Predicted Jam Travel Time: <strong className="text-cyan-400">{prediction.predicted_travel_time_min} min</strong></span>
              </div>
              <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${Math.min(100, Math.round((prediction.free_flow_time_min / prediction.predicted_travel_time_min) * 100))}%` }}
                  className="bg-emerald-500"
                  title="Free-flow base"
                />
                <div
                  style={{ width: `${Math.max(0, 100 - Math.round((prediction.free_flow_time_min / prediction.predicted_travel_time_min) * 100))}%` }}
                  className="bg-rose-500"
                  title="Delay impact"
                />
              </div>
            </div>
          </div>

          {/* Breakdown & Factors Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Feature Influence Multipliers
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400">Rush Hour Effect:</span>
                  <span className="font-bold text-cyan-400 font-mono">
                    {prediction.factors.rush_hour_multiplier}x
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400">Weather Effect:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {prediction.factors.weather_multiplier}x
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400">Disruptions Factor:</span>
                  <span className="font-bold text-rose-400 font-mono">
                    {prediction.factors.incident_multiplier}x
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400">Estimated Road Occupancy:</span>
                  <span className="font-bold text-purple-400 font-mono">
                    {prediction.occupancy_pct}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-400">Estimated Flow Volume:</span>
                  <span className="font-bold text-slate-200 font-mono">
                    ~{prediction.traffic_volume_veh_hr} veh/hr
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-slate-500 leading-normal">
              Based on trained parameters from 400+ real Dhaka traffic observation cycles and calibrated speed degradation functions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

