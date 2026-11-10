import { predictJourneyTraffic } from './utils/journeyPredictor.js';

// API Service for Dhaka Traffic Prediction System

const API_BASE = '/api';

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}

export async function fetchRoutes(params = {}) {
  const query = new URLSearchParams();
  if (params.level && params.level !== 'ALL') query.set('level', params.level);
  if (params.search) query.set('search', params.search);

  const res = await fetch(`${API_BASE}/routes?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch corridors');
  return res.json();
}

export async function fetchRouteDetails(routeCode) {
  const res = await fetch(`${API_BASE}/routes/${routeCode}`);
  if (!res.ok) throw new Error(`Failed to fetch corridor ${routeCode}`);
  return res.json();
}

export async function fetchWaypoints() {
  const res = await fetch(`${API_BASE}/waypoints`);
  if (!res.ok) throw new Error('Failed to fetch strategic waypoints');
  return res.json();
}

export async function fetchHistory(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.level && params.level !== 'ALL') query.set('level', params.level);
  if (params.search) query.set('search', params.search);

  const res = await fetch(`${API_BASE}/history?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch historical dataset');
  return res.json();
}

export async function evaluateBypassAdvisor(payload) {
  const res = await fetch(`${API_BASE}/advisor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to run bypass advisor');
  return res.json();
}

export async function simulateTrafficPrediction(payload) {
  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to run traffic simulation');
  return res.json();
}

export async function fetchRoadSummary() {
  const res = await fetch(`${API_BASE}/roads/summary`);
  if (!res.ok) throw new Error('Failed to fetch OSM road summary');
  return res.json();
}

export async function fetchLiveWeather() {
  try {
    const res = await fetch(`${API_BASE}/weather`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json.data;
    }
  } catch (err) {
    console.warn('Weather API fetch failed:', err.message);
  }
  return {
    city: 'Dhaka',
    condition: 'Haze',
    temperature_c: 25.0,
    humidity_pct: 78,
    visibility_km: 6.0,
    surface_condition: 'Dry',
    source: 'Fallback'
  };
}

export async function fetchEngineStatus() {
  try {
    const res = await fetch(`${API_BASE}/engine-status`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json.data;
    }
  } catch (err) {
    console.warn('Engine status fetch failed:', err.message);
  }
  return null;
}

export async function predictJourneyApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/predict-journey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('API /api/predict-journey unavailable, utilizing client-side prediction engine:', err.message);
  }

  // Fallback to local client-side prediction engine
  return predictJourneyTraffic(payload);
}

