import React, { useState } from 'react';
import Navbar from './components/Navbar';
import TrafficJourneyPredictor from './components/TrafficJourneyPredictor';
import ExploreMap from './components/ExploreMap';
import TrafficInsights from './components/TrafficInsights';
import DhakaBusDirectory from './components/DhakaBusDirectory';
import AboutPage from './components/AboutPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  const renderContent = () => {
    switch (activeTab) {
      case 'home':     return <TrafficJourneyPredictor />;
      case 'map':      return <ExploreMap />;
      case 'insights': return <TrafficInsights />;
      case 'buses':    return <DhakaBusDirectory />;
      case 'about':    return <AboutPage />;
      default:         return <TrafficJourneyPredictor />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {renderContent()}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto py-5 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <img src="/logo/logo.svg" alt="TrafficPulse Logo" className="w-5 h-5 rounded-md object-contain shadow-2xs" />
            <p className="text-sm font-semibold text-slate-800">TrafficPulse</p>
          </div>
          <p className="text-xs text-slate-400">
            OSM Road Network · Google Maps Routes API · OpenWeatherMap · React · Node.js · Leaflet
          </p>
        </div>
      </footer>
    </div>
  );
}
