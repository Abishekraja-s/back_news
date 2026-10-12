/**
 * Live Tamil Nadu traffic for the hub widget + /explore/traffic.
 * Combines OpenStreetMap roadworks/closures with current IST hour for every district/area.
 */

import { fullTrafficCatalog } from '../config/tamilNaduTrafficAreas.js';

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const cache = { data: null, at: 0 };
const CACHE_MS = 5 * 60 * 1000;

const LEVELS = [
  { max: 22, level: 'smooth', statusLabel: 'Smooth', statusTamil: 'சாதாரணம்', detail: 'Roads moving freely', color: 'emerald' },
  { max: 40, level: 'normal', statusLabel: 'Normal', statusTamil: 'சாதாரணம்', detail: 'No major congestion', color: 'emerald' },
  { max: 58, level: 'moderate', statusLabel: 'Moderate', statusTamil: 'மிதமானது', detail: 'Some slow stretches', color: 'amber' },
  { max: 76, level: 'slow', statusLabel: 'Slow', statusTamil: 'மெதுவாக', detail: 'Peak-hour delays likely', color: 'orange' },
  { max: 101, level: 'heavy', statusLabel: 'Heavy', statusTamil: 'நெரிசல்', detail: 'Heavy congestion — allow extra time', color: 'rose' },
];

const OVERPASS_QUERY = `[out:json][timeout:8];
(
  way["highway"]["construction"](8.05,76.23,13.58,80.36);
  way["highway"="construction"](8.05,76.23,13.58,80.36);
  way["construction"](8.05,76.23,13.58,80.36);
  node["hazard"](8.05,76.23,13.58,80.36);
);
out center tags;`;

const round = (n, d = 0) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const p = 10 ** d;
  return Math.round(v * p) / p;
};

const kmBetween = (a, b) => {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const istNow = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  return { hour: Number.isFinite(hour) ? hour : 12, weekday };
};

const rushFactor = ({ hour, weekday }) => {
  const weekend = weekday === 'Sat' || weekday === 'Sun';
  let base = 12;
  if (hour >= 7 && hour < 11) base = 72;
  else if (hour >= 11 && hour < 16) base = 32;
  else if (hour >= 16 && hour < 21) base = 78;
  else if (hour >= 21 && hour < 23) base = 28;
  else if (hour >= 6 && hour < 7) base = 22;
  if (weekday === 'Sun') base *= 0.42;
  else if (weekday === 'Sat') base *= 0.68;
  if (weekend && hour >= 10 && hour < 20) base += 8;
  return base;
};

const levelFromScore = (score) => LEVELS.find((l) => score <= l.max) || LEVELS[LEVELS.length - 1];

const areaCatalog = (config = {}) => fullTrafficCatalog(Array.isArray(config.areas) ? config.areas : []);

export const getDefaultTrafficConfig = () => {
  const areas = fullTrafficCatalog();
  return {
    city: 'Chennai',
    highlight: 'Chennai',
    state: 'Tamil Nadu',
    auto_update: true,
    statusLabel: 'Normal',
    detail: 'No major congestion',
    level: 'normal',
    areas: areas.map(({ name, nameTamil, slug, city, region, kind }) => ({
      name,
      nameTamil,
      slug,
      city,
      region,
      kind,
    })),
  };
};

const fetchOverpass = async () => {
  let lastErr;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': 'GreatIndiaNews/1.0 (traffic)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return Array.isArray(data.elements) ? data.elements : [];
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Overpass unavailable');
};

const incidentPoint = (el) => {
  if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
    return { latitude: el.lat, longitude: el.lon };
  }
  if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) {
    return { latitude: el.center.lat, longitude: el.center.lon };
  }
  return null;
};

const assignIncidents = (areas, elements) => {
  const counts = new Map(areas.map((a) => [a.slug, 0]));
  const notes = new Map(areas.map((a) => [a.slug, []]));
  for (const el of elements) {
    const pt = incidentPoint(el);
    if (!pt) continue;
    let best = null;
    let bestKm = 22;
    for (const area of areas) {
      const km = kmBetween(area, pt);
      if (km < bestKm) {
        bestKm = km;
        best = area;
      }
    }
    if (!best) continue;
    counts.set(best.slug, (counts.get(best.slug) || 0) + 1);
    const tag = el.tags?.name || el.tags?.highway || el.tags?.hazard || 'Roadworks';
    const list = notes.get(best.slug);
    if (list.length < 2 && !list.includes(tag)) list.push(String(tag).slice(0, 48));
  }
  return { counts, notes };
};

export const fetchLiveTraffic = async (config = {}, { force = false } = {}) => {
  if (!force && cache.data && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }

  const highlightName = config.city || config.defaultCity || config.highlight || 'Chennai';
  const areas = areaCatalog(config);
  const clock = istNow();
  const rush = rushFactor(clock);

  const build = (elements, source, note) => {
    const { counts, notes } = assignIncidents(areas, elements);
    const rows = areas.map((area) => {
      const incidents = counts.get(area.slug) || 0;
      const touristBump = area.slug === 'nilgiris' && (clock.weekday === 'Sat' || clock.weekday === 'Sun') ? 12 : 0;
      const score = Math.min(100, round(rush * area.urban + incidents * 9 + touristBump, 0));
      const meta = levelFromScore(score);
      const extra = notes.get(area.slug) || [];
      const detail = extra.length ? `${meta.detail}. ${extra.join(' · ')}` : meta.detail;
      return {
        name: area.name,
        nameTamil: area.nameTamil,
        slug: area.slug,
        city: area.city,
        region: area.region,
        kind: area.kind,
        level: meta.level,
        statusLabel: meta.statusLabel,
        statusTamil: meta.statusTamil,
        detail,
        color: meta.color,
        score,
        incidents,
        latitude: area.latitude,
        longitude: area.longitude,
      };
    });

    rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    const highlight =
      rows.find((r) => r.name.toLowerCase() === String(highlightName).toLowerCase()) ||
      rows.find((r) => r.slug === 'chennai') ||
      rows[0];

    return {
      city: highlight.city || highlight.name,
      statusLabel: highlight.statusLabel,
      statusTamil: highlight.statusTamil,
      detail: highlight.detail,
      level: highlight.level,
      score: highlight.score,
      highlight: highlight.slug,
      areas: rows,
      summary: {
        heavy: rows.filter((r) => r.level === 'heavy' || r.level === 'slow').length,
        moderate: rows.filter((r) => r.level === 'moderate').length,
        normal: rows.filter((r) => r.level === 'normal' || r.level === 'smooth').length,
        districts: rows.filter((r) => r.kind === 'district').length,
        cityAreas: rows.filter((r) => r.kind !== 'district').length,
        total: rows.length,
      },
      source,
      note,
      hour: clock.hour,
      weekday: clock.weekday,
      updatedAt: new Date().toISOString(),
    };
  };

  const data = build([], 'live-schedule', 'Current-hour traffic for all Tamil Nadu districts');
  cache.data = data;
  cache.at = Date.now();

  const enrich = async () => {
    const osm = fetchOverpass();
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('overpass-timeout')), 9000);
    });
    const elements = await Promise.race([osm, timeout]);
    const enriched = build(elements, 'openstreetmap', 'Live OSM roadworks plus current-hour congestion');
    cache.data = enriched;
    cache.at = Date.now();
    return enriched;
  };

  if (force) {
    try {
      return await enrich();
    } catch {
      return data;
    }
  }

  enrich().catch(() => {});
  return data;
};

export default { fetchLiveTraffic };
