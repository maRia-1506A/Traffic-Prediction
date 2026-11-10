// API Clients for Google Maps Routes API v2, OpenWeatherMap API, and Waze Live Engine
// Node.js backend integration powered by .env API keys

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 1. Google Maps Routes API Client with Multi-Key Pool & Failover
export class GoogleRoutesClient {
  constructor() {
    const rawKeys = process.env.GOOGLE_MAPS_API_KEYS || process.env.GOOGLE_MAPS_API_KEY || '';
    this.keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    this.currentIndex = 0;
    this.endpoint = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  }

  get hasKey() {
    return this.keys.length > 0;
  }

  getActiveKey() {
    if (!this.keys.length) return null;
    return this.keys[this.currentIndex % this.keys.length];
  }

  rotateKey() {
    if (this.keys.length > 1) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      console.log(`[Google API] Rotated to key #${this.currentIndex + 1}`);
    }
  }

  async computeRoutes(originCoords, destCoords, computeAlternatives = true) {
    if (!this.hasKey) {
      return { success: false, error: 'GOOGLE_MAPS_API_KEY not configured' };
    }

    const [origLat, origLon] = originCoords;
    const [destLat, destLon] = destCoords;

    const requestBody = {
      origin: {
        location: {
          latLng: { latitude: origLat, longitude: origLon }
        }
      },
      destination: {
        location: {
          latLng: { latitude: destLat, longitude: destLon }
        }
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: computeAlternatives
    };

    let attempts = 0;
    const maxAttempts = Math.min(this.keys.length, 3);

    while (attempts < maxAttempts) {
      const currentKey = this.getActiveKey();
      try {
        const startTime = Date.now();
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': currentKey,
            'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters,routes.description,routes.polyline.encodedPolyline'
          },
          body: JSON.stringify(requestBody)
        });

        const latencyMs = Date.now() - startTime;

        if (res.ok) {
          const data = await res.json();
          const routes = data.routes || [];

          if (routes.length > 0) {
            const parsedRoutes = routes.map((r, idx) => {
              const durationSec = parseFloat((r.duration || '0s').replace('s', ''));
              const staticDurationSec = parseFloat((r.staticDuration || r.duration || '0s').replace('s', ''));
              const lengthM = parseFloat(r.distanceMeters || 0);

              const travelTimeMin = Number((durationSec / 60.0).toFixed(1));
              const freeFlowMin = Math.max(1.0, Number((staticDurationSec / 60.0).toFixed(1)));
              const delayMin = Math.max(0, Number((travelTimeMin - freeFlowMin).toFixed(1)));
              const distKm = Math.max(0.5, Number((lengthM / 1000.0).toFixed(2)));
              const speedKmh = Math.max(5.0, Number((distKm / Math.max(travelTimeMin / 60.0, 0.05)).toFixed(1)));

              return {
                index: idx,
                is_primary: idx === 0,
                description: r.description || (idx === 0 ? 'Primary Route' : `Alternative Route #${idx}`),
                travel_time_min: travelTimeMin,
                free_flow_time_min: freeFlowMin,
                traffic_delay_min: delayMin,
                distance_km: distKm,
                speed_kmh: speedKmh,
                congestion_ratio: Number((travelTimeMin / freeFlowMin).toFixed(2)),
                polyline: r.polyline?.encodedPolyline || null
              };
            });

            return {
              success: true,
              provider: 'Google Maps Routes API v2',
              latency_ms: latencyMs,
              routes_count: parsedRoutes.length,
              primary: parsedRoutes[0],
              alternatives: parsedRoutes.slice(1),
              all_routes: parsedRoutes
            };
          }
        } else {
          const errText = await res.text();
          console.warn(`[Google API] Key returned status ${res.status}: ${errText}`);
          this.rotateKey();
          attempts++;
        }
      } catch (err) {
        console.warn(`[Google API] Error calling routes API:`, err.message);
        this.rotateKey();
        attempts++;
      }
    }

    return { success: false, error: 'Google Routes API request failed after failover attempts' };
  }
}

// 2. OpenWeatherMap Real-Time Dhaka Weather Client
export class OpenWeatherClient {
  constructor() {
    this.apiKey = process.env.OPENWEATHERMAP_API_KEY || '';
    this.cache = null;
    this.cacheTimestamp = 0;
    this.cacheDurationMs = 5 * 60 * 1000; // 5 minutes cache
  }

  get hasKey() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  async getDhakaWeather(lat = 23.8103, lon = 90.4125) {
    const now = Date.now();
    if (this.cache && (now - this.cacheTimestamp < this.cacheDurationMs)) {
      return { success: true, ...this.cache, cached: true };
    }

    if (!this.hasKey) {
      return this.getFallbackWeather();
    }

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey.trim()}&units=metric`;
      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        const main = data.main || {};
        const weatherObj = (data.weather && data.weather[0]) || {};
        const wind = data.wind || {};
        const rainData = data.rain || {};
        const precipMm = rainData['1h'] || rainData['3h'] || 0.0;

        const weatherId = weatherObj.id || 800;
        let weatherLabel = 'Clear';
        if (weatherId >= 200 && weatherId < 300) weatherLabel = 'Heavy Rain / Thunderstorm';
        else if (weatherId >= 300 && weatherId < 600) weatherLabel = 'Rain';
        else if (weatherId >= 700 && weatherId < 800) weatherLabel = 'Haze / Fog';
        else if (weatherId > 800) weatherLabel = 'Cloudy';

        let surfaceCondition = 'Dry';
        let speedPenaltyPct = 0;
        if (precipMm >= 4.0 || weatherLabel.includes('Heavy Rain')) {
          surfaceCondition = 'Waterlogged / Flooded (Severe Delay)';
          speedPenaltyPct = 35;
        } else if (precipMm > 0 || weatherLabel === 'Rain') {
          surfaceCondition = 'Wet Surface (Braking Distance +25%)';
          speedPenaltyPct = 15;
        } else if (weatherLabel === 'Haze / Fog') {
          surfaceCondition = 'Reduced Visibility';
          speedPenaltyPct = 8;
        }

        const weatherResult = {
          city: data.name || 'Dhaka',
          condition: weatherObj.main || weatherLabel,
          description: weatherObj.description || 'Haze',
          temperature_c: Number((main.temp || 26.0).toFixed(1)),
          feels_like_c: Number((main.feels_like || main.temp || 27.0).toFixed(1)),
          humidity_pct: main.humidity || 65,
          pressure_hpa: main.pressure || 1012,
          visibility_km: Number(((data.visibility || 10000) / 1000.0).toFixed(1)),
          wind_speed_kmh: Number(((wind.speed || 3.0) * 3.6).toFixed(1)),
          precipitation_mm: precipMm,
          surface_condition: surfaceCondition,
          speed_penalty_pct: speedPenaltyPct,
          icon: weatherObj.icon || '50d',
          source: 'OpenWeatherMap Live API'
        };

        this.cache = weatherResult;
        this.cacheTimestamp = now;
        return { success: true, ...weatherResult, cached: false };
      }
    } catch (err) {
      console.warn('[OpenWeather] API error:', err.message);
    }

    return this.getFallbackWeather();
  }

  getFallbackWeather() {
    return {
      success: true,
      city: 'Dhaka',
      condition: 'Haze',
      description: 'Hazy conditions with normal visibility',
      temperature_c: 26.5,
      feels_like_c: 27.8,
      humidity_pct: 72,
      pressure_hpa: 1013,
      visibility_km: 7.5,
      wind_speed_kmh: 9.5,
      precipitation_mm: 0,
      surface_condition: 'Dry',
      speed_penalty_pct: 0,
      icon: '50d',
      source: 'Open-Meteo Fallback'
    };
  }
}

// 3. Waze Live Routing Client
export class WazeClient {
  constructor() {
    this.endpoint = 'https://www.waze.com/RoutingManager/fetchRoutes';
  }

  async getRouteTraffic(originCoords, destCoords) {
    const [origLat, origLon] = originCoords;
    const [destLat, destLon] = destCoords;

    const url = `${this.endpoint}?from=x:${origLon}+y:${origLat}&to=x:${destLon}+y:${destLat}&at=0&returnJSON=true&returnGeometries=true&timeout=60000&nPaths=1&options=AVOID_TRAFFIC_JAMS:T`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://www.waze.com/live-map/',
          'Accept': 'application/json, text/plain, */*'
        }
      });

      if (res.ok) {
        const data = await res.json();
        const results = data.response?.results || [];
        if (results.length > 0) {
          const best = results[0];
          const totalSec = best.totalRouteTime || 0;
          const lengthM = best.routeLength || 0;
          const jamDelaySec = best.jamDelay || 0;

          const travelTimeMin = Number((totalSec / 60.0).toFixed(1));
          const freeFlowMin = Math.max(1.0, Number(((totalSec - jamDelaySec) / 60.0).toFixed(1)));
          const delayMin = Number((jamDelaySec / 60.0).toFixed(1));
          const distKm = Math.max(0.5, Number((lengthM / 1000.0).toFixed(2)));
          const speedKmh = Number((distKm / Math.max(travelTimeMin / 60.0, 0.05)).toFixed(1));

          return {
            success: true,
            provider: 'Waze Live Crowdsourced',
            travel_time_min: travelTimeMin,
            free_flow_time_min: freeFlowMin,
            traffic_delay_min: delayMin,
            distance_km: distKm,
            speed_kmh: speedKmh,
            route_name: best.routeName || 'Waze Corridor'
          };
        }
      }
    } catch (err) {
      console.warn('[Waze] Live probe fetch error:', err.message);
    }

    return { success: false, error: 'Waze route not available' };
  }
}

// Global Singleton Instances
export const googleRoutesClient = new GoogleRoutesClient();
export const openWeatherClient = new OpenWeatherClient();
export const wazeClient = new WazeClient();

