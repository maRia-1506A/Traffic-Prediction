import React, { useState, useEffect, useRef } from 'react';
import { ALL_DHAKA_LOCATIONS } from '../utils/journeyPredictor.js';
import { predictJourneyApi, fetchBusesBetween } from '../api.js';
import JourneyRouteMap from './JourneyRouteMap.jsx';
import IsometricTransitMap from './IsometricTransitMap.jsx';

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

const SEGMENT_TRAFFIC_STYLES = {
  Low: 'bg-green-50 text-green-700 border-green-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  High: 'bg-red-50 text-red-700 border-red-200',
};

function RoutePathSection({ steps = [], checkpoints = [], roadSegments = [] }) {
  // Construct clean, deduplicated chronological steps including intermediate waypoints
  const effectiveSteps = (() => {
    if (Array.isArray(steps) && steps.length > 2) return steps;
    const fromName = steps[0] || 'Origin';
    const toName = steps[steps.length - 1] || 'Destination';
    const middle = (checkpoints || [])
      .map(c => c.name)
      .filter(n => n && n.toLowerCase() !== fromName.toLowerCase() && n.toLowerCase() !== toName.toLowerCase());
    return [fromName, ...middle, toName];
  })();

  if (!effectiveSteps.length) return null;

  const intermediateWaypoints = effectiveSteps.slice(1, -1);

  const telemetrySegments = [];
  if (Array.isArray(roadSegments)) {
    for (const seg of roadSegments) {
      if (!seg?.observed_telemetry?.level || !seg?.name) continue;
      const prev = telemetrySegments[telemetrySegments.length - 1];
      if (prev && prev.name === seg.name && prev.level === seg.observed_telemetry.level) continue;
      telemetrySegments.push({
        name: seg.name,
        level: seg.observed_telemetry.level,
        speedKmh: seg.observed_telemetry.speed_kmh,
      });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-blue-100 p-4 space-y-3.5 shadow-xs">
      {/* 1. Step-by-Step Route Sequence */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Route Path (Step-by-Step Sequence)
          </p>
          <span className="text-[11px] text-slate-500 font-medium">
            {effectiveSteps.length} stops ({intermediateWaypoints.length} intermediate waypoints)
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {effectiveSteps.map((step, idx) => {
            const isStart = idx === 0;
            const isEnd = idx === effectiveSteps.length - 1;
            const label = isStart
              ? (/\(Start\)$/i.test(step) ? step : `${step} (Start)`)
              : isEnd
              ? (/\(Destination\)$/i.test(step) ? step : `${step} (Destination)`)
              : step;
            return (
              <React.Fragment key={idx}>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold shadow-2xs ${
                  isStart
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : isEnd
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {label}
                </span>
                {!isEnd && (
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                  </svg>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 2. Intermediate Waypoints Detail List */}
      {intermediateWaypoints.length > 0 && (
        <div className="pt-2.5 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
            Intermediate Waypoints & Flyovers along Route
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {intermediateWaypoints.map((wp, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700"
              >
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="font-semibold truncate">{wp}</span>
                <span className="ml-auto text-[10px] text-slate-500 font-medium">Waypoint</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Observed Segment Traffic (Historical CSV Telemetry) */}
      {telemetrySegments.length > 0 && (
        <div className="pt-2.5 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
            Observed Road Segment Telemetry (Historical Sensor Baseline)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {telemetrySegments.map((seg, idx) => (
              <span
                key={`${seg.name}-${idx}`}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                  SEGMENT_TRAFFIC_STYLES[seg.level] || 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {seg.name}: <span className="underline">{seg.level}</span>{seg.speedKmh ? ` · ${seg.speedKmh} km/h` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TrafficJourneyPredictor() {
  const todayStr = new Date().toISOString().split('T')[0];
  const timePickerRef = useRef(null);
  const timeTriggerRef = useRef(null);
  const hourInputRef = useRef(null);
  const minuteInputRef = useRef(null);

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

  const openTimePicker = () => {
    setTimePickerOpen(prev => {
      const next = !prev;
      if (next && selectedTime) {
        const [h, m] = selectedTime.split(':').map(Number);
        setPickerAmPm(h >= 12 ? 'PM' : 'AM');
        setPickerHour(String(h % 12 || 12).padStart(2, '0'));
        setPickerMinute(String(m).padStart(2, '0'));
      }
      return next;
    });
  };

  const clampHour = (val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) return '12';
    if (num > 12) return '12';
    return String(num).padStart(2, '0');
  };

  const clampMinute = (val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return '00';
    if (num > 59) return '59';
    return String(num).padStart(2, '0');
  };

  const handleTimeOk = () => {
    const h = clampHour(pickerHour);
    const m = clampMinute(pickerMinute);
    setPickerHour(h);
    setPickerMinute(m);
    // Convert to 24h for internal value
    let hour24 = parseInt(h, 10);
    if (pickerAmPm === 'PM' && hour24 !== 12) hour24 += 12;
    if (pickerAmPm === 'AM' && hour24 === 12) hour24 = 0;
    const time24 = `${String(hour24).padStart(2,'0')}:${m}`;
    setSelectedTime(time24);
    setTimePickerOpen(false);
    timeTriggerRef.current?.focus();
  };

  const handleTimeClear = () => {
    setPickerHour('12'); setPickerMinute('00'); setPickerAmPm('AM');
    setSelectedTime('');
    setTimePickerOpen(false);
    timeTriggerRef.current?.focus();
  };

  const handleTimePickerKeyDown = (e) => {
    if (!timePickerOpen) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleTimeOk();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setTimePickerOpen(false);
      timeTriggerRef.current?.focus();
    } else if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      setPickerAmPm('AM');
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      setPickerAmPm('PM');
    }
  };

  const setQuickTime = (time24) => {
    setSelectedTime(time24);
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = h % 12 || 12;
    setPickerHour(String(h12).padStart(2,'0'));
    setPickerMinute(String(m).padStart(2,'0'));
    setPickerAmPm(ampm);
    setTimePickerOpen(false);
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
  const [selectedAltIndex, setSelectedAltIndex]   = useState('primary');
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
    setSelectedAltIndex('primary');
  };

  // Validate + submit
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // If time picker is open, Enter must confirm the selected time instead of submitting
    if (timePickerOpen) {
      handleTimeOk();
      return;
    }
    if (loading) return;

    setFormError('');

    if (!selectedDate) { setFormError('Please select a travel date.'); return; }
    if (!selectedTime) { setFormError('Please select a travel time.'); return; }
    if (!fromLocation) { setFormError('Please select a starting location.'); return; }
    if (!toLocation)   { setFormError('Please select a destination.'); return; }
    if (fromLocation === toLocation) { setFormError('Origin and destination cannot be the same.'); return; }

    setLoading(true);
    setResult(null);
    setError(null);
    setSelectedAltIndex('primary');

    try {
      const data = await predictJourneyApi({
        date: selectedDate,
        day:  dayName,
        time: selectedTime,
        from: fromLocation,
        to:   toLocation,
      });

      let busTransitData = data?.bus_transit;
      if (!busTransitData || !busTransitData.buses) {
        try {
          const busRes = await fetchBusesBetween(fromLocation, toLocation);
          if (busRes) {
            busTransitData = busRes;
          }
        } catch (_) {}
      }

      setResult({ ...data, bus_transit: busTransitData });
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
            <div className="space-y-1.5 relative" ref={timePickerRef} onKeyDown={handleTimePickerKeyDown}>
              <label className="block text-sm font-medium text-slate-700">
                Travel Time
              </label>

              {/* Display field + inline OK button when open */}
              <div className="flex items-center gap-2">
                <button
                  ref={timeTriggerRef}
                  type="button"
                  onClick={openTimePicker}
                  aria-expanded={timePickerOpen}
                  aria-haspopup="dialog"
                  className={`flex-1 text-left border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white flex items-center justify-between ${selectedTime ? 'text-slate-800' : 'text-slate-400'}`}
                >
                  <span>{selectedTime ? formatDisplayTime(selectedTime) : 'Select time'}</span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </button>
              </div>

              {/* Custom Time Picker dropdown with visible OK button beside controls */}
              {timePickerOpen && (
                <div
                  role="dialog"
                  aria-label="Select travel time"
                  className="absolute left-0 right-0 sm:right-auto z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3.5 sm:min-w-[305px]"
                >
                  <div className="flex items-center gap-2">
                    {/* Hour (01-12) — keyboard typable + ArrowUp/Down */}
                    <input
                      ref={hourInputRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      autoFocus
                      aria-label="Hour"
                      value={pickerHour}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        if (raw === '') {
                          setPickerHour('');
                          return;
                        }
                        let digits = raw;
                        if (digits.length > 2) {
                          digits = digits.slice(-2);
                        }
                        const num = parseInt(digits, 10);
                        if (digits.length === 2 && (num < 1 || num > 12)) {
                          const latest = parseInt(digits[1], 10);
                          digits = latest >= 1 ? String(latest) : '12';
                        }
                        setPickerHour(digits);
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setPickerHour(clampHour(val));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const cur = parseInt(pickerHour, 10) || 12;
                          const next = (cur % 12) + 1;
                          setPickerHour(String(next).padStart(2, '0'));
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const cur = parseInt(pickerHour, 10) || 12;
                          const prev = cur <= 1 ? 12 : cur - 1;
                          setPickerHour(String(prev).padStart(2, '0'));
                        } else if (e.key === 'ArrowRight' || e.key === ':') {
                          e.preventDefault();
                          minuteInputRef.current?.focus();
                          minuteInputRef.current?.select();
                        }
                      }}
                      className="w-12 text-center border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <span className="text-slate-500 font-bold">:</span>

                    {/* Minute (00-59) — keyboard typable + ArrowUp/Down */}
                    <input
                      ref={minuteInputRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      aria-label="Minute"
                      value={pickerMinute}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        if (raw === '') {
                          setPickerMinute('');
                          return;
                        }
                        let digits = raw;
                        if (digits.length > 2) {
                          digits = digits.slice(-2);
                        }
                        const num = parseInt(digits, 10);
                        if (num > 59) {
                          const latest = parseInt(digits[1], 10);
                          digits = String(latest);
                        }
                        setPickerMinute(digits);
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setPickerMinute(clampMinute(val));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const next = ((parseInt(pickerMinute, 10) || 0) + 1) % 60;
                          setPickerMinute(String(next).padStart(2, '0'));
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const cur = parseInt(pickerMinute, 10) || 0;
                          const prev = cur <= 0 ? 59 : cur - 1;
                          setPickerMinute(String(prev).padStart(2, '0'));
                        } else if (e.key === 'ArrowLeft') {
                          e.preventDefault();
                          hourInputRef.current?.focus();
                          hourInputRef.current?.select();
                        }
                      }}
                      className="w-12 text-center border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* AM / PM toggle */}
                    <div className="flex rounded-lg border border-slate-300 overflow-hidden shrink-0">
                      {['AM', 'PM'].map(period => (
                        <button
                          key={period}
                          type="button"
                          onClick={() => setPickerAmPm(period)}
                          className={`px-2 py-1.5 text-xs font-semibold transition ${
                            pickerAmPm === period
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>

                    {/* Clearly visible OK button immediately beside the controls */}
                    <button
                      type="button"
                      onClick={handleTimeOk}
                      className="ml-auto px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition shrink-0"
                    >
                      OK
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-slate-100 mt-3 pt-2">
                    <button
                      type="button"
                      onClick={handleTimeClear}
                      className="text-xs text-slate-500 hover:text-slate-700 transition"
                    >
                      Clear
                    </button>
                    <span className="text-[11px] text-slate-400">
                      Press Enter or click OK
                    </span>
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
              showAlternative={altList.length > 0}
              selectedAltIndex={selectedAltIndex}
              onSelectAlternative={(idx) => setSelectedAltIndex(idx)}
              trafficPrediction={result.traffic_prediction}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
            />
          </div>

          {/* ── Selected Route & Alternative Routes Details ───────────────────── */}
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 space-y-4">
            {altList.length > 0 && (
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

              {(selectedAltIndex === 'primary' || !activeAlt) ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="inline-block text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full mb-2">
                        Primary Route · {result.traffic_prediction} Traffic
                      </span>
                      <h3 className="text-base font-bold text-slate-800">
                        {result.primary_route?.name || `${result.from} to ${result.to}`}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {result.primary_route?.matchedCorridor || 'Primary Dhaka Corridor'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: result.primary_route?.is_estimate !== false ? 'Est. Travel Time' : 'Travel Time', value: `${result.primary_route?.travel_time_min ?? '—'} min`, color: 'text-blue-700' },
                      { label: result.primary_route?.is_estimate !== false ? 'Est. Speed' : 'Speed',             value: `${result.primary_route?.speed_kmh ?? '—'} km/h` },
                      { label: 'Distance',                                                                        value: `${result.primary_route?.distance_km ?? '—'} km` },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-white rounded-xl p-3 text-center border border-blue-100">
                        <p className="text-xs text-slate-400 uppercase font-medium">{label}</p>
                        <p className={`text-sm font-bold mt-0.5 ${color || 'text-slate-800'}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Primary route steps */}
                  <RoutePathSection
                    steps={result.primary_route?.steps}
                    checkpoints={result.primary_route?.checkpoints}
                    roadSegments={result.primary_route?.road_segments}
                  />

                  {result.primary_route?.google_maps_url && (
                    <a href={result.primary_route.google_maps_url}
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
                </>
              ) : activeAlt && (
                <>
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
                  <RoutePathSection
                    steps={activeAlt.steps}
                    checkpoints={activeAlt.checkpoints}
                    roadSegments={activeAlt.road_segments}
                  />

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
                </>
              )}

              {/* ── Route-Wise Multi-Modal Transit Isometric Map ── */}
              <IsometricTransitMap
                busTransit={result.bus_transit}
                fromLocation={result.from || fromLocation}
                toLocation={result.to || toLocation}
              />
            </div>
        </div>
      )}
    </div>
  );
}
