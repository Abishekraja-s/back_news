import AstrologyConfig from '../models/AstrologyConfig.js';
import DailyHoroscope from '../models/DailyHoroscope.js';
import AstrologyPanchang from '../models/AstrologyPanchang.js';
import AstrologySyncLog from '../models/AstrologySyncLog.js';
import {
  ASTROLOGY_RASIS,
  ASTROLOGY_NAKSHATRAS,
  DEFAULT_TIMEZONE,
  DEFAULT_SYNC_TIME,
  FREE_HOROSCOPE_BASE_URL,
  findRasiByAlias,
} from '../config/astrologyConstants.js';
import { decryptSecret, encryptSecret, isMaskedSecret } from '../utils/astrologyCrypto.js';
import { maskApiKey } from './geminiService.js';
import { enrichHoroscopeWithTamil } from './astrologyTranslateService.js';

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 2;

const pick = (obj, keys) => {
  for (const k of keys) {
    const parts = k.split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) break;
      cur = cur[p];
    }
    if (cur != null && String(cur).trim() !== '') return String(cur).trim();
  }
  return '';
};

const hasContent = (record) =>
  Boolean(
    record.prediction
      || record.career
      || record.business
      || record.finance
      || record.love
      || record.family
      || record.health
      || record.education
      || record.luckyNumber
      || record.luckyColor
      || record.luckyTime
      || record.advice
  );

/** Calendar date YYYY-MM-DD in a timezone */
export const dateInTimezone = (tz = DEFAULT_TIMEZONE, date = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

export const formatDisplayDate = (yyyyMmDd, tz = DEFAULT_TIMEZONE) => {
  if (!yyyyMmDd) return '';
  try {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dt);
  } catch {
    return yyyyMmDd;
  }
};

/** Parse "00:05" or "12:05 AM" → { hour, minute } */
export const parseSyncTime = (value = DEFAULT_SYNC_TIME) => {
  const raw = String(value || DEFAULT_SYNC_TIME).trim();
  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let hour = Number(ampm[1]) % 12;
    if (/pm/i.test(ampm[3])) hour += 12;
    return { hour, minute: Number(ampm[2]) };
  }
  const h24 = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    return { hour: Math.min(23, Number(h24[1])), minute: Math.min(59, Number(h24[2])) };
  }
  return { hour: 0, minute: 5 };
};

export const formatSyncTimeDisplay = (value = DEFAULT_SYNC_TIME) => {
  const { hour, minute } = parseSyncTime(value);
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${period}`;
};

/**
 * Next Date when sync should run in the given timezone.
 * Uses iterative search (reliable across DST-less Asia/Kolkata).
 */
export const getNextSyncDate = (syncTime = DEFAULT_SYNC_TIME, tz = DEFAULT_TIMEZONE, from = new Date()) => {
  const { hour, minute } = parseSyncTime(syncTime);
  for (let i = 0; i < 48 * 60; i += 1) {
    const candidate = new Date(from.getTime() + i * 60_000);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(candidate);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const h = Number(get('hour'));
    const m = Number(get('minute'));
    if (h === hour && m === minute && candidate > from) {
      return candidate;
    }
  }
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
};

export const getOrCreateAstrologyConfig = async () => {
  let config = await AstrologyConfig.findOne({ key: 'default' });
  if (!config) {
    config = await AstrologyConfig.create({ key: 'default' });
  }
  return config;
};

export const resolveCredentials = (config) => {
  const envKey = (process.env.ASTROLOGY_API_KEY || '').trim();
  const envSecret = (process.env.ASTROLOGY_API_SECRET || '').trim();
  const envBase = (process.env.ASTROLOGY_API_BASE_URL || '').trim();
  const envProvider = (process.env.ASTROLOGY_API_PROVIDER || '').trim();

  let apiProvider = (envProvider || config.apiProvider || 'free').trim();
  let apiBaseUrl = (envBase || config.apiBaseUrl || '').replace(/\/+$/, '');
  const apiKey = envKey || decryptSecret(config.apiKeyEnc);
  const apiSecret = envSecret || decryptSecret(config.apiSecretEnc);

  // Unconfigured / legacy blank custom → use free provider
  if (
    (!apiProvider || apiProvider === 'custom')
    && !apiBaseUrl
    && !apiKey
    && !envKey
    && !envBase
  ) {
    apiProvider = 'free';
    apiBaseUrl = FREE_HOROSCOPE_BASE_URL;
  }

  if (apiProvider === 'free' && !apiBaseUrl) {
    apiBaseUrl = FREE_HOROSCOPE_BASE_URL;
  }

  if (apiProvider === 'astrologyapi' && !apiBaseUrl) {
    apiBaseUrl = 'https://json.astrologyapi.com';
  }

  return {
    apiKey,
    apiSecret,
    apiBaseUrl,
    apiProvider,
    fromEnv: Boolean(envKey || envSecret || envBase || envProvider),
  };
};

export const toPublicConfig = (config) => {
  const creds = resolveCredentials(config);
  const obj = config.toObject ? config.toObject() : { ...config };
  delete obj.apiKeyEnc;
  delete obj.apiSecretEnc;
  return {
    ...obj,
    apiKeyMasked: maskApiKey(creds.apiKey),
    apiSecretMasked: maskApiKey(creds.apiSecret),
    hasApiKey: Boolean(creds.apiKey),
    hasApiSecret: Boolean(creds.apiSecret),
    credentialsFromEnv: creds.fromEnv,
    syncTimeDisplay: formatSyncTimeDisplay(obj.syncTime),
    apiKey: creds.apiKey ? '__UNCHANGED__' : '',
    apiSecret: creds.apiSecret ? '__UNCHANGED__' : '',
  };
};

export const applyConfigUpdates = (config, body = {}) => {
  if (body.apiProvider !== undefined) config.apiProvider = String(body.apiProvider || 'custom').trim();
  if (body.apiBaseUrl !== undefined) config.apiBaseUrl = String(body.apiBaseUrl || '').trim();
  if (body.language !== undefined) config.language = String(body.language || 'Tamil').trim();
  if (body.country !== undefined) config.country = String(body.country || 'India').trim();
  if (body.state !== undefined) config.state = String(body.state || 'Tamil Nadu').trim();
  if (body.city !== undefined) config.city = String(body.city || 'Chennai').trim();
  if (body.timezone !== undefined) config.timezone = String(body.timezone || DEFAULT_TIMEZONE).trim();
  if (body.autoSync !== undefined) config.autoSync = Boolean(body.autoSync);
  if (body.syncTime !== undefined) {
    const parsed = parseSyncTime(body.syncTime);
    config.syncTime = `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
  }
  if (body.lat !== undefined && !Number.isNaN(Number(body.lat))) config.lat = Number(body.lat);
  if (body.lon !== undefined && !Number.isNaN(Number(body.lon))) config.lon = Number(body.lon);

  if (body.apiKey !== undefined && !isMaskedSecret(body.apiKey)) {
    config.apiKeyEnc = encryptSecret(String(body.apiKey).trim());
  }
  if (body.apiSecret !== undefined && !isMaskedSecret(body.apiSecret)) {
    config.apiSecretEnc = encryptSecret(String(body.apiSecret).trim());
  }

  return config;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchJson = async (url, options = {}, attempt = 0) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        const err = new Error('Invalid JSON response from Astrology API');
        err.statusCode = 502;
        err.responseCode = res.status;
        throw err;
      }
    }
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('retry-after')) || 2 ** (attempt + 1);
      await sleep(Math.min(30, retryAfter) * 1000);
      return fetchJson(url, options, attempt + 1);
    }
    if (!res.ok) {
      const err = new Error(
        res.status === 401 || res.status === 403
          ? 'Astrology API authentication failed'
          : res.status === 404
            ? 'Astrology API endpoint not found'
            : res.status >= 500
              ? 'Astrology API server error'
              : 'Astrology API request failed'
      );
      err.statusCode = res.status >= 500 ? 502 : 400;
      err.responseCode = res.status;
      throw err;
    }
    if (json == null) {
      const err = new Error('Empty response from Astrology API');
      err.statusCode = 502;
      err.responseCode = res.status;
      throw err;
    }
    return { json, status: res.status };
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('Astrology API request timed out');
      e.statusCode = 504;
      e.responseCode = 0;
      throw e;
    }
    if (err.responseCode != null) throw err;
    const e = new Error('Network error contacting Astrology API');
    e.statusCode = 502;
    e.responseCode = 0;
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

const buildAuthHeaders = (creds) => {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (!creds.apiKey) return headers;

  if (creds.apiProvider === 'astrologyapi' && creds.apiSecret) {
    // AstrologyAPI.com uses Basic auth: userId:apiKey
    const token = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
    return headers;
  }

  if (creds.apiSecret && creds.apiKey) {
    const token = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  } else {
    headers.Authorization = `Bearer ${creds.apiKey}`;
    headers['X-API-Key'] = creds.apiKey;
  }
  return headers;
};

const normalizeNakshatra = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { tamil: '', english: '', slug: '' };
  const key = raw.toLowerCase().replace(/[\s_-]+/g, '');
  const match = ASTROLOGY_NAKSHATRAS.find(
    (n) =>
      n.slug === key
      || n.english.toLowerCase().replace(/[\s_-]+/g, '') === key
      || n.tamil === raw
  );
  if (match) return { tamil: match.tamil, english: match.english, slug: match.slug };
  return { tamil: raw, english: raw, slug: '' };
};

const normalizeHoroscopeFields = (payload, rasiMeta, date, provider) => {
  // AstrologyAPI.com nests text under prediction.{personal,profession,...}
  const nestedPrediction =
    payload?.prediction && typeof payload.prediction === 'object' ? payload.prediction : null;
  const src = nestedPrediction || payload?.data || payload?.horoscope || payload || {};
  // If payload.horoscope is a string, treat whole payload as src
  const root = typeof payload?.horoscope === 'string' ? payload : src;

  const record = {
    date,
    rasi: rasiMeta.slug,
    rasiTamil: rasiMeta.tamil,
    rasiEnglish: rasiMeta.english,
    prediction: pick(root, [
      'horoscope', 'description', 'prediction', 'general', 'general_prediction', 'bot_response',
      'sun_sign_prediction', 'personal', 'prediction.general', 'data.prediction', 'data.horoscope',
    ]) || (typeof payload?.horoscope === 'string' ? payload.horoscope.trim() : '')
      || (typeof payload?.description === 'string' ? payload.description.trim() : ''),
    career: pick(root, ['career', 'career_prediction', 'profession', 'job', 'prediction.career']),
    business: pick(root, ['business', 'business_prediction', 'prediction.business']),
    finance: pick(root, ['finance', 'finances', 'money', 'wealth', 'prediction.finance']),
    love: pick(root, ['love', 'relationship', 'romance', 'emotions', 'prediction.love']),
    family: pick(root, ['family', 'prediction.family']),
    health: pick(root, ['health', 'prediction.health']),
    education: pick(root, ['education', 'studies', 'prediction.education']),
    luckyNumber: pick(root, ['lucky_number', 'luckyNumber', 'lucky_numbers', 'number', 'luck']),
    luckyColor: pick(root, ['lucky_color', 'luckyColor', 'lucky_colour', 'color', 'colour']),
    luckyTime: pick(root, ['lucky_time', 'luckyTime', 'auspicious_time']),
    advice: pick(root, ['advice', 'tip', 'remedy', 'suggestion', 'mood']),
    compatibility: pick(root, ['compatibility', 'match', 'best_match']),
    apiProvider: provider,
    status: 'active',
    rawSnapshot: payload,
  };

  const nak = pick(src, ['nakshatra', 'birth_star', 'star', 'nakshatra_name']);
  if (nak) {
    const n = normalizeNakshatra(nak);
    record.nakshatra = n.slug || nak;
    record.nakshatraTamil = n.tamil;
    record.nakshatraEnglish = n.english;
  }

  return record;
};

const normalizePanchang = (payload, config, date) => {
  const src = payload?.data || payload?.panchang || payload || {};
  const nakRaw = pick(src, ['nakshatra', 'nakshatra_name', 'star', 'tithi_details.nakshatra']);
  const nak = normalizeNakshatra(nakRaw);
  return {
    date,
    locationLabel: `${config.city}, ${config.state}, ${config.country}`,
    city: config.city,
    state: config.state,
    country: config.country,
    timezone: config.timezone || DEFAULT_TIMEZONE,
    tithi: pick(src, ['tithi', 'tithi_name', 'hindu_maah.tithi']),
    nakshatra: nak.slug || nakRaw,
    nakshatraTamil: nak.tamil,
    nakshatraEnglish: nak.english,
    yoga: pick(src, ['yoga', 'yog', 'yoga_name']),
    karana: pick(src, ['karana', 'karan', 'karana_name']),
    sunrise: pick(src, ['sunrise', 'sun_rise']),
    sunset: pick(src, ['sunset', 'sun_set']),
    moonrise: pick(src, ['moonrise', 'moon_rise']),
    moonset: pick(src, ['moonset', 'moon_set']),
    rahuKalam: pick(src, ['rahukalam', 'rahu_kalam', 'rahu_kaal', 'rahukaal']),
    yamagandam: pick(src, ['yamagandam', 'yama_gandam', 'yamaganda']),
    kuligai: pick(src, ['kuligai', 'gulikai', 'gulika']),
    abhijitMuhurtham: pick(src, ['abhijit', 'abhijit_muhurat', 'abhijitMuhurtham']),
    tamilMonth: pick(src, ['tamil_month', 'tamilMonth', 'month']),
    tamilYear: pick(src, ['tamil_year', 'tamilYear', 'year']),
    apiProvider: config.apiProvider || 'custom',
    status: 'active',
    rawSnapshot: payload,
  };
};

const englishSignForProvider = (rasi) => rasi.english.toLowerCase();

/** Free provider — ohmanda.com (no API key) */
const fetchRasiFromFreeApi = async (rasi, date) => {
  const sign = englishSignForProvider(rasi);
  const url = `${FREE_HOROSCOPE_BASE_URL}/${encodeURIComponent(sign)}`;
  const { json, status } = await fetchJson(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return { record: normalizeHoroscopeFields(json, rasi, date, 'free'), status };
};

const fetchRasiFromAstrologyApi = async (creds, rasi, date) => {
  const sign = englishSignForProvider(rasi);
  const url = `${creds.apiBaseUrl || 'https://json.astrologyapi.com'}/v1/sun_sign_prediction/daily/${sign}`;
  const { json, status } = await fetchJson(url, {
    method: 'POST',
    headers: buildAuthHeaders(creds),
    body: JSON.stringify({ timezone: 5.5 }),
  });
  return { record: normalizeHoroscopeFields(json, rasi, date, 'astrologyapi'), status };
};

const fetchOneRasi = async (creds, config, rasi, date) => {
  if (creds.apiProvider === 'free') {
    return fetchRasiFromFreeApi(rasi, date);
  }
  if (creds.apiProvider === 'astrologyapi') {
    return fetchRasiFromAstrologyApi(creds, rasi, date);
  }
  return fetchRasiFromCustomApi(creds, config, rasi, date);
};

const fetchRasiFromCustomApi = async (creds, config, rasi, date) => {
  if (!creds.apiBaseUrl) {
    const err = new Error('API Base URL is required');
    err.statusCode = 400;
    throw err;
  }
  const url = new URL(
    `${creds.apiBaseUrl}/horoscope/daily/${encodeURIComponent(rasi.slug)}`
  );
  url.searchParams.set('date', date);
  url.searchParams.set('lang', config.language || 'Tamil');
  url.searchParams.set('sign', rasi.english.toLowerCase());
  if (creds.apiKey && creds.apiProvider === 'custom') {
    url.searchParams.set('api_key', creds.apiKey);
  }
  const { json, status } = await fetchJson(url.toString(), {
    method: 'GET',
    headers: buildAuthHeaders(creds),
  });
  return { record: normalizeHoroscopeFields(json, rasi, date, creds.apiProvider), status };
};

const fetchAllRasisBulk = async (creds, config, date) => {
  if (!creds.apiBaseUrl) return null;
  try {
    const url = new URL(`${creds.apiBaseUrl}/horoscope/daily`);
    url.searchParams.set('date', date);
    url.searchParams.set('lang', config.language || 'Tamil');
    if (creds.apiKey) url.searchParams.set('api_key', creds.apiKey);
    const { json, status } = await fetchJson(url.toString(), {
      method: 'GET',
      headers: buildAuthHeaders(creds),
    });
    const list = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.horoscopes)
          ? json.horoscopes
          : null;
    if (!list) return null;
    const records = [];
    for (const item of list) {
      const alias = item.rasi || item.sign || item.zodiac || item.name || item.slug;
      const meta = findRasiByAlias(alias);
      if (!meta) continue;
      const record = normalizeHoroscopeFields(item, meta, date, creds.apiProvider);
      if (hasContent(record)) records.push(record);
    }
    return { records, status };
  } catch {
    return null;
  }
};

const fetchPanchang = async (creds, config, date) => {
  if (creds.apiProvider === 'free') {
    return null;
  }
  if (creds.apiProvider === 'astrologyapi') {
    const base = creds.apiBaseUrl || 'https://json.astrologyapi.com';
    const url = `${base}/v1/advanced_panchang`;
    const body = {
      day: Number(date.slice(8, 10)),
      month: Number(date.slice(5, 7)),
      year: Number(date.slice(0, 4)),
      hour: 6,
      min: 0,
      lat: config.lat || 13.0827,
      lon: config.lon || 80.2707,
      tzone: 5.5,
    };
    const { json, status } = await fetchJson(url, {
      method: 'POST',
      headers: buildAuthHeaders(creds),
      body: JSON.stringify(body),
    });
    return { record: normalizePanchang(json, { ...config.toObject?.() || config, apiProvider: 'astrologyapi' }, date), status };
  }

  if (!creds.apiBaseUrl) return null;
  const url = new URL(`${creds.apiBaseUrl}/panchang`);
  url.searchParams.set('date', date);
  url.searchParams.set('city', config.city || 'Chennai');
  url.searchParams.set('state', config.state || 'Tamil Nadu');
  url.searchParams.set('country', config.country || 'India');
  if (creds.apiKey) url.searchParams.set('api_key', creds.apiKey);
  const { json, status } = await fetchJson(url.toString(), {
    method: 'GET',
    headers: buildAuthHeaders(creds),
  });
  return { record: normalizePanchang(json, config, date), status };
};

export const testAstrologyConnection = async () => {
  const config = await getOrCreateAstrologyConfig();
  const creds = resolveCredentials(config);

  if (creds.apiProvider !== 'free' && !creds.apiKey && !creds.apiBaseUrl) {
    config.apiStatus = 'failed';
    config.lastTestAt = new Date();
    config.lastTestMessage = 'API URL and credentials are required';
    await config.save();
    return {
      success: false,
      message: '✗ Astrology API connection failed. Please check the API URL and credentials.',
    };
  }

  if (creds.apiProvider === 'astrologyapi' && (!creds.apiKey || !creds.apiSecret)) {
    config.apiStatus = 'failed';
    config.lastTestAt = new Date();
    config.lastTestMessage = 'AstrologyAPI.com requires User ID (API Key) and API Key (API Secret)';
    await config.save();
    return {
      success: false,
      message: '✗ Astrology API connection failed. Please check the API URL and credentials.',
    };
  }

  try {
    const date = dateInTimezone(config.timezone || DEFAULT_TIMEZONE);
    const rasi = ASTROLOGY_RASIS[0];
    await fetchOneRasi(creds, config, rasi, date);
    config.apiStatus = 'connected';
    config.lastTestAt = new Date();
    config.lastTestMessage = 'Astrology API connection successful.';
    // Persist resolved free defaults so admin UI shows them
    if (creds.apiProvider === 'free') {
      config.apiProvider = 'free';
      if (!config.apiBaseUrl) config.apiBaseUrl = FREE_HOROSCOPE_BASE_URL;
    }
    await config.save();
    return { success: true, message: '✓ Astrology API connection successful.' };
  } catch (err) {
    config.apiStatus = 'failed';
    config.lastTestAt = new Date();
    config.lastTestMessage = err.message || 'Astrology API connection failed';
    await config.save();
    return {
      success: false,
      message: '✗ Astrology API connection failed. Please check the API URL and credentials.',
      code: err.responseCode || 0,
    };
  }
};

/**
 * Sync today's horoscopes (+ optional panchang) from external API into DB.
 * Never deletes existing data on failure. Never overwrites with empty content.
 */
export const syncAstrologyNow = async (trigger = 'manual') => {
  const config = await getOrCreateAstrologyConfig();
  if (config.syncInProgress) {
    return { success: false, message: 'A sync is already in progress' };
  }

  const startedAt = new Date();
  const tz = config.timezone || DEFAULT_TIMEZONE;
  const date = dateInTimezone(tz, startedAt);
  const creds = resolveCredentials(config);

  const log = await AstrologySyncLog.create({
    syncDate: date,
    syncStartedAt: startedAt,
    status: 'running',
    trigger,
    apiProvider: creds.apiProvider,
  });

  config.syncInProgress = true;
  await config.save();

  let recordsFetched = 0;
  let recordsUpdated = 0;
  let lastResponseCode = 0;
  const errors = [];

  try {
    if (creds.apiProvider === 'astrologyapi' && (!creds.apiKey || !creds.apiSecret)) {
      throw Object.assign(
        new Error('AstrologyAPI.com requires User ID in API Key and API Key in API Secret. Open API Configuration to add them, or switch provider to Free Daily Horoscope.'),
        { statusCode: 400 }
      );
    }
    if (creds.apiProvider === 'custom' && !creds.apiBaseUrl) {
      throw Object.assign(
        new Error('API Base URL is required for Custom provider. Open API Configuration, or switch to Free Daily Horoscope.'),
        { statusCode: 400 }
      );
    }

    // Persist free defaults when syncing with unresolved blank config
    if (creds.apiProvider === 'free') {
      config.apiProvider = 'free';
      config.apiBaseUrl = creds.apiBaseUrl || FREE_HOROSCOPE_BASE_URL;
    }

    let bulk = null;
    if (creds.apiProvider === 'custom') {
      bulk = await fetchAllRasisBulk(creds, config, date);
    }

    const toUpsert = [];

    if (bulk?.records?.length) {
      lastResponseCode = bulk.status || 200;
      recordsFetched = bulk.records.length;
      toUpsert.push(...bulk.records);
    } else {
      for (const rasi of ASTROLOGY_RASIS) {
        try {
          const result = await fetchOneRasi(creds, config, rasi, date);
          lastResponseCode = result.status || 200;
          recordsFetched += 1;
          if (hasContent(result.record)) {
            toUpsert.push(result.record);
          } else {
            errors.push(`${rasi.slug}: empty prediction`);
          }
          await sleep(creds.apiProvider === 'free' ? 80 : 150);
        } catch (err) {
          lastResponseCode = err.responseCode || lastResponseCode;
          errors.push(`${rasi.slug}: ${err.message}`);
        }
      }
    }

    for (const record of toUpsert) {
      try {
        await enrichHoroscopeWithTamil(record);
      } catch (err) {
        errors.push(`${record.rasi}: tamil translate — ${err.message}`);
      }
      await DailyHoroscope.findOneAndUpdate(
        { date: record.date, rasi: record.rasi },
        { $set: record },
        { upsert: true, new: true }
      );
      recordsUpdated += 1;
    }

    try {
      const panchangResult = await fetchPanchang(creds, config, date);
      if (panchangResult?.record) {
        const p = panchangResult.record;
        const panchangHasData = Boolean(
          p.tithi || p.nakshatra || p.sunrise || p.sunset || p.rahuKalam
        );
        if (panchangHasData) {
          await AstrologyPanchang.findOneAndUpdate(
            { date: p.date },
            { $set: p },
            { upsert: true, new: true }
          );
        }
      }
    } catch (err) {
      errors.push(`panchang: ${err.message}`);
    }

    const status =
      recordsUpdated === 0
        ? 'failed'
        : errors.length
          ? 'partial'
          : 'success';

    const completedAt = new Date();
    log.status = status;
    log.syncCompletedAt = completedAt;
    log.recordsFetched = recordsFetched;
    log.recordsUpdated = recordsUpdated;
    log.responseCode = lastResponseCode;
    log.errorMessage = errors.slice(0, 8).join('; ');
    log.durationMs = completedAt - startedAt;
    log.details = { rasiTarget: 12, errors: errors.slice(0, 20) };
    await log.save();

    config.syncInProgress = false;
    config.lastSyncStatus = status;
    config.lastSyncError = log.errorMessage;
    config.lastSyncRecords = recordsUpdated;
    if (status === 'success' || status === 'partial') {
      config.lastSuccessfulSyncAt = completedAt;
      config.apiStatus = 'connected';
    } else {
      config.apiStatus = 'failed';
    }
    config.nextScheduledSyncAt = getNextSyncDate(config.syncTime, tz);
    await config.save();

    return {
      success: status !== 'failed',
      status,
      date,
      displayDate: formatDisplayDate(date, tz),
      rasiUpdated: recordsUpdated,
      recordsFetched,
      message:
        status === 'failed'
          ? 'Astrology synchronization failed. Existing data was kept.'
          : 'Astrology synchronization completed successfully.',
      logId: log._id,
    };
  } catch (err) {
    const completedAt = new Date();
    log.status = 'failed';
    log.syncCompletedAt = completedAt;
    log.recordsFetched = recordsFetched;
    log.recordsUpdated = recordsUpdated;
    log.responseCode = err.responseCode || 0;
    log.errorMessage = err.message || 'API request failed';
    log.durationMs = completedAt - startedAt;
    await log.save();

    config.syncInProgress = false;
    config.lastSyncStatus = 'failed';
    config.lastSyncError = log.errorMessage;
    config.apiStatus = 'failed';
    config.nextScheduledSyncAt = getNextSyncDate(config.syncTime, config.timezone || DEFAULT_TIMEZONE);
    await config.save();

    return {
      success: false,
      status: 'failed',
      date,
      displayDate: formatDisplayDate(date, tz),
      rasiUpdated: 0,
      message: `Last Sync: Failed — ${err.message || 'API request failed'}`,
      error: err.message || 'API request failed',
      logId: log._id,
    };
  }
};

export const getDashboardStats = async () => {
  const config = await getOrCreateAstrologyConfig();
  const tz = config.timezone || DEFAULT_TIMEZONE;
  const today = dateInTimezone(tz);
  const todayCount = await DailyHoroscope.countDocuments({ date: today, status: 'active' });
  const lastLog = await AstrologySyncLog.findOne().sort({ syncStartedAt: -1 }).lean();
  const nextSync = config.nextScheduledSyncAt || getNextSyncDate(config.syncTime, tz);

  return {
    today,
    displayDate: formatDisplayDate(today, tz),
    apiStatus: config.apiStatus,
    autoSync: config.autoSync,
    syncTime: config.syncTime,
    syncTimeDisplay: formatSyncTimeDisplay(config.syncTime),
    lastSuccessfulSyncAt: config.lastSuccessfulSyncAt,
    lastSyncStatus: config.lastSyncStatus,
    lastSyncError: config.lastSyncError,
    lastSyncRecords: config.lastSyncRecords,
    todayRecords: todayCount,
    todayRecordsTarget: 12,
    nextSyncAt: nextSync,
    lastLog,
    timezone: tz,
  };
};

export { ASTROLOGY_RASIS, ASTROLOGY_NAKSHATRAS };
