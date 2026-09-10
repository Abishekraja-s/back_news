/**
 * Travel data fetcher — real API integration with dedup, timeout, retry.
 * Does NOT use dummy data when a valid API URL is configured.
 */

const DEFAULT_TIMEOUT_MS = 15000;
const UA = 'GreatIndiaNews-TravelBot/1.0';

const cryptoHash = (s) => {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return `t${Math.abs(h)}`;
};

const parseList = (arr) => (Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : []);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Unique key: provider + mode + api id OR provider + mode + number + date + source + dest */
export const buildFingerprint = (mode, item, provider = 'custom') => {
  const apiId = item.apiReferenceId || item.externalId || item.id || item.reference_id;
  if (apiId) {
    return cryptoHash(`${provider}|${mode}|${String(apiId).trim()}`);
  }

  const journeyDate =
    item.journeyDate ||
    (item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 10) : '') ||
    (item.departureAt ? new Date(item.departureAt).toISOString().slice(0, 10) : '');

  const key = [
    provider,
    mode,
    item.transportNumber || '',
    journeyDate,
    (item.fromLocation || '').toLowerCase(),
    (item.toLocation || '').toLowerCase(),
  ].join('|');

  return cryptoHash(key);
};

const buildApiUrl = (modeConfig) => {
  const base = (modeConfig.apiBaseUrl || '').trim().replace(/\/$/, '');
  const endpoint = (modeConfig.apiEndpoint || '').trim();
  if (!base) return '';

  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  if (endpoint) {
    return `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  }

  return base;
};

const mapStatus = (s) => {
  const v = String(s || '').toLowerCase();
  if (v.includes('cancel')) return 'cancelled';
  if (v.includes('delay')) return 'delayed';
  if (v.includes('arriv')) return 'arrived';
  if (v.includes('depart') || v.includes('active')) return 'departed';
  if (v.includes('divert')) return 'diverted';
  if (v.includes('sched')) return 'scheduled';
  if (v.includes('on') && v.includes('time')) return 'on_time';
  if (['on_time', 'delayed', 'cancelled', 'arrived', 'departed', 'scheduled', 'diverted', 'info'].includes(v)) {
    return v;
  }
  return 'info';
};

const mapUpdateType = (s) => {
  const v = String(s || '').toLowerCase();
  if (v.includes('cancel')) return 'cancellation';
  if (v.includes('delay')) return 'delay';
  if (v.includes('arriv')) return 'arrival';
  if (v.includes('depart')) return 'departure';
  if (v.includes('sched')) return 'schedule';
  if (v.includes('status')) return 'status';
  return 'general';
};

const normalizeExternalItem = (mode, raw = {}) => {
  const scheduled =
    raw.scheduledAt || raw.departure_scheduled || raw.scheduled || raw.departure_time || raw.departure || null;
  const actual = raw.actualAt || raw.departure_actual || raw.actual || raw.arrival_time || null;
  const arrival = raw.arrivalAt || raw.arrival_scheduled || raw.arrival || null;

  return {
    mode,
    title: raw.title || raw.name || `${mode} ${raw.number || raw.flight_iata || raw.train_number || ''}`.trim(),
    message: raw.message || raw.description || raw.remark || raw.status_text || '',
    transportNumber: String(
      raw.transportNumber ||
        raw.number ||
        raw.train_number ||
        raw.flight_iata ||
        raw.flight_number ||
        raw.bus_number ||
        ''
    ),
    route: raw.route || raw.line || '',
    fromLocation: raw.from || raw.fromLocation || raw.departure_airport || raw.origin || raw.source || '',
    toLocation: raw.to || raw.toLocation || raw.arrival_airport || raw.destination || '',
    status: mapStatus(raw.status || raw.flight_status || raw.state),
    updateType: mapUpdateType(raw.updateType || raw.type || raw.status),
    scheduledAt: scheduled,
    actualAt: actual,
    departureAt: scheduled,
    arrivalAt: arrival,
    journeyDate:
      raw.journeyDate ||
      raw.date ||
      (scheduled ? new Date(scheduled).toISOString().slice(0, 10) : ''),
    delayMinutes: Number(raw.delayMinutes || raw.delay || raw.delay_minutes || 0) || 0,
    platform: String(raw.platform || raw.platform_number || raw.departure_gate || raw.gate || ''),
    gate: String(raw.gate || raw.departure_gate || raw.boarding_gate || ''),
    apiReferenceId: String(raw.apiReferenceId || raw.id || raw.reference_id || raw.flight_id || ''),
    sourceUrl: raw.sourceUrl || raw.url || '',
    rawPayload: raw,
  };
};

const fetchWithRetry = async (url, modeConfig, mode) => {
  const attempts = Math.max(1, Number(modeConfig.retryAttempts ?? 3) + 1);
  const backoffSec = Math.max(5, Number(modeConfig.retryBackoffSeconds ?? 30));
  let lastErr;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const apiUrl = new URL(url);
      apiUrl.searchParams.set('mode', mode);
      if (modeConfig.transportNumbers?.length) {
        apiUrl.searchParams.set('numbers', modeConfig.transportNumbers.join(','));
      }
      if (modeConfig.locations?.length) {
        apiUrl.searchParams.set('locations', modeConfig.locations.join(','));
      }
      if (modeConfig.routes?.length) {
        apiUrl.searchParams.set('routes', modeConfig.routes.join(','));
      }

      const headers = {
        Accept: 'application/json',
        'User-Agent': UA,
      };
      if (modeConfig.apiKey) {
        headers.Authorization = `Bearer ${modeConfig.apiKey}`;
        headers['X-API-Key'] = modeConfig.apiKey;
      }

      const res = await fetch(apiUrl.toString(), {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (!res.ok) {
        const err = new Error(`${mode} API returned HTTP ${res.status}`);
        err.statusCode = res.status;
        throw err;
      }

      const json = await res.json();
      const list = Array.isArray(json) ? json : json.data || json.results || json.updates || json.items || [];
      if (!Array.isArray(list)) {
        throw new Error(`${mode} API response format not recognized`);
      }

      return { items: list.map((raw) => normalizeExternalItem(mode, raw)), httpStatus: res.status };
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        await sleep(backoffSec * 1000 * attempt);
      }
    }
  }

  throw lastErr;
};

/**
 * Fetch from configured external API. Throws on failure — no dummy fallback.
 */
export const fetchFromExternalApi = async (mode, modeConfig) => {
  const url = buildApiUrl(modeConfig);
  if (!url) return { items: [], source: 'none', error: null, httpStatus: 0 };

  const { items, httpStatus } = await fetchWithRetry(url, modeConfig, mode);
  return {
    items,
    source: modeConfig.apiProvider || 'api',
    error: null,
    httpStatus,
  };
};

/**
 * Demo data ONLY when no API URL is configured (for pipeline testing).
 */
export const buildConfigBasedUpdates = (mode, modeConfig) => {
  const numbers = parseList(modeConfig.transportNumbers);
  const routes = parseList(modeConfig.routes);
  const locations = parseList(modeConfig.locations);
  const keywords = parseList(modeConfig.keywords);
  const now = new Date();
  const journeyDate = now.toISOString().slice(0, 10);

  const labels = { train: 'Train', bus: 'Bus', flight: 'Flight' };
  const label = labels[mode] || mode;

  if (!numbers.length && !routes.length && !locations.length) {
    return { items: [], source: 'config', error: 'Configure API URL or routes/numbers to fetch data' };
  }

  const seeds = [];
  if (numbers.length) {
    numbers.slice(0, 8).forEach((num, i) => {
      const from = locations[i % Math.max(locations.length, 1)] || locations[0] || 'Origin';
      const to = locations[(i + 1) % Math.max(locations.length, 1)] || locations[1] || 'Destination';
      const route = routes[i % Math.max(routes.length, 1)] || `${from} → ${to}`;
      const statuses = ['on_time', 'delayed', 'scheduled', 'departed'];
      const status = statuses[i % statuses.length];
      seeds.push({
        mode,
        title: `${label} ${num} — ${status.replace('_', ' ')}`,
        message: keywords[0]
          ? `${label} ${num} on ${route}. ${keywords[0]}.`
          : `${label} ${num} status update for route ${route}.`,
        transportNumber: num,
        route,
        fromLocation: from,
        toLocation: to,
        journeyDate,
        status,
        updateType: status === 'delayed' ? 'delay' : 'status',
        scheduledAt: new Date(now.getTime() + (i + 1) * 45 * 60 * 1000),
        delayMinutes: status === 'delayed' ? 15 + i * 5 : 0,
        platform: status === 'delayed' ? String(3 + i) : '',
        sourceUrl: '',
      });
    });
  } else {
    const route = routes[0] || `${locations[0] || 'A'} → ${locations[1] || 'B'}`;
    seeds.push({
      mode,
      title: `${label} route watch — ${route}`,
      message: `Monitoring ${label.toLowerCase()} updates for ${route}.`,
      transportNumber: '',
      route,
      fromLocation: locations[0] || '',
      toLocation: locations[1] || '',
      journeyDate,
      status: 'info',
      updateType: 'general',
      scheduledAt: now,
      delayMinutes: 0,
      sourceUrl: '',
    });
  }

  return { items: seeds, source: 'config', error: null, httpStatus: 0 };
};

export const fetchTravelUpdatesForMode = async (mode, modeConfig) => {
  if (!modeConfig?.enabled) {
    return { items: [], source: 'disabled', error: null, httpStatus: 0 };
  }

  const hasApi = Boolean(buildApiUrl(modeConfig));

  if (hasApi) {
    try {
      return await fetchFromExternalApi(mode, modeConfig);
    } catch (err) {
      return {
        items: [],
        source: 'api',
        error: err.message,
        httpStatus: err.statusCode || 0,
      };
    }
  }

  return buildConfigBasedUpdates(mode, modeConfig);
};

export const getEffectiveIntervalSeconds = (modeConfig = {}) => {
  if (modeConfig.fetchIntervalSeconds && modeConfig.fetchIntervalSeconds >= 10) {
    return modeConfig.fetchIntervalSeconds;
  }
  const mins = Number(modeConfig.updateFrequencyMinutes) || 30;
  return Math.max(10, mins * 60);
};

export default {
  fetchTravelUpdatesForMode,
  buildFingerprint,
  fetchFromExternalApi,
  buildConfigBasedUpdates,
  getEffectiveIntervalSeconds,
  buildApiUrl,
};
