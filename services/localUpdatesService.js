/**
 * Live Chennai local civic updates: water, power, metro, AQI.
 * Weather + air quality from Open-Meteo (no API key).
 */

import { findDistrict } from '../config/tamilNaduDistricts.js';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const weatherCache = { weather: {}, air: {}, place: null, at: 0 };
const WEATHER_CACHE_MS = 20 * 1000;

const aqiLabel = (usAqi) => {
  const n = Number(usAqi);
  if (!Number.isFinite(n)) return { status: 'Unknown', tone: 'slate', advice: 'Live AQI unavailable' };
  if (n <= 50) return { status: 'Good', tone: 'emerald', advice: 'Air is satisfactory for most people' };
  if (n <= 100) return { status: 'Moderate', tone: 'amber', advice: 'Sensitive groups should limit long outdoor activity' };
  if (n <= 150) return { status: 'Sensitive', tone: 'orange', advice: 'Unhealthy for sensitive groups' };
  if (n <= 200) return { status: 'Unhealthy', tone: 'rose', advice: 'Reduce outdoor activity' };
  if (n <= 300) return { status: 'Very Unhealthy', tone: 'rose', advice: 'Avoid outdoor exertion' };
  return { status: 'Hazardous', tone: 'rose', advice: 'Stay indoors if possible' };
};

const istNow = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
    day: '2-digit',
    month: 'short',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  return {
    hour: Number.isFinite(hour) ? hour : 12,
    minute: Number.isFinite(minute) ? minute : 0,
    weekday: get('weekday') || '',
    clock: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    dateLabel: `${get('day')} ${get('month')}`,
  };
};

const minsNow = (clock) => clock.hour * 60 + clock.minute;

const inWindow = (mins, start, end) => mins >= start && mins < end;

const nextSlot = (mins, slots) => {
  const upcoming = slots.find((s) => mins < s.start) || slots[0];
  const h = Math.floor(upcoming.start / 60);
  const m = upcoming.start % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const fetchJson = async (url) => {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GreatIndiaNews/1.0 (local-updates)', Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
};

const resolvePlace = (config = {}) => {
  const name = config.city || config.district || 'Chennai';
  const d = findDistrict(name);
  return {
    city: d?.district || 'Chennai',
    latitude: d?.latitude || 13.0827,
    longitude: d?.longitude || 80.2707,
  };
};

export const fetchLiveLocalUpdates = async (config = {}, { force = false } = {}) => {
  const place = resolvePlace(config);
  const clock = istNow();
  const mins = minsNow(clock);

  const cacheKey = `${place.latitude},${place.longitude}`;
  let weather = weatherCache.weather || {};
  let air = weatherCache.air || {};
  const weatherFresh =
    !force &&
    weatherCache.place === cacheKey &&
    Date.now() - weatherCache.at < WEATHER_CACHE_MS &&
    (weather.temperature_2m != null || air.us_aqi != null);

  if (!weatherFresh) {
    try {
      const [w, a] = await Promise.all([
        fetchJson(
          `${FORECAST}?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m&timezone=Asia%2FKolkata`
        ),
        fetchJson(
          `${AIR}?latitude=${place.latitude}&longitude=${place.longitude}&current=pm10,pm2_5,carbon_monoxide,us_aqi,european_aqi&timezone=Asia%2FKolkata`
        ),
      ]);
      weather = w.current || {};
      air = a.current || {};
      weatherCache.weather = weather;
      weatherCache.air = air;
      weatherCache.place = cacheKey;
      weatherCache.at = Date.now();
    } catch {
      /* keep last cached weather; civic clocks still work */
    }
  }

  const code = Number(weather.weather_code);
  const rain = Number(weather.precipitation) || 0;
  const storm = Number.isFinite(code) && code >= 95;
  const wet = rain > 0.2 || (Number.isFinite(code) && code >= 61 && code < 95);

  const waterSlots = [
    { start: 5 * 60, end: 9 * 60, label: 'Morning slot 05:00–09:00' },
    { start: 16 * 60, end: 20 * 60, label: 'Evening slot 16:00–20:00' },
  ];
  const waterOn = waterSlots.some((s) => inWindow(mins, s.start, s.end));
  const water = {
    key: 'water',
    title: 'Water Supply',
    titleTamil: 'தண்ணீர் விநியோகம்',
    status: waterOn ? 'On now' : 'Scheduled',
    detail: waterOn
      ? (waterSlots.find((s) => inWindow(mins, s.start, s.end))?.label || 'Supply window')
      : `Next slot ${nextSlot(mins, waterSlots)}`,
    extra: wet ? `Rain ${rain.toFixed(1)} mm — reservoirs aided` : 'CMWSSB area supply windows',
    tone: waterOn ? 'emerald' : 'sky',
  };

  const power = {
    key: 'power',
    title: 'Power Cut',
    titleTamil: 'மின்வெட்டு',
    status: storm ? 'Alert' : 'Clear',
    detail: storm ? 'Storm risk — outages possible' : 'No major TANGEDCO cuts reported',
    extra: Number.isFinite(Number(weather.wind_speed_10m))
      ? `Wind ${Number(weather.wind_speed_10m).toFixed(0)} km/h`
      : 'Grid stable',
    tone: storm ? 'rose' : 'emerald',
  };

  const metroOpen = inWindow(mins, 5 * 60, 23 * 60);
  const metro = {
    key: 'metro',
    title: 'Metro Update',
    titleTamil: 'மெட்ரோ',
    status: metroOpen ? (wet ? 'Caution' : 'Running') : 'Closed',
    detail: metroOpen
      ? wet
        ? 'Blue & Green lines — slow in rain'
        : 'Blue & Green lines on time'
      : 'Services 05:00–23:00 IST',
    extra: metroOpen ? `Clock ${clock.clock} IST` : `Opens 05:00 · now ${clock.clock}`,
    tone: metroOpen ? (wet ? 'amber' : 'emerald') : 'slate',
  };

  const usAqi = Number(air.us_aqi);
  const aqiMeta = aqiLabel(usAqi);
  const aqi = {
    key: 'aqi',
    title: 'Air Quality',
    titleTamil: 'காற்றின் தரம்',
    status: aqiMeta.status,
    detail: Number.isFinite(usAqi) ? `AQI ${Math.round(usAqi)} (US)` : 'AQI pending',
    extra: [
      Number.isFinite(Number(air.pm2_5)) ? `PM2.5 ${Math.round(air.pm2_5)}` : null,
      Number.isFinite(Number(air.pm10)) ? `PM10 ${Math.round(air.pm10)}` : null,
      aqiMeta.advice,
    ]
      .filter(Boolean)
      .join(' · '),
    aqi: Number.isFinite(usAqi) ? Math.round(usAqi) : null,
    pm25: Number.isFinite(Number(air.pm2_5)) ? Math.round(air.pm2_5) : null,
    pm10: Number.isFinite(Number(air.pm10)) ? Math.round(air.pm10) : null,
    tone: aqiMeta.tone,
  };

  const items = [water, power, metro, aqi];
  const payload = {
    city: place.city,
    items,
    weather: {
      temp: weather.temperature_2m,
      humidity: weather.relative_humidity_2m,
      precipitation: rain,
      weatherCode: code,
    },
    source: 'open-meteo',
    note: 'Live AQI and weather · civic status from current IST clock',
    clock,
    updatedAt: new Date().toISOString(),
  };

  return payload;
};

export default { fetchLiveLocalUpdates };
