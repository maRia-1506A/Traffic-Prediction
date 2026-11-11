import React, { useState, useEffect, useRef } from 'react';
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
  const timePickerRef = useRef(null);

  // Form state — empty by default so user must choose
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation]     = useState('');

  // Custom time picker state
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [pickerHour,   setPickerHour]   = useState('12');
  const [pickerMinute, setPickerMinute] = useState('00');
  const [pickerAmPm,   setPickerAmPm]   = useState('AM');

  // Close picker when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target)) {
        setTimePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTimeOk = () => {
    const h = pickerHour.padStart(2, '0');
    const m = pickerMinute.padStart(2, '0');
    // Convert to 24h for internal value
    let hour24 = parseInt(h, 10);
    if (pickerAmPm === 'PM' && hour24 !== 12) hour24 += 12;
    if (pickerAmPm === 'AM' && hour24 === 12) hour24 = 0;
    const time24 = `${String(hour24).padStart(2,'0')}:${m}`;
    setSelectedTime(time24);
    setTimePickerOpen(false);
  };

  const handleTimeClear = () => {
    setPickerHour('12'); setPickerMinute('00'); setPickerAmPm('AM');
    setSelectedTime('');
    setTimePickerOpen(false);
  };

  const setQuickTime = (time24) => {
    setSelectedTime(time24);
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = h % 12 || 12;
    setPickerHour(String(h12).padStart(2,'0'));
    setPickerMinute(String(m).padStart(2,'0'));
    setPickerAmPm(ampm);
  };

  // Format display time (24h → 12h display)
  const formatDisplayTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = h % 12 || 12;
    return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
  };

  // UI state
  const [loading, setLoading]               = useState(false);
  const [result, setResult]                 = useState(null);
  const [error, setError]                   = useState(null);
  const [alternativeChoice, setAlternativeChoice] = useState(null); // null | 'yes' | 'no'
  const [selectedAltIndex, setSelectedAltIndex]   = useState(0);
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
    setSelectedAltIndex(0);

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
  const altList = result?.alternative_routes?.length
    ? result.alternative_routes
    : result?.alternative_route
    ? [result.alternative_route]
    : [];
  const activeAltCardIdx = typeof selectedAltIndex === 'number' ? selectedAltIndex : 0;
  const activeAlt = altList[activeAltCardIdx] || result?.alternative_route || null;
  const ALT_ROUTE_COLORS = ['#7c3aed', '#0d9488', '#ea580c']; // Purple, Teal, Orange

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 relative">

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
                placeholder="Select date"
                className={`w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${!selectedDate ? 'text-slate-400' : 'text-slate-800'}`}
              />
              {selectedDate && dayName && (
                <div className="flex pt-0.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    isWeekendDay ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {dayName}
                  </span>
                </div>
              )}
            </div>

            {/* Travel Time — custom picker */}
            <div className="space-y-1.5" ref={timePickerRef}>
              <label className="block text-sm font-medium text-slate-700">
                Travel Time
              </label>

              {/* Display field */}
              <button
                type="button"
                onClick={() => setTimePickerOpen(v => !v)}
                className={`w-full text-left border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white flex items-center justify-between ${selectedTime ? 'text-slate-800' : 'text-slate-400'}`}
              >
                <span>{selectedTime ? formatDisplayTime(selectedTime) : 'Select time'}</span>
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </button>

              {/* Picker dropdown */}
              {timePickerOpen && (
                <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg w-64 overflow-hidden">
                  {/* Native clock input */}
                  <div className="flex items-center justify-center p-4 pb-3">
                    <input
                      type="time"
                      autoFocus
                      value={(() => {
                        let h = parseInt(pickerHour, 10);
                        if (pickerAmPm === 'PM' && h !== 12) h += 12;
                        if (pickerAmPm === 'AM' && h === 12) h = 0;
                        return `${String(h).padStart(2,'0')}:${pickerMinute}`;
                      })()}
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) return;
                        const [h, m] = val.split(':').map(Number);
                        setPickerAmPm(h >= 12 ? 'PM' : 'AM');
                        setPickerHour(String(h % 12 || 12).padStart(2,'0'));
                        setPickerMinute(String(m).padStart(2,'0'));
                      }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  {/* Footer — Clear / OK like the date picker */}
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
                    <button type="button" onClick={handleTimeClear}
                      className="text-sm text-slate-500 hover:text-slate-700 transition">
                      Clear
                    </button>
                    <button type="button" onClick={handleTimeOk}
                      className="text-sm text-blue-600 font-semibold hover:text-blue-800 transition">
                      OK
                    </button>
                  </div>
                </div>
              )}

              {/* Quick picks */}
              <div className="flex gap-2 pt-0.5">
                {[['08:30','Morning Peak'],['14:00','Midday'],['18:30','Evening Peak']].map(([t,l]) => (
                  <button key={t} type="button" onClick={() => setQuickTime(t)}
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
                className={`w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white ${!fromLocation ? 'text-slate-400' : 'text-slate-800'}`}
              >
                <option value="" disabled>Select origin</option>
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
                className={`w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white ${!toLocation ? 'text-slate-400' : 'text-slate-800'}`}
              >
                <option value="" disabled>Select destination</option>
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
                { label: result.primary_route?.is_estimate !== false ? 'Est. Travel Time' : 'Travel Time', value: `${result.primary_route?.travel_time_min ?? '—'} min` },
                { label: result.primary_route?.is_estimate !== false ? 'Est. Speed' : 'Speed',             value: `${result.primary_route?.speed_kmh ?? '—'} km/h` },
                { label: 'Distance',                                                                        value: `${result.primary_route?.distance_km ?? '—'} km` },
                { label: result.primary_route?.is_estimate !== false ? 'Est. Delay' : 'Delay',             value: result.primary_route?.traffic_delay_min > 0
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

          {/* ── Map (Main visual focus) ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
            <JourneyRouteMap
              fromLocation={result.from}
              toLocation={result.to}
              primaryRoute={result.primary_route}
              alternativeRoutes={altList}
              alternativeRoute={result.alternative_route}
              showAlternative={alternativeChoice === 'yes'}
              selectedAltIndex={selectedAltIndex}
              onSelectAlternative={(idx) => {
                setSelectedAltIndex(idx);
                if (alternativeChoice !== 'yes') setAlternativeChoice('yes');
              }}
              onToggleAlternative={(show) => {
                setAlternativeChoice(show ? 'yes' : 'no');
                if (show && selectedAltIndex === 'primary') setSelectedAltIndex(0);
              }}
              trafficPrediction={result.traffic_prediction}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
            />
          </div>

          {/* ── Alternative Routes Question ──────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
            <h2 className="text-base font-semibold text-slate-800">
              Would you like to see alternative routes?
            </h2>
            <p className="text-sm text-slate-500">
              We can suggest bypass corridors to help you avoid congestion.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setAlternativeChoice('yes');
                  if (selectedAltIndex === 'primary') setSelectedAltIndex(0);
                }}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold border transition ${
                  alternativeChoice === 'yes'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => {
                  setAlternativeChoice('no');
                  setSelectedAltIndex(0);
                }}
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
          {alternativeChoice === 'yes' && activeAlt && (
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 space-y-4">
              {altList.length >= 1 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAltIndex('primary')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
                      selectedAltIndex === 'primary'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: selectedAltIndex === 'primary' ? '#ffffff' : '#2563eb' }}
                    />
                    <span>Primary Route</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      selectedAltIndex === 'primary' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {result.traffic_prediction} · {result.primary_route?.travel_time_min}m
                    </span>
                  </button>

                  {altList.map((alt, idx) => {
                    const routeCol = ALT_ROUTE_COLORS[idx % ALT_ROUTE_COLORS.length];
                    const isSel = selectedAltIndex === idx;
                    return (
                      <button
                        key={alt.id || idx}
                        type="button"
                        onClick={() => setSelectedAltIndex(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
                          isSel
                            ? 'text-white shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                        }`}
                        style={isSel ? { backgroundColor: routeCol, borderColor: routeCol } : undefined}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: isSel ? '#ffffff' : routeCol }}
                        />
                        <span>Alt {idx + 1}: {alt.via || alt.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          isSel ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {alt.traffic_prediction || 'Low'} · {alt.travel_time_min}m
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-block text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full mb-2">
                    {activeAlt.tag || 'Bypass Route'} · {activeAlt.traffic_prediction || 'Low'} Traffic
                  </span>
                  <h3 className="text-base font-bold text-slate-800">
                    {activeAlt.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Via {activeAlt.via || 'Bypass Corridor'}
                  </p>
                </div>
                {activeAlt.time_saved_min !== undefined && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">
                      {activeAlt.time_saved_min >= 0 ? 'Est. time saved' : 'vs Primary'}
                    </p>
                    <p className={`text-lg font-bold ${
                      activeAlt.time_saved_min > 0
                        ? 'text-green-600'
                        : activeAlt.time_saved_min < 0
                        ? 'text-amber-600'
                        : 'text-slate-600'
                    }`}>
                      {activeAlt.time_saved_min > 0
                        ? `~${activeAlt.time_saved_min} min`
                        : activeAlt.time_saved_min < 0
                        ? `+${Math.abs(activeAlt.time_saved_min)} min`
                        : '0 min'}
                    </p>
                  </div>
                )}
              </div>

              {/* Comparison */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: activeAlt.is_estimate !== false ? 'Est. Alt. Time' : 'Alt. Travel Time', value: `${activeAlt.travel_time_min} min`, color: 'text-blue-700' },
                  { label: 'Est. Speed',       value: `${activeAlt.bypass_speed_kmh} km/h` },
                  { label: 'Distance',         value: `${activeAlt.distance_km} km` },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-xl p-3 text-center border border-blue-100">
                    <p className="text-xs text-slate-400 uppercase font-medium">{label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${color || 'text-slate-800'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Route steps */}
              {activeAlt.steps?.length > 0 && (
                <div className="bg-white rounded-xl border border-blue-100 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Route Path</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    {activeAlt.steps.map((step, idx) => (
                      <React.Fragment key={idx}>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          idx === 0
                            ? 'bg-green-100 text-green-700'
                            : idx === activeAlt.steps.length - 1
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {step}
                        </span>
                        {idx < activeAlt.steps.length - 1 && (
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
              {activeAlt.reason && (
                <p className="text-xs text-blue-700 bg-blue-100 rounded-xl px-4 py-3">
                  <strong>Why this route: </strong>{activeAlt.reason}
                </p>
              )}

              {/* Google Maps link */}
              {activeAlt.google_maps_url && (
                <a href={activeAlt.google_maps_url}
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
