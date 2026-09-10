/**
 * Tamil Nadu fuel prices — scraped from goodreturns.in (daily public rates).
 */

import { fuelDistrictSlug, DEFAULT_TN_FUEL_DISTRICTS } from '../config/tamilNaduFuelSlugs.js';
import { districtSlug as urlSlug } from '../config/tamilNaduDistricts.js';

const BASE = 'https://www.goodreturns.in';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; GreatIndiaNews/1.0)' };
const BATCH = 5;
const MIN_PETROL = 90;
const MAX_PETROL = 130;
const MIN_DIESEL = 85;
const MAX_DIESEL = 120;

const cache = new Map();
const CACHE_MS = 6 * 60 * 60 * 1000;

const round1 = (n) => Math.round(Number(n) * 10) / 10;

const validPrices = (petrol, diesel) =>
  petrol >= MIN_PETROL && petrol <= MAX_PETROL && diesel >= MIN_DIESEL && diesel <= MAX_DIESEL;

const parseFromHtml = (html, fuel) => {
  const re = fuel === 'petrol'
    ? /Petrol Price in [^<]+Rs\.\s*([0-9]+\.[0-9]+)/i
    : /Diesel Price in [^<]+Rs\.\s*([0-9]+\.[0-9]+)/i;
  const m = html.match(re);
  return m ? round1(m[1]) : null;
};

const fetchDistrictRates = async (slug) => {
  const [pRes, dRes] = await Promise.all([
    fetch(`${BASE}/petrol-price-in-${slug}.html`, { headers: HEADERS, signal: AbortSignal.timeout(15000) }),
    fetch(`${BASE}/diesel-price-in-${slug}.html`, { headers: HEADERS, signal: AbortSignal.timeout(15000) }),
  ]);

  if (!pRes.ok || !dRes.ok) throw new Error(`HTTP ${slug}`);

  const [pHtml, dHtml] = await Promise.all([pRes.text(), dRes.text()]);
  const petrol = parseFromHtml(pHtml, 'petrol');
  const diesel = parseFromHtml(dHtml, 'diesel');

  if (!validPrices(petrol, diesel)) {
    throw new Error(`Invalid rates for ${slug}`);
  }

  return { petrol, diesel, source: 'goodreturns' };
};

const resolveDistrictList = (config) => {
  const fromConfig = Array.isArray(config.districts) ? config.districts : [];
  if (fromConfig.length) {
    return fromConfig.map((d) => ({
      district: d.district || d.name,
      slug: d.slug || urlSlug(d.district || d.name) || fuelDistrictSlug(d.district || d.name),
      petrol: d.petrol,
      diesel: d.diesel,
    }));
  }

  return DEFAULT_TN_FUEL_DISTRICTS.map((district) => ({
    district,
    slug: urlSlug(district) || fuelDistrictSlug(district),
    petrol: 0,
    diesel: 0,
  }));
};

const avg = (items, key) => {
  const vals = items.map((i) => i[key]).filter((v) => v > 0);
  if (!vals.length) return 0;
  return round1(vals.reduce((a, b) => a + b, 0) / vals.length);
};

/** Fetch all district fuel rates */
export const fetchDistrictsFuel = async (config = {}) => {
  if (config.auto_update === false) {
    return buildStaticPayload(config);
  }

  const cacheKey = 'tn-fuel-districts';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.data;
  }

  const list = resolveDistrictList(config);
  const results = [];

  for (let i = 0; i < list.length; i += BATCH) {
    const chunk = list.slice(i, i + BATCH);
    const chunkResults = await Promise.all(
      chunk.map(async (entry) => {
        const slug = fuelDistrictSlug(entry.district);
        try {
          const rates = await fetchDistrictRates(slug);
          return {
            district: entry.district,
            slug: entry.slug || urlSlug(entry.district) || slug,
            petrol: rates.petrol,
            diesel: rates.diesel,
            live: true,
            source: rates.source,
          };
        } catch {
          if (entry.petrol > 0 && entry.diesel > 0) {
            return {
              district: entry.district,
              slug: entry.slug || slug,
              petrol: round1(entry.petrol),
              diesel: round1(entry.diesel),
              live: false,
              source: 'config',
            };
          }
          return {
            district: entry.district,
            slug: entry.slug || urlSlug(entry.district) || slug,
            petrol: 0,
            diesel: 0,
            error: true,
          };
        }
      })
    );
    results.push(...chunkResults);
  }

  const valid = results.filter((r) => !r.error && r.petrol > 0);
  const statePetrol = config.petrol || avg(valid, 'petrol');
  const stateDiesel = config.diesel || avg(valid, 'diesel');

  const districts = results.map((r) => {
    if (!r.error && r.petrol > 0) return r;
    return {
      ...r,
      petrol: statePetrol,
      diesel: stateDiesel,
      live: false,
      source: 'state-average',
      error: false,
    };
  });

  districts.sort((a, b) => a.district.localeCompare(b.district));

  const defaultDistrict = config.defaultDistrict || 'Chennai';
  const featured = districts.find((d) => d.district === defaultDistrict) || districts[0];

  const payload = {
    state: config.state || 'Tamil Nadu',
    country: config.country || 'India',
    auto_update: config.auto_update !== false,
    defaultDistrict,
    petrol: featured?.petrol ?? statePetrol,
    diesel: featured?.diesel ?? stateDiesel,
    city: featured?.district ?? defaultDistrict,
    districts,
    updatedAt: new Date().toISOString(),
    source: 'goodreturns.in',
    summary: valid.length
      ? {
          count: valid.length,
          avgPetrol: avg(valid, 'petrol'),
          avgDiesel: avg(valid, 'diesel'),
          highestPetrol: [...valid].sort((a, b) => b.petrol - a.petrol)[0],
          lowestPetrol: [...valid].sort((a, b) => a.petrol - b.petrol)[0],
        }
      : null,
  };

  cache.set(cacheKey, { at: Date.now(), data: payload });
  return payload;
};

const buildStaticPayload = (config) => {
  const list = resolveDistrictList(config);
  const districts = list.map((d) => ({
    district: d.district,
    slug: d.slug || fuelDistrictSlug(d.district),
    petrol: round1(d.petrol || config.petrol || 0),
    diesel: round1(d.diesel || config.diesel || 0),
    live: false,
    source: 'config',
  }));

  return {
    state: config.state || 'Tamil Nadu',
    auto_update: false,
    defaultDistrict: config.defaultDistrict || 'Chennai',
    petrol: config.petrol ?? districts.find((x) => x.district === 'Chennai')?.petrol ?? 0,
    diesel: config.diesel ?? districts.find((x) => x.district === 'Chennai')?.diesel ?? 0,
    city: config.defaultDistrict || 'Chennai',
    districts,
    source: 'config',
    updatedAt: new Date().toISOString(),
  };
};

/** Live fuel for default district or query */
export const fetchLiveFuel = async (config = {}, districtName) => {
  const name = districtName || config.defaultDistrict || 'Chennai';
  const slug = fuelDistrictSlug(name);

  if (config.auto_update === false) {
    const staticData = buildStaticPayload(config);
    const d = staticData.districts.find((x) => x.district === name);
    return {
      ...staticData,
      city: name,
      petrol: d?.petrol ?? staticData.petrol,
      diesel: d?.diesel ?? staticData.diesel,
    };
  }

  try {
    const rates = await fetchDistrictRates(slug);
    return {
      state: config.state || 'Tamil Nadu',
      country: config.country || 'India',
      auto_update: true,
      defaultDistrict: name,
      city: name,
      petrol: rates.petrol,
      diesel: rates.diesel,
      live: true,
      updatedAt: new Date().toISOString(),
      source: 'goodreturns.in',
    };
  } catch {
    if (config.petrol && config.diesel) {
      return {
        state: config.state || 'Tamil Nadu',
        defaultDistrict: name,
        city: name,
        petrol: round1(config.petrol),
        diesel: round1(config.diesel),
        live: false,
        source: 'config',
        updatedAt: new Date().toISOString(),
      };
    }
    const full = await fetchDistrictsFuel(config);
    const d = full.districts.find((x) => x.district.toLowerCase() === name.toLowerCase());
    return {
      state: full.state,
      defaultDistrict: name,
      city: d?.district || name,
      petrol: d?.petrol ?? full.petrol,
      diesel: d?.diesel ?? full.diesel,
      live: d?.live ?? false,
      source: full.source,
      updatedAt: full.updatedAt,
    };
  }
};

export default { fetchDistrictsFuel, fetchLiveFuel };
