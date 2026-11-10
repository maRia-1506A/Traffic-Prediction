import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Zap,
  Navigation,
  Sparkles,
  Heart,
  Compass,
  Car,
  Info,
  CloudSun,
  ExternalLink,
  Layers,
  Droplets,
  Eye
} from 'lucide-react';
import { ALL_DHAKA_LOCATIONS } from '../utils/journeyPredictor.js';
import { predictJourneyApi, fetchLiveWeather, fetchEngineStatus } from '../api.js';
import JourneyRouteMap from './JourneyRouteMap.jsx';

export default function TrafficJourneyPredictor({ onExploreCorridors, onOpenMap }) {
  // Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [fromLocation, setFromLocation] = useState('Mirpur 10');
  const [toLocation, setToLocation] = useState('Farmgate');

  // Interactive UI State
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [alternativeChoice, setAlternativeChoice] = useState(null); // null, 'yes', 'no'
  const [liveWeather, setLiveWeather] = useState(null);
  const [engineStatus, setEngineStatus] = useState(null);
  const [showMapVisualizer, setShowMapVisualizer] = useState(true);

  // Popular Quick Select Presets
  const popularOrigins = ['Mirpur 10', 'Uttara', 'ECB Chattor', 'Dhanmondi', 'Savar', 'Gabtoli'];
  const popularDestinations = ['Farmgate', 'Motijheel', 'Gabtoli', 'Science Lab', 'Gulshan 2', 'Airport'];

  // Quick Time Presets
  const timePresets = [
    { label: 'Morning Peak', time: '08:30', desc: 'Rush' },
    { label: 'Midday', time: '14:00', desc: 'Regular' },
    { label: 'Evening Peak', time: '18:30', desc: 'Heavy' },
    { label: 'Night Flow', time: '22:30', desc: 'Clear' }
  ];

  // Derive day of week for current selected date
  const getDayName = (dateStr) => {
    if (!dateStr) return 'Today';
    const d = new Date(dateStr + 'T12:00:00');
    return isNaN(d.getTime())
      ? 'Today'
      : d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const dayName = getDayName(selectedDate);
  const isWeekendDay = dayName === 'Friday' || dayName === 'Saturday';

  // Load Live Telemetry (OpenWeatherMap + Google API Engine Status)
  useEffect(() => {
    const loadApiTelemetry = async () => {
      try {
        const [wData, eData] = await Promise.all([
          fetchLiveWeather(),
          fetchEngineStatus()
        ]);
        if (wData) setLiveWeather(wData);
        if (eData) setEngineStatus(eData);
      } catch (e) {
        console.warn('Could not load background API telemetry:', e.message);
      }
    };
    loadApiTelemetry();
  }, []);

  // Swap From and To
  const handleSwap = () => {
    setFromLocation(toLocation);
    setToLocation(fromLocation);
    if (result) {
      setAlternativeChoice(null);
    }
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!fromLocation || !toLocation) return;

    setLoading(true);
    setAlternativeChoice(null);

    try {
      const data = await predictJourneyApi({
        date: selectedDate,
        day: dayName,
        time: selectedTime,
        from: fromLocation,
        to: toLocation
      });

      setResult(data);
      if (data.weather_live) {
        setLiveWeather(data.weather_live);
      }
    } catch (err) {
      console.error('Prediction failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run initial prediction on mount
  useEffect(() => {
    handleSubmit();
  }, []);

  // Quick Date Setters
  const setQuickDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const setNextFriday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (5 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      {/* 1. Live Weather & Multi-Key API Engine Status Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 backdrop-blur-md shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* OpenWeatherMap Live Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold bg-amber-950/60 border border-amber-800/60 px-3 py-1.5 rounded-xl">
            <CloudSun className="w-4 h-4" />
            <span>OpenWeatherMap Live:</span>
            <span className="text-white font-extrabold">{liveWeather?.temperature_c || 25}°C</span>
            <span className="text-amber-300 font-normal">({liveWeather?.condition || 'Haze'})</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-slate-300">
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span>Humidity: {liveWeather?.humidity_pct || 75}%</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vis: {liveWeather?.visibility_km || 7} km</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-300 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
              <span>Road: </span>
              <strong className="text-emerald-400">{liveWeather?.surface_condition || 'Dry Surface'}</strong>
            </span>
          </div>
        </div>

        {/* Google Maps Multi-Key Engine Status */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-300 font-medium">Google Maps Routes API v2:</span>
            <span className="text-emerald-400 font-bold">Multi-Key Pool Active</span>
          </div>
        </div>
      </div>

      {/* 2. Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-800/80 text-cyan-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Google Maps Routes API + OpenWeatherMap Real-Time Telemetry</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Dhaka Traffic Journey Predictor & Jam Bypass
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Plan your route across Greater Dhaka. Input your{' '}
              <strong className="text-cyan-400">Day / Date</strong>,{' '}
              <strong className="text-cyan-400">Time</strong>,{' '}
              <strong className="text-cyan-400">From</strong>, and{' '}
              <strong className="text-cyan-400">To</strong> to predict traffic conditions (High, Low, Medium) and discover fastest alternative bypasses.
            </p>
          </div>

          <div className="flex items-center gap-3 self-stretch md:self-auto bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Car className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-white">50 Official Corridors</div>
              <div className="text-slate-400">128 Dhaka Nodes & Flyovers</div>
            </div>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* 3. Main Prediction Input Form Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-7 backdrop-blur-md shadow-xl">
        <div className="border-b border-slate-800 pb-4 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Trip Parameters</h2>
          </div>
          <span className="text-xs text-slate-400">Specify journey schedule & points</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Input 1: Day / Date */}
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  Day / Date
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                    isWeekendDay
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-blue-950 text-blue-300 border border-blue-800'
                  }`}
                >
                  {dayName} {isWeekendDay ? '(Holiday)' : '(Weekday)'}
                </span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 hover:border-slate-600 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:outline-none transition shadow-inner"
                  required
                />
              </div>

              {/* Quick Day Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={setNextFriday}
                  className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 transition"
                >
                  Friday (Weekend)
                </button>
              </div>
            </div>

            {/* Input 2: Time */}
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Time
                </span>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">
                  {selectedTime}
                </span>
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 hover:border-slate-600 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-medium focus:outline-none transition shadow-inner"
                  required
                />
              </div>

              {/* Quick Time Preset Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {timePresets.map(tp => (
                  <button
                    key={tp.label}
                    type="button"
                    onClick={() => setSelectedTime(tp.time)}
                    className={`text-[10px] px-2 py-0.5 rounded transition ${
                      selectedTime === tp.time
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {tp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input 3: From (Origin) */}
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  From (Origin)
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold truncate max-w-[120px]">
                  {fromLocation}
                </span>
              </label>
              <div className="relative">
                <select
                  value={fromLocation}
                  onChange={(e) => setFromLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 hover:border-slate-600 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-xs text-white font-medium focus:outline-none transition cursor-pointer shadow-inner"
                >
                  {ALL_DHAKA_LOCATIONS.map(loc => (
                    <option key={loc} value={loc} className="bg-slate-900 text-white">
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Origin Chips */}
              <div className="flex flex-wrap gap-1 pt-1">
                {popularOrigins.slice(0, 4).map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setFromLocation(loc)}
                    className={`text-[10px] px-2 py-0.5 rounded transition ${
                      fromLocation === loc
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold'
                        : 'bg-slate-800/60 hover:bg-slate-700 text-slate-400'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Input 4: To (Destination) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <Navigation className="w-3.5 h-3.5 text-rose-400" />
                  To (Destination)
                </label>
                {/* Swap Button */}
                <button
                  type="button"
                  onClick={handleSwap}
                  title="Swap Origin and Destination"
                  className="flex items-center gap-1 text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 transition bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  Swap
                </button>
              </div>

              <div className="relative">
                <select
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 hover:border-slate-600 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-xs text-white font-medium focus:outline-none transition cursor-pointer shadow-inner"
                >
                  {ALL_DHAKA_LOCATIONS.map(loc => (
                    <option key={loc} value={loc} className="bg-slate-900 text-white">
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Destination Chips */}
              <div className="flex flex-wrap gap-1 pt-1">
                {popularDestinations.slice(0, 4).map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setToLocation(loc)}
                    className={`text-[10px] px-2 py-0.5 rounded transition ${
                      toLocation === loc
                        ? 'bg-rose-950 text-rose-300 border border-rose-700 font-bold'
                        : 'bg-slate-800/60 hover:bg-slate-700 text-slate-400'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Input 5: Submit Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>
                Evaluating <span className="text-white font-semibold">{fromLocation}</span> &rarr;{' '}
                <span className="text-white font-semibold">{toLocation}</span> on {dayName} at {selectedTime}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Querying Google Routes & Weather Engine...</span>
                </>
              ) : (
                <>
                  <span>Submit</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 4. Result Section: Traffic Prediction (High / Low / Medium) with Route */}
      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Traffic Prediction Banner Card */}
          <div
            className={`rounded-3xl border p-6 sm:p-7 backdrop-blur-md shadow-2xl relative overflow-hidden transition-all ${
              result.traffic_prediction === 'High'
                ? 'bg-gradient-to-br from-rose-950/70 via-slate-900/90 to-red-950/40 border-rose-600/50 shadow-rose-950/40'
                : result.traffic_prediction === 'Medium'
                ? 'bg-gradient-to-br from-amber-950/70 via-slate-900/90 to-yellow-950/40 border-amber-500/50 shadow-amber-950/40'
                : 'bg-gradient-to-br from-emerald-950/70 via-slate-900/90 to-teal-950/40 border-emerald-500/50 shadow-emerald-950/40'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Traffic Prediction Level Pill & Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Traffic Prediction:
                  </span>
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-base font-black uppercase tracking-wider shadow-lg ${
                      result.traffic_prediction === 'High'
                        ? 'bg-rose-500 text-white shadow-rose-500/30'
                        : result.traffic_prediction === 'Medium'
                        ? 'bg-amber-500 text-slate-950 shadow-amber-500/30'
                        : 'bg-emerald-500 text-white shadow-emerald-500/30'
                    }`}
                  >
                    {result.traffic_prediction === 'High' && <Flame className="w-4 h-4 fill-white" />}
                    {result.traffic_prediction === 'Medium' && <Clock className="w-4 h-4" />}
                    {result.traffic_prediction === 'Low' && <CheckCircle2 className="w-4 h-4 fill-white" />}
                    <span>{result.traffic_prediction}</span>
                  </div>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-white">
                  {result.primary_route.name}
                </h3>

                <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0 text-cyan-400" />
                  <span>{result.levelDescription}</span>
                </p>

                <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    Period: <strong className="text-slate-200">{result.periodLabel}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Telemetry Source:{' '}
                    <strong className="text-cyan-400">{result.telemetrySource || 'Google Maps Routes API v2'}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Confidence: <strong className="text-emerald-400">{result.confidence}</strong>
                  </span>
                </div>
              </div>

              {/* Primary Route Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Travel Time</div>
                  <div className="text-xl font-extrabold text-white mt-1">
                    {result.primary_route.travel_time_min} <span className="text-xs text-slate-400 font-normal">m</span>
                  </div>
                  <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                    +{result.primary_route.traffic_delay_min}m delay
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Speed</div>
                  <div className="text-xl font-extrabold text-white mt-1">
                    {result.primary_route.speed_kmh} <span className="text-xs text-slate-400 font-normal">km/h</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Est. velocity
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Distance</div>
                  <div className="text-xl font-extrabold text-white mt-1">
                    {result.primary_route.distance_km} <span className="text-xs text-slate-400 font-normal">km</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Arterial path
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Free Flow</div>
                  <div className="text-xl font-extrabold text-emerald-400 mt-1">
                    {result.primary_route.free_flow_time_min} <span className="text-xs text-slate-400 font-normal">m</span>
                  </div>
                  <div className="text-[10px] text-emerald-400/80 mt-0.5">
                    Zero traffic
                  </div>
                </div>
              </div>
            </div>

            {/* Primary Route Step-by-Step Path */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Primary Route Path:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-200">
                  {result.primary_route.steps?.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <span
                        className={`px-3 py-1 rounded-xl font-medium ${
                          idx === 0
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : idx === result.primary_route.steps.length - 1
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-slate-950 text-slate-200 border border-slate-800'
                        }`}
                      >
                        {step}
                      </span>
                      {idx < result.primary_route.steps.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Google Maps Live Turn-by-Turn Button */}
              {result.primary_route.google_maps_url && (
                <a
                  href={result.primary_route.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-white transition self-start md:self-auto shrink-0 shadow"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              )}
            </div>
          </div>

          {/* Interactive Route Map Preview (Leaflet) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 backdrop-blur-md shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Live Route Topology Visualizer</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMapVisualizer(!showMapVisualizer)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                {showMapVisualizer ? 'Hide Map' : 'Show Map'}
              </button>
            </div>

            {showMapVisualizer && (
              <JourneyRouteMap
                fromLocation={fromLocation}
                toLocation={toLocation}
                primaryRoute={result.primary_route}
                alternativeRoute={result.alternative_route}
                showAlternative={alternativeChoice === 'yes'}
                trafficPrediction={result.traffic_prediction}
              />
            )}
          </div>

          {/* 5. Alternative Route Question (Yes / No) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-md shadow-xl text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Smart Detour & Congestion Bypass</span>
            </div>

            <h3 className="text-lg sm:text-xl font-extrabold text-white">
              Alternative route? (Yes/no)
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
              Would you like to explore an alternative bypass corridor (e.g. Flyover, Elevated Expressway, or Parallel Ring Road) to save travel time?
            </p>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setAlternativeChoice('yes')}
                className={`px-6 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  alternativeChoice === 'yes'
                    ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 scale-105'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Yes, Show Alternative Route</span>
              </button>

              <button
                type="button"
                onClick={() => setAlternativeChoice('no')}
                className={`px-6 py-2.5 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  alternativeChoice === 'no'
                    ? 'bg-rose-950/90 text-rose-300 border border-rose-700 shadow-lg shadow-rose-900/30 scale-105'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>No, Thank You</span>
              </button>
            </div>
          </div>

          {/* 6. If click YES -> Show Alternative Route */}
          {alternativeChoice === 'yes' && result.alternative_route && (
            <div className="rounded-3xl bg-gradient-to-br from-cyan-950/60 via-slate-900/90 to-blue-950/40 border border-cyan-500/50 p-6 sm:p-7 shadow-2xl backdrop-blur-md space-y-5 animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-800/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/20">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-cyan-900/60 text-cyan-300 border border-cyan-700">
                        {result.alternative_route.tag || 'Bypass Corridor'}
                      </span>
                      {result.alternative_route.time_saved_min > 0 && (
                        <span className="text-xs font-bold text-emerald-400">
                          ⚡ Saves ~{result.alternative_route.time_saved_min} minutes
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-bold text-white mt-1">
                      {result.alternative_route.name}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Bypass ETA</div>
                    <div className="text-xl font-extrabold text-cyan-300">
                      {result.alternative_route.travel_time_min} mins
                    </div>
                  </div>

                  {result.alternative_route.google_maps_url && (
                    <a
                      href={result.alternative_route.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md shadow-cyan-500/20"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Navigate Bypass</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Comparison Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Time Comparison</span>
                  <div className="text-base font-extrabold text-white mt-1 flex items-center justify-center gap-2">
                    <span className="text-rose-400 line-through text-xs font-normal">
                      {result.primary_route.travel_time_min}m
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-emerald-400 font-black">
                      {result.alternative_route.travel_time_min}m
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                    Saves {result.alternative_route.time_saved_min} mins
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Corridor Velocity</span>
                  <div className="text-base font-extrabold text-white mt-1">
                    {result.alternative_route.bypass_speed_kmh} <span className="text-xs text-slate-400 font-normal">km/h</span>
                  </div>
                  <div className="text-[10px] text-cyan-400 font-semibold mt-0.5">
                    vs {result.primary_route.speed_kmh} km/h primary
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Distance</span>
                  <div className="text-base font-extrabold text-white mt-1">
                    {result.alternative_route.distance_km} <span className="text-xs text-slate-400 font-normal">km</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Via {result.alternative_route.via || 'Bypass'}
                  </div>
                </div>
              </div>

              {/* Alternative Route Path Steps */}
              <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Alternative Route Path:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-200">
                  {result.alternative_route.steps?.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <span
                        className={`px-3 py-1 rounded-xl font-medium ${
                          idx === 0
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : idx === result.alternative_route.steps.length - 1
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-cyan-950 text-cyan-200 border border-cyan-800/80 font-bold'
                        }`}
                      >
                        {step}
                      </span>
                      {idx < result.alternative_route.steps.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Recommendation Note */}
              <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Why this bypass: </strong>
                  <span>{result.alternative_route.reason}</span>
                </div>
              </div>
            </div>
          )}

          {/* 7. Else (click NO) -> "Thank You" */}
          {alternativeChoice === 'no' && (
            <div className="rounded-3xl bg-gradient-to-br from-emerald-950/50 via-slate-900/90 to-teal-950/40 border border-emerald-600/50 p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20">
                <Heart className="w-7 h-7 text-emerald-400 fill-emerald-400" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-2xl font-black text-white">Thank You!</h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto">
                  Thank you for using the Dhaka Traffic Prediction System. Wishing you a safe, smooth, and pleasant journey!
                </p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 max-w-lg mx-auto text-left text-xs text-slate-400 space-y-2">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Commuter Safety Guidelines:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>Please maintain lane discipline and obey traffic signals.</li>
                  <li>Allow an extra 10-15 minutes cushion for unforeseen intersection congestion.</li>
                  <li>Check back anytime for live telemetry updates on your route.</li>
                </ul>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setAlternativeChoice('yes')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-cyan-400 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition cursor-pointer"
                >
                  Changed your mind? View Alternative Route
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
