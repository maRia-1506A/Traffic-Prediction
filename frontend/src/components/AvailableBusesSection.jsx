import React, { useState } from 'react';

export default function AvailableBusesSection({ busTransit, fromLocation, toLocation }) {
  const [expandedBusId, setExpandedBusId] = useState(null);
  const [activeTransferTab, setActiveTransferTab] = useState(0);

  if (!busTransit && !fromLocation && !toLocation) return null;

  const available = busTransit?.available === true;
  const buses = busTransit?.buses || [];
  const count = buses.length;
  const transfer = busTransit?.transfer_suggestion;
  const transferRoutes = busTransit?.transfer_routes || [];

  const toggleExpand = (id) => {
    setExpandedBusId(prev => (prev === id ? null : id));
  };

  const activeTransferRoute = transferRoutes[activeTransferTab] || transferRoutes[0] || null;

  return (
    <div className="mt-6 pt-6 border-t border-slate-200/80">
      {/* ── Section Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 4h8m-8 4h3m4 0h1M5 3h14a2 2 0 012 2v13a2 2 0 01-2 2h-1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2H9v2a1 1 0 01-1 1H6a1 1 0 01-1-1v-2H4a2 2 0 01-2-2V5a2 2 0 012-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Route-Wise Transit & Bus Options
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bengali">
                বাস ও মেট্রোরেল রুট
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              {fromLocation} ⇄ {toLocation}
            </p>
          </div>
        </div>

        {available && count > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {count} Direct Bus{count > 1 ? 'es' : ''} Operating
          </span>
        )}
      </div>

      {/* ── Case 1: Direct Buses Found ── */}
      {available && count > 0 ? (
        <div className="space-y-3">
          {buses.map((bus) => {
            const isExpanded = expandedBusId === bus.id;
            const stops = bus.journey_stoppages || [];

            return (
              <div
                key={bus.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-sm hover:border-emerald-300 transition-colors p-4"
              >
                {/* Top Row: Name, Route Code, Type, Frequency */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-slate-900 tracking-tight font-bengali">
                        {bus.name_bn || bus.name}
                      </span>
                      {bus.name && bus.name !== bus.name_bn && (
                        <span className="text-xs font-medium text-slate-500">
                          ({bus.name})
                        </span>
                      )}
                      {bus.route_code && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {bus.route_code}
                        </span>
                      )}
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {bus.type}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                      Route Corridor: <span className="font-medium text-slate-700">{bus.origin} ⇄ {bus.destination}</span>
                    </p>
                  </div>

                  {/* Frequency & Hours */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between text-xs text-slate-600 shrink-0 gap-1">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                        <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
                      </svg>
                      Every {bus.frequency_min} min
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {bus.operating_hours}
                    </span>
                  </div>
                </div>

                {/* Middle Row: Boarding, Dropoff, Fare */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Boarding Stop</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5" title={bus.from_stop}>
                      📍 {bus.from_stop || fromLocation}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Dropoff Stop</span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5" title={bus.to_stop}>
                      🏁 {bus.to_stop || toLocation}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Estimated Fare</span>
                    <span className="font-bold text-emerald-700 block mt-0.5">
                      ৳{bus.fare_bdt || 25}{' '}
                      <span className="text-[10px] font-normal text-slate-500">
                        (৳{bus.fare_range_bdt})
                      </span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Trip Coverage</span>
                    <span className="font-bold text-blue-700 block mt-0.5">
                      {bus.stops_on_journey} stops on route
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Stoppage Timeline Toggle */}
                {stops.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(bus.id)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1.5 focus:outline-none cursor-pointer"
                    >
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {isExpanded ? 'Hide Stoppages' : `View ${stops.length} Journey Stoppages`}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/70">
                        <p className="text-[11px] font-bold text-slate-600 mb-2 uppercase tracking-wide">
                          Sequential Stoppages ({bus.direction === 'Return' ? 'Reverse Direction' : 'Forward Direction'})
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {stops.map((stopName, sIdx) => {
                            const isFirst = sIdx === 0;
                            const isLast = sIdx === stops.length - 1;

                            return (
                              <React.Fragment key={`${stopName}-${sIdx}`}>
                                <span
                                  className={`px-2.5 py-1 rounded-md font-medium text-xs border ${
                                    isFirst
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                                      : isLast
                                      ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
                                      : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {isFirst && '🟢 '}
                                  {isLast && '🏁 '}
                                  {stopName}
                                </span>
                                {!isLast && (
                                  <span className="text-slate-400 font-bold text-xs select-none">→</span>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        {bus.operator && (
                          <p className="text-[11px] text-slate-400 mt-2.5 italic">
                            Authorized Operator: {bus.operator}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Case 2: No Direct Bus Available -> Rich Multi-Modal Transfer Routing ── */
        <div className="space-y-4">
          {/* Main Notice Banner */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900">
                  No direct bus is available for this route ({fromLocation} → {toLocation})
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  There is currently no direct single bus line operating end-to-end between these two locations.
                  Explore the recommended <strong className="text-slate-800">connecting transfer routes below</strong> using 2-bus transfers, <strong>Dhaka Metro Rail (MRT-6)</strong>, and local feeder transit (Auto-rickshaw, CNG, Rickshaw).
                </p>
              </div>
            </div>
          </div>

          {/* ── Multi-Modal Transfer Option Tabs ── */}
          {transferRoutes.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {transferRoutes.map((route, idx) => {
                  const isSel = idx === activeTransferTab;
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => setActiveTransferTab(idx)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                        isSel
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>
                        {route.type === 'metro_multimodal' ? '🚇' : '🚌'}{' '}
                        {route.title}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isSel ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        ~{route.total_est_time_min}m · ৳{route.total_est_fare_bdt}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Transfer Route Card */}
              {activeTransferRoute && (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900">
                          {activeTransferRoute.title}
                        </span>
                        {activeTransferRoute.tag && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            activeTransferRoute.type === 'metro_multimodal'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {activeTransferRoute.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {activeTransferRoute.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shrink-0 self-start sm:self-auto">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Est. Time</span>
                        <span className="font-bold text-slate-800">~{activeTransferRoute.total_est_time_min} mins</span>
                      </div>
                      <div className="w-px h-6 bg-slate-200"></div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Total Fare</span>
                        <span className="font-bold text-emerald-700">~৳{activeTransferRoute.total_est_fare_bdt}</span>
                      </div>
                    </div>
                  </div>

                  {/* Step-by-Step Stepper */}
                  <div className="space-y-4">
                    {activeTransferRoute.legs.map((leg) => {
                      const isMetro = leg.mode === 'metro';
                      const isTransfer = leg.mode === 'transfer';

                      return (
                        <div
                          key={leg.step_num}
                          className={`relative flex items-start gap-3 p-3.5 rounded-xl border ${
                            isMetro
                              ? 'bg-purple-50/60 border-purple-200'
                              : isTransfer
                              ? 'bg-amber-50/60 border-amber-200'
                              : 'bg-slate-50/70 border-slate-200'
                          }`}
                        >
                          {/* Step Number Badge */}
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isMetro
                              ? 'bg-purple-600 text-white shadow-xs'
                              : isTransfer
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-blue-600 text-white shadow-xs'
                          }`}>
                            {leg.step_num}
                          </div>

                          <div className="flex-1 space-y-1.5">
                            {/* Step Header */}
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                  {leg.mode_label}
                                </span>
                                {leg.mode_icon && <span>{leg.mode_icon}</span>}
                              </div>

                              <div className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                                {leg.est_time_min > 0 && (
                                  <span>~{leg.est_time_min} min</span>
                                )}
                                {leg.est_fare_bdt > 0 && (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                                    ৳{leg.est_fare_bdt}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Instruction */}
                            <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                              {leg.instructions}
                            </p>

                            {/* Bus Options Pill List */}
                            {leg.buses && leg.buses.length > 0 && (
                              <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
                                  🚌 Direct Bus Services:
                                </span>
                                {leg.buses.map((b, bIdx) => (
                                  <span
                                    key={bIdx}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-slate-800 text-xs font-bold shadow-2xs flex items-center gap-1"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    {b.name_bn || b.name}
                                    {b.name && b.name !== b.name_bn && (
                                      <span className="text-[10px] font-normal text-slate-400">
                                        ({b.name})
                                      </span>
                                    )}
                                    {b.route_code && (
                                      <span className="text-[9px] px-1 bg-slate-100 rounded text-slate-500">
                                        {b.route_code}
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Shared Bus & Leguna Services */}
                            {leg.shared_transit_services && leg.shared_transit_services.length > 0 && (
                              <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                                  🚐 Shared Bus / Leguna:
                                </span>
                                {leg.shared_transit_services.map((st, stIdx) => (
                                  <span
                                    key={stIdx}
                                    className="px-2.5 py-1 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-950 text-xs font-bold shadow-2xs flex items-center gap-1"
                                  >
                                    🚐 {st.name_bn || st.name}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Local Transport Options Pill List */}
                            {leg.local_transports && leg.local_transports.length > 0 && (
                              <div className="pt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-medium text-slate-500">
                                  Available Local Modes:
                                </span>
                                {leg.local_transports.map((lt, ltIdx) => (
                                  <span
                                    key={ltIdx}
                                    className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold"
                                  >
                                    🛺 {lt}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Metro Line Details */}
                            {leg.metro_line && (
                              <div className="pt-1 flex items-center gap-2">
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white">
                                  MRT LINE 6
                                </span>
                                <span className="text-[11px] text-purple-700 font-medium">
                                  {leg.from} → {leg.to}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Standard Interchange Summary */}
          {(!transferRoutes || transferRoutes.length === 0) && transfer && (
            <div className="p-3.5 rounded-xl bg-white border border-amber-200/80 text-xs text-slate-700 space-y-1">
              <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Recommended Transit Interchange Hub:
              </p>
              <p className="font-bold text-slate-800">
                {transfer.interchange_hub}
              </p>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                {transfer.guidance}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
