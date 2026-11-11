import React, { useState, useEffect } from 'react';
import { ALL_DHAKA_LOCATIONS } from '../utils/journeyPredictor.js';
import { predictJourneyApi } from '../api.js';
import JourneyRouteMap from './JourneyRouteMap.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────
const getDayName = (dateStr) => {
  if (!dateStr) return 'Today';
  const d = new Date(dateStr + 'T12:00:00');
  return isNaN(d.getTime()) ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'long' });
};

const LEVEL_CONFIG = {
  High:   { bg: 'bg-red-50',    border: 'border-red-200',   badge: 'bg-red-500 text-white',   dot: 'bg-red-500',    label: 'High Traffic',   desc: 'Severe congestion expected. Allow extra time.' },
  Medium: { bg: 'bg-amber-50',  border: 'border-amber-200', badge: 'bg-amber-400 text-white',  dot: 'bg-amber-400',  label: 'Moderate Traffic', desc: 'Moderate delays likely. Plan accordingly.' },
  Low:    { bg: 'bg-green-50',  border: 'border-green-200', badge: 'bg-green-500 text-white',  dot: 'bg-green-500',  label: 'Low Traffic',    desc: 'Roads are flowing freely. Good time to travel.' },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function TrafficJourneyPredictor() {
  const todayStr = new Date().toISOString().split('T')[0];

  // Form state
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [fromLocation, setFromLocation] = useState('Mirpur 10');
  const [toLocation, setToLocation]     = useState('Farmgate');

  // UI state
  const [loading, setLoading]               = useState(false);
  const [result, setResult]                 = useState(null);
  const [error, setError]                   = useState(null);
  const [alternativeChoice, setAlternativeChoice] = useState(null); // null | 'yes' | 'no'
  const [formError, setFormError]           = useState('');

  const dayName      = getDayName(selectedDate);
  const isWeekendDay = dayName === 'Friday' || dayName === 'Saturday';

  // Quick date helpers
  const setToday    = () => setSelectedDate(new Date().toISOString().split('T')[0]);
  const setTomorrow = () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Swap origin / destination
  const handleSwap = () => {
    setFromLocation(toLocation);
    setToLocation(fromLocation);
    setResult(null);
    setAlternativeChoice(null);
  };

  // Validate + submit
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setFormError('');

    if (!selectedDate) { setFormError('Please select a travel date.'); return; }
    if (!selectedTime) { setFormError('Please select a travel time.'); return; }
    if (!fromLocation) { setFormError('Please select a starting location.'); return; }
    if (!toLocation)   { setFormError('Please select a destination.'); return; }
    if (fromLocation === toLocation) { setFormError('Origin and destination cannot be the same.'); return; }

    setLoading(true);
    setResult(null);
    setError(null);
    setAlternativeChoice(null);

    try {
      const data = await predictJourneyApi({
        date: selectedDate,
        day:  dayName,
        time: selectedTime,
        from: fromLocation,
        to:   toLocation,
      });
      setResult(data);
    } catch (err) {
      setError('Could not get prediction. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const cfg = result ? (LEVEL_CONFIG[result.traffic_prediction] || LEVEL_CONFIG.Low) : null;

  return (
    <div className="space-y-8">

      {/* ── Page Title ─────────────────────────────────────────────────────── */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Plan Your Journey</h1>
        <p className="text-slate-500 text-sm">
          Enter your travel details to predict traffic conditions across Dhaka.
        </p>
      </div>

      {/* ── Prediction Form ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Travel Date */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Travel Date
              </label>
              <input
                type="date"
                value={selectedDate}
                min={todayStr}
                onChange={(e) => setSelectedDate(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <div className="flex gap-2 pt-0.5">
                <button type="button" onClick={setToday}
                  className="text-xs text-blue-600 hover:underline">Today</button>
                <span className="text-slate-300 text-xs">|</span>
                <button type="button" onClick={setTomorrow}
                  className="text-xs text-blue-600 hover:underline">Tomorrow</button>
                {dayName && (
                  <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                    isWeekendDay ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {dayName}
                  </span>
                )}
              </div>
            </div>

            {/* Travel Time */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Travel Time
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <div className="flex gap-2 pt-0.5">
                {[['08:30','Morning Peak'],['14:00','Midday'],['18:30','Evening Peak']].map(([t,l]) => (
                  <button key={t} type="button" onClick={() => setSelectedTime(t)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition ${
                      selectedTime === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-600'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* From */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                From (Origin)
              </label>
              <select
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
              >
                {ALL_DHAKA_LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            {/* To */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  To (Destination)
                </label>
                <button type="button" onClick={handleSwap}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                  </svg>
                  Swap
                </button>
              </div>
              <select
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
              >
                {ALL_DHAKA_LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Validation error */}
          {formError && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {formError}
            </p>
          )}

          {/* Submit */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm transition flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Predicting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                  Predict Traffic
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Server error ───────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700 flex items-start gap-3">
          <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <div>
            <p className="font-semibold">Prediction failed</p>
            <p className="text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── Result Section ─────────────────────────────────────────────────── */}
      {result && cfg && (
        <div className="space-y-6">

          {/* Traffic Level Card */}
          <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-6`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Left: route info */}
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Journey</p>
                <p className="text-lg font-bold text-slate-800">
                  {result.from} → {result.to}
                </p>
                <p className="text-sm text-slate-500">
                  {result.day}, {result.date} at {result.time}
                </p>
              </div>

              {/* Right: traffic level badge */}
              <div className="flex flex-col items-start sm:items-end gap-2">
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${cfg.badge}`}>
                  <span className="w-2 h-2 rounded-full bg-white opacity-80"></span>
                  {cfg.label}
                </span>
                <p className="text-xs text-slate-500 max-w-xs text-left sm:text-right">{cfg.desc}</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-5 pt-5 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Travel Time', value: `${result.primary_route?.travel_time_min ?? '—'} min` },
                { label: 'Speed',       value: `${result.primary_route?.speed_kmh ?? '—'} km/h` },
                { label: 'Distance',    value: `${result.primary_route?.distance_km ?? '—'} km` },
                { label: 'Delay',       value: result.primary_route?.traffic_delay_min > 0
                    ? `+${result.primary_route.traffic_delay_min} min`
                    : 'No delay' },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-xs text-slate-400 uppercase font-medium">{label}</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Period label */}
            {result.periodLabel && (
              <p className="mt-3 text-xs text-slate-500 text-center">
                Period: <span className="font-medium text-slate-700">{result.periodLabel}</span>
              </p>
            )}
          </div>

          {/* ── Map ─────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Route Map</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Showing route from <strong>{result.from}</strong> to <strong>{result.to}</strong>
              </p>
            </div>
            <JourneyRouteMap
              fromLocation={result.from}
              toLocation={result.to}
              primaryRoute={result.primary_route}
              alternativeRoute={result.alternative_route}
              showAlternative={alternativeChoice === 'yes'}
              trafficPrediction={result.traffic_prediction}
            />
          </div>

          {/* ── Alternative Routes Question ──────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
            <h2 className="text-base font-semibold text-slate-800">
              Would you like to see alternative routes?
            </h2>
            <p className="text-sm text-slate-500">
              We can suggest a bypass corridor to help you avoid congestion.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setAlternativeChoice('yes')}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold border transition ${
                  alternativeChoice === 'yes'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setAlternativeChoice('no')}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold border transition ${
                  alternativeChoice === 'no'
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* ── Alternative Route Details (Yes) ─────────────────────────────── */}
          {alternativeChoice === 'yes' && result.alternative_route && (
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-block text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full mb-2">
                    {result.alternative_route.tag || 'Bypass Route'}
                  </span>
                  <h3 className="text-base font-bold text-slate-800">
                    {result.alternative_route.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Via {result.alternative_route.via || 'Bypass Corridor'}
                  </p>
                </div>
                {result.alternative_route.time_saved_min > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">Time saved</p>
                    <p className="text-lg font-bold text-green-600">
                      ~{result.alternative_route.time_saved_min} min
                    </p>
                  </div>
                )}
              </div>

              {/* Comparison */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Alt. Travel Time', value: `${result.alternative_route.travel_time_min} min`, color: 'text-blue-700' },
                  { label: 'Speed',             value: `${result.alternative_route.bypass_speed_kmh} km/h` },
                  { label: 'Distance',          value: `${result.alternative_route.distance_km} km` },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-xl p-3 text-center border border-blue-100">
                    <p className="text-xs text-slate-400 uppercase font-medium">{label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${color || 'text-slate-800'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Route steps */}
              {result.alternative_route.steps?.length > 0 && (
                <div className="bg-white rounded-xl border border-blue-100 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Route Path</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    {result.alternative_route.steps.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          idx === 0
                            ? 'bg-green-100 text-green-700'
                            : idx === result.alternative_route.steps.length - 1
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {step}
                        </span>
                        {idx < result.alternative_route.steps.length - 1 && (
                          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                          </svg>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Reason */}
              {result.alternative_route.reason && (
                <p className="text-xs text-blue-700 bg-blue-100 rounded-xl px-4 py-3">
                  <strong>Why this route: </strong>{result.alternative_route.reason}
                </p>
              )}

              {/* Google Maps link */}
              {result.alternative_route.google_maps_url && (
                <a href={result.alternative_route.google_maps_url}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  Open in Google Maps
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* ── No alternative chosen ────────────────────────────────────────── */}
          {alternativeChoice === 'no' && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
              <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              <p className="text-sm font-medium text-green-800">Okay! Sticking with your primary route.</p>
              <p className="text-xs text-green-600 mt-1">
                Travel time: <strong>{result.primary_route?.travel_time_min} min</strong> via {result.from} → {result.to}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
