import React from 'react';

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">About This Project</h1>
        <p className="text-sm text-slate-500">Dhaka Traffic Prediction System</p>
      </div>

      {/* Purpose */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Project Purpose
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Dhaka is one of the most traffic-congested cities in the world.
          This project aims to predict traffic congestion levels across major Dhaka
          corridors using historical traffic data, real-time weather conditions, and
          time-of-day patterns.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Users can input their planned journey details — date, time, origin, and destination —
          and receive a traffic prediction (Low, Medium, or High). The system also suggests
          alternative bypass routes when congestion is expected to be severe.
        </p>
      </section>

      {/* Approach */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Machine Learning Approach
        </h2>
        <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
          <p>
            The prediction engine uses a combination of rule-based rush-hour modeling and
            API-driven real-time data to estimate traffic conditions:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Rush-hour patterns:</strong> Calibrated multipliers for morning peak (8:00–10:30),
              evening peak (17:00–21:00), midday, and late-night periods, with separate
              models for weekdays and weekends (Friday/Saturday in Bangladesh).
            </li>
            <li>
              <strong>Weather impact:</strong> Real-time weather data from OpenWeatherMap API is used to
              apply friction penalties — heavy rain increases travel time by up to 55%.
            </li>
            <li>
              <strong>Google Maps Routes API:</strong> When available, live route data from Google Maps
              provides ground-truth travel times, speeds, and delay information.
            </li>
            <li>
              <strong>OSM road network:</strong> 593 road segments fetched from OpenStreetMap Overpass API
              provide the underlying road topology for route planning.
            </li>
            <li>
              <strong>Alternative routing:</strong> Strategic bypass waypoints (flyovers, expressways,
              arterial roads) are evaluated using Haversine distance calculations to suggest
              faster detours when the primary route is congested.
            </li>
          </ul>
        </div>
      </section>

      {/* Technologies */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Technologies Used
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { name: 'React 19',           desc: 'Frontend UI' },
            { name: 'Node.js / Express',   desc: 'Backend API' },
            { name: 'Tailwind CSS',        desc: 'Styling' },
            { name: 'Leaflet',             desc: 'Map visualization' },
            { name: 'OpenStreetMap',        desc: 'Road network data' },
            { name: 'Google Maps API',      desc: 'Live routing' },
            { name: 'OpenWeatherMap',       desc: 'Weather data' },
            { name: 'Python',              desc: 'Data collection' },
            { name: 'Vite',                desc: 'Build tooling' },
          ].map(t => (
            <div key={t.name} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
              <p className="text-sm font-medium text-slate-800">{t.name}</p>
              <p className="text-xs text-slate-400">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Project Team
        </h2>
        <p className="text-sm text-slate-600">
          This is an academic project developed as part of a university coursework on
          traffic prediction and intelligent transportation systems.
        </p>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Contributors:</p>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            <li>Zannatul Maria — Frontend & Road Data</li>
            <li>Team Member — Google Maps API & Backend</li>
          </ul>
        </div>
      </section>

      {/* Data sources */}
      <section className="bg-blue-50 rounded-2xl border border-blue-200 p-6 space-y-2">
        <h2 className="text-base font-semibold text-blue-800">Data Sources</h2>
        <ul className="text-sm text-blue-700 space-y-1 list-disc pl-5">
          <li>OpenStreetMap Overpass API — Road network geometry (593 segments)</li>
          <li>Google Maps Routes API v2 — Live routing and travel time estimates</li>
          <li>OpenWeatherMap API — Real-time weather observations for Dhaka</li>
          <li>Historical traffic logs — Collected via automated Python scripts</li>
        </ul>
      </section>
    </div>
  );
}

