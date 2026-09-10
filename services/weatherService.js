/**
 * Live weather via Open-Meteo (free, no API key).
 * https://open-meteo.com/
 */

import {
  findDistrict,
  resolveDistrictList,
  TAMIL_NADU_DISTRICTS,
} from '../config/tamilNaduDistricts.js';

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

const WMO_LABELS = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
};

const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;
const BATCH_SIZE = 6;

const weatherLabel = (code) => WMO_LABELS[code] || 'Partly cloudy';

const windDirection = (deg) => {
  if (deg == null) return '';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(Number(deg) / 45) % 8];
};

const resolveCoords = (config = {}) => {
  if (config.district) {
    const d = findDistrict(config.district);
    if (d) {
      return {
        latitude: d.latitude,
        longitude: d.longitude,
        timezone: config.timezone || 'Asia/Kolkata',
        city: d.district,
        district: d.district,
        slug: d.slug,
      };
    }
  }

  const lat = Number(config.latitude);
  const lon = Number(config.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return {
      latitude: lat,
      longitude: lon,
      timezone: config.timezone || 'Asia/Kolkata',
      city: config.city || config.defaultDistrict || 'Chennai',
      district: config.city || config.defaultDistrict || 'Chennai',
    };
  }

  const defaultName = config.defaultDistrict || config.city || 'Chennai';
  const d = findDistrict(defaultName);
  if (d) {
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      timezone: config.timezone || 'Asia/Kolkata',
      city: d.district,
      district: d.district,
      slug: d.slug,
    };
  }

  const fallback = TAMIL_NADU_DISTRICTS.find((x) => x.district === 'Chennai');
  return {
    ...fallback,
    timezone: config.timezone || 'Asia/Kolkata',
    city: fallback.district,
    district: fallback.district,
  };
};

const mapWeatherResponse = (data, meta = {}) => {
  const current = data.current || {};
  const daily = data.daily || {};
  const code = current.weather_code ?? daily.weather_code?.[0];

  return {
    district: meta.district || meta.city,
    slug: meta.slug,
    city: meta.city || meta.district,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    temp: Math.round(current.temperature_2m ?? daily.temperature_2m_max?.[0] ?? 0),
    condition: weatherLabel(code),
    weatherCode: code,
    high: Math.round(daily.temperature_2m_max?.[0] ?? current.temperature_2m ?? 0),
    low: Math.round(daily.temperature_2m_min?.[0] ?? current.temperature_2m ?? 0),
    feelsLike: Math.round(daily.apparent_temperature_max?.[0] ?? current.temperature_2m ?? 0),
    humidity: current.relative_humidity_2m ?? null,
    windSpeed: current.wind_speed_10m ?? daily.wind_speed_10m_max?.[0] ?? null,
    windDirection: windDirection(current.wind_direction_10m ?? daily.wind_direction_10m_dominant?.[0]),
    unit: meta.unit || 'C',
    updatedAt: current.time || new Date().toISOString(),
    forecast: (daily.time || []).slice(0, 3).map((date, i) => ({
      date,
      high: Math.round(daily.temperature_2m_max?.[i] ?? 0),
      low: Math.round(daily.temperature_2m_min?.[i] ?? 0),
      windMax: daily.wind_speed_10m_max?.[i] ?? null,
    })),
    hourly: (data.hourly?.time || []).slice(0, 24).map((time, i) => ({
      time,
      temp: Math.round(data.hourly.temperature_2m?.[i] ?? 0),
      condition: weatherLabel(data.hourly.weather_code?.[i]),
    })),
    source: 'open-meteo',
  };
};

const fetchOpenMeteo = async (latitude, longitude, timezone) => {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    forecast_days: '3',
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m',
    daily: 'temperature_2m_max,temperature_2m_min,apparent_temperature_max,wind_speed_10m_max,wind_direction_10m_dominant',
    hourly: 'temperature_2m,weather_code',
  });

  const res = await fetch(`${OPEN_METEO}?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`Weather API error (${res.status})`);
  }

  return res.json();
};

/** @param {object} config — district, city, latitude, longitude, timezone, unit */
export const fetchLiveWeather = async (config = {}) => {
  const coords = resolveCoords(config);
  const cacheKey = `point:${coords.latitude},${coords.longitude}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { ...cached.data, city: coords.city, district: coords.district, slug: coords.slug };
  }

  const data = await fetchOpenMeteo(coords.latitude, coords.longitude, coords.timezone);
  const result = mapWeatherResponse(data, {
    city: coords.city,
    district: coords.district,
    slug: coords.slug,
    unit: config.unit || 'C',
  });

  cache.set(cacheKey, { at: Date.now(), data: result });
  return {
    ...result,
    state: config.state || null,
    country: config.country || null,
  };
};

/** Fetch weather for all Tamil Nadu districts (batched, cached) */
export const fetchDistrictsWeather = async (config = {}) => {
  const districts = resolveDistrictList(config);
  const timezone = config.timezone || 'Asia/Kolkata';
  const unit = config.unit || 'C';
  const cacheKey = `districts:${districts.length}:${timezone}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.data;
  }

  const results = [];
  for (let i = 0; i < districts.length; i += BATCH_SIZE) {
    const chunk = districts.slice(i, i + BATCH_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async (d) => {
        try {
          const weather = await fetchLiveWeather({
            district: d.district,
            latitude: d.latitude,
            longitude: d.longitude,
            timezone,
            unit,
          });
          return { ...weather, district: d.district, slug: d.slug };
        } catch {
          return {
            district: d.district,
            slug: d.slug,
            error: true,
            temp: null,
            condition: 'Unavailable',
          };
        }
      })
    );
    results.push(...chunkResults);
  }

  results.sort((a, b) => a.district.localeCompare(b.district));

  const valid = results.filter((r) => !r.error && r.temp != null);
  const payload = {
    state: config.state || 'Tamil Nadu',
    country: config.country || 'India',
    timezone,
    unit,
    defaultDistrict: config.defaultDistrict || 'Chennai',
    updatedAt: new Date().toISOString(),
    summary: valid.length
      ? {
          hottest: [...valid].sort((a, b) => b.temp - a.temp)[0],
          coolest: [...valid].sort((a, b) => a.temp - b.temp)[0],
          count: valid.length,
        }
      : null,
    districts: results,
    source: 'open-meteo',
  };

  cache.set(cacheKey, { at: Date.now(), data: payload });
  return payload;
};

export default { fetchLiveWeather, fetchDistrictsWeather };
