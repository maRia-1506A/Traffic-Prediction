import React from 'react';

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm overflow-hidden bg-white border border-slate-100 p-1">
          <img
            src="/logo/logo.svg"
            alt="TrafficPulse Logo"
            className="w-full h-full object-contain rounded-xl"
          />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">About This Project</h1>
        <p className="text-sm text-slate-500">TrafficPulse — Dhaka Traffic Prediction</p>
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
            { name: 'React 19', desc: 'Frontend UI' },
            { name: 'Node.js / Express', desc: 'Backend API' },
            { name: 'Tailwind CSS', desc: 'Styling' },
            { name: 'Leaflet', desc: 'Map visualization' },
            { name: 'OpenStreetMap', desc: 'Road network data' },
            { name: 'Google Maps API', desc: 'Live routing' },
            { name: 'OpenWeatherMap', desc: 'Weather data' },
            { name: 'Python', desc: 'Data collection' },
            { name: 'Vite', desc: 'Build tooling' },
          ].map(t => (
            <div key={t.name} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
              <p className="text-sm font-medium text-slate-800">{t.name}</p>
              <p className="text-xs text-slate-400">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team / Contributors */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Contributors
        </h2>
        <p className="text-sm text-slate-600">
          Developed as an intelligent transportation system and predictive analytics project for Greater Dhaka by:
        </p>
        <div className="flex flex-col gap-3 pt-1">
          {[
            {
              name: 'Zannatul Farzana Maria',
              github: 'https://github.com/maRia-1506A',
              photo: '/team/zannatul-maria.png',
              initials: 'ZM',
              ringColor: 'ring-indigo-400',
              badgeColor: 'bg-indigo-50 border-indigo-200 text-indigo-700',
              avatarBg: 'bg-indigo-600',
            },
            {
              name: 'K. M. Fathum Mubin',
              github: 'https://github.com/mubin25s',
              photo: '/team/fathum-mubin.jpg',
              initials: 'FM',
              ringColor: 'ring-blue-400',
              badgeColor: 'bg-blue-50 border-blue-200 text-blue-700',
              avatarBg: 'bg-blue-600',
            },
            {
              name: 'Rakib Rohan',
              github: 'https://github.com/Rakib255004',
              photo: '/team/rakib-rohan.png',
              initials: 'RR',
              ringColor: 'ring-emerald-400',
              badgeColor: 'bg-emerald-50 border-emerald-200 text-emerald-700',
              avatarBg: 'bg-emerald-600',
            },
          ].map(c => (
            <div key={c.name} className="flex items-center gap-4 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 hover:border-slate-300 hover:bg-white transition-all duration-150 shadow-2xs">
              {/* Small circular photo */}
              <div className={`w-12 h-12 rounded-full ring-2 ${c.ringColor} ring-offset-2 overflow-hidden shrink-0 ${c.avatarBg}`}>
                <img
                  src={c.photo}
                  alt={c.name}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.classList.add('flex', 'items-center', 'justify-center');
                    e.target.parentElement.innerHTML = `<span class="text-white font-bold text-sm">${c.initials}</span>`;
                  }}
                />
              </div>
              {/* Name & badge */}
              <div className="min-w-0">
                <a
                  href={c.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors leading-snug flex items-center gap-1 group/link"
                >
                  {c.name}
                  <svg className="w-3 h-3 text-slate-400 group-hover/link:text-blue-500 transition-colors shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </a>
                <span className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full mt-1 border ${c.badgeColor}`}>
                  Contributor
                </span>
              </div>
            </div>
          ))}
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

