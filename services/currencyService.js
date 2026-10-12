/**
 * Live FX rates vs INR for the Currency hub widget + /explore/currency.
 * Sources (priority): open.er-api.com → Fawaz Ahmed CDN → Frankfurter.
 */

export const CURRENCY_CATALOG = [
  { code: 'USD', name: 'US Dollar', nameTamil: 'அமெரிக்க டாலர்' },
  { code: 'EUR', name: 'Euro', nameTamil: 'யூரோ' },
  { code: 'GBP', name: 'British Pound', nameTamil: 'பிரிட்டிஷ் பவுண்ட்' },
  { code: 'AED', name: 'UAE Dirham', nameTamil: 'ஐக்கிய அரபு எமிரேட்ஸ் திர்ஹாம்' },
  { code: 'SAR', name: 'Saudi Riyal', nameTamil: 'சவுதி ரியால்' },
  { code: 'QAR', name: 'Qatari Riyal', nameTamil: 'கத்தார் ரியால்' },
  { code: 'KWD', name: 'Kuwaiti Dinar', nameTamil: 'குவைத் தினார்' },
  { code: 'BHD', name: 'Bahraini Dinar', nameTamil: 'பஹ்ரைன் தினார்' },
  { code: 'OMR', name: 'Omani Rial', nameTamil: 'ஓமான் ரியால்' },
  { code: 'SGD', name: 'Singapore Dollar', nameTamil: 'சிங்கப்பூர் டாலர்' },
  { code: 'MYR', name: 'Malaysian Ringgit', nameTamil: 'மலேசிய ரிங்கிட்' },
  { code: 'THB', name: 'Thai Baht', nameTamil: 'தாய் பாத்' },
  { code: 'JPY', name: 'Japanese Yen', nameTamil: 'ஜப்பானிய யென்' },
  { code: 'CNY', name: 'Chinese Yuan', nameTamil: 'சீன யுவான்' },
  { code: 'HKD', name: 'Hong Kong Dollar', nameTamil: 'ஹாங்காங் டாலர்' },
  { code: 'KRW', name: 'South Korean Won', nameTamil: 'தென் கொரிய வான்' },
  { code: 'AUD', name: 'Australian Dollar', nameTamil: 'ஆஸ்திரேலிய டாலர்' },
  { code: 'CAD', name: 'Canadian Dollar', nameTamil: 'கனடிய டாலர்' },
  { code: 'CHF', name: 'Swiss Franc', nameTamil: 'சுவிஸ் பிராங்க்' },
  { code: 'NZD', name: 'New Zealand Dollar', nameTamil: 'நியூசிலாந்து டாலர்' },
  { code: 'ZAR', name: 'South African Rand', nameTamil: 'தென் ஆப்பிரிக்க ராண்ட்' },
  { code: 'NPR', name: 'Nepalese Rupee', nameTamil: 'நேபாள ரூபாய்' },
  { code: 'BDT', name: 'Bangladeshi Taka', nameTamil: 'பங்களாதேஷ் டாக்கா' },
  { code: 'LKR', name: 'Sri Lankan Rupee', nameTamil: 'இலங்கை ரூபாய்' },
  { code: 'PKR', name: 'Pakistani Rupee', nameTamil: 'பாகிஸ்தான் ரூபாய்' },
  { code: 'IDR', name: 'Indonesian Rupiah', nameTamil: 'இந்தோனேசிய ரூபியா' },
  { code: 'PHP', name: 'Philippine Peso', nameTamil: 'பிலிப்பைன்ஸ் பெசோ' },
  { code: 'VND', name: 'Vietnamese Dong', nameTamil: 'வியட்நாம் டாங்' },
  { code: 'RUB', name: 'Russian Ruble', nameTamil: 'ரஷ்ய ரூபிள்' },
  { code: 'TRY', name: 'Turkish Lira', nameTamil: 'துருக்கிய லீரா' },
  { code: 'BRL', name: 'Brazilian Real', nameTamil: 'பிரேசில் ரியால்' },
  { code: 'MXN', name: 'Mexican Peso', nameTamil: 'மெக்சிகன் பெசோ' },
  { code: 'SEK', name: 'Swedish Krona', nameTamil: 'ஸ்வீடிஷ் க்ரோனா' },
  { code: 'NOK', name: 'Norwegian Krone', nameTamil: 'நார்வேஜியன் க்ரோன்' },
  { code: 'DKK', name: 'Danish Krone', nameTamil: 'டேனிஷ் க்ரோன்' },
  { code: 'PLN', name: 'Polish Zloty', nameTamil: 'போலிஷ் ஸ்லாட்டி' },
];

const OPEN_ER = 'https://open.er-api.com/v6/latest/USD';
const FAWAZ = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json';
const FRANKFURTER = 'https://api.frankfurter.app/latest?from=USD';

const cache = { data: null, at: 0 };
const CACHE_MS = 10 * 60 * 1000;

const fetchJson = async (url) => {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
};

const roundRate = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 100) return Math.round(v * 100) / 100;
  if (v >= 10) return Math.round(v * 1000) / 1000;
  if (v >= 1) return Math.round(v * 10000) / 10000;
  return Math.round(v * 100000) / 100000;
};

/** USD-base map → INR per 1 unit of each code */
const inrPerUnitFromUsdBase = (usdRates) => {
  const inr = Number(usdRates.INR ?? usdRates.inr);
  if (!Number.isFinite(inr) || inr <= 0) throw new Error('INR rate missing');
  const out = { USD: inr };
  for (const { code } of CURRENCY_CATALOG) {
    if (code === 'USD') continue;
    const perUsd = Number(usdRates[code] ?? usdRates[code.toLowerCase()]);
    if (!Number.isFinite(perUsd) || perUsd <= 0) continue;
    out[code] = inr / perUsd;
  }
  return out;
};

const fetchUsdRatesOpenEr = async () => {
  const data = await fetchJson(OPEN_ER);
  if (data?.result !== 'success' || !data.rates) throw new Error('open.er-api failed');
  return {
    usdRates: data.rates,
    updatedAt: data.time_last_update_utc || new Date().toISOString(),
    source: 'open.er-api.com',
  };
};

const fetchUsdRatesFawaz = async () => {
  const data = await fetchJson(FAWAZ);
  const usd = data?.usd;
  if (!usd || typeof usd !== 'object') throw new Error('currency-api failed');
  const usdRates = {};
  for (const [k, v] of Object.entries(usd)) {
    usdRates[k.toUpperCase()] = v;
  }
  return {
    usdRates,
    updatedAt: data.date || new Date().toISOString(),
    source: 'currency-api',
  };
};

const fetchUsdRatesFrankfurter = async () => {
  const data = await fetchJson(FRANKFURTER);
  if (!data?.rates) throw new Error('Frankfurter failed');
  return {
    usdRates: { USD: 1, ...data.rates },
    updatedAt: data.date || new Date().toISOString(),
    source: 'frankfurter.app',
  };
};

const yesterdayIso = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const fetchPreviousInrMap = async () => {
  try {
    const day = yesterdayIso();
    const data = await fetchJson(`https://api.frankfurter.app/${day}?from=USD`);
    if (!data?.rates) return null;
    return inrPerUnitFromUsdBase({ USD: 1, ...data.rates });
  } catch {
    return null;
  }
};

const changePercent = (now, prev) => {
  if (!Number.isFinite(now) || !Number.isFinite(prev) || prev === 0) return null;
  return Math.round(((now - prev) / prev) * 10000) / 100;
};

export const fetchLiveCurrency = async (config = {}, { force = false } = {}) => {
  if (!force && cache.data && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }

  const errors = [];
  let usdRates = null;
  let source = '';
  let updatedAt = '';

  for (const fn of [fetchUsdRatesOpenEr, fetchUsdRatesFawaz, fetchUsdRatesFrankfurter]) {
    try {
      const got = await fn();
      usdRates = got.usdRates;
      source = got.source;
      updatedAt = got.updatedAt;
      break;
    } catch (err) {
      errors.push(err.message);
    }
  }

  if (!usdRates) {
    throw new Error(errors.join('; ') || 'Could not fetch live currency rates');
  }

  const inrMap = inrPerUnitFromUsdBase(usdRates);
  const prevMap = await fetchPreviousInrMap();
  const highlight = String(config.highlight || config.pair?.split('/')?.[0] || 'USD')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '') || 'USD';

  const named = new Set(CURRENCY_CATALOG.map((c) => c.code));
  for (const [code, perUsd] of Object.entries(usdRates)) {
    const cc = String(code).toUpperCase();
    if (cc === 'USD' || cc === 'INR' || named.has(cc)) continue;
    const n = Number(perUsd);
    if (!Number.isFinite(n) || n <= 0) continue;
    inrMap[cc] = inrMap.USD / n;
  }

  const codes = CURRENCY_CATALOG.filter((c) => inrMap[c.code] != null);
  const extra = Object.keys(inrMap)
    .filter((code) => code !== 'INR' && !codes.some((c) => c.code === code))
    .sort()
    .map((code) => ({ code, name: code, nameTamil: '' }));

  const toRow = (meta) => {
    const rate = roundRate(inrMap[meta.code]);
    const prev = prevMap?.[meta.code];
    return {
      code: meta.code,
      pair: `${meta.code} / INR`,
      name: meta.name,
      nameTamil: meta.nameTamil || '',
      rate,
      changePercent: changePercent(inrMap[meta.code], prev),
    };
  };

  const rates = [...codes, ...extra].map(toRow).filter((r) => r.rate != null);
  const featured = rates.find((r) => r.code === highlight) || rates.find((r) => r.code === 'USD') || rates[0];

  const payload = {
    base: 'INR',
    highlight: featured?.code || 'USD',
    pair: featured?.pair || 'USD / INR',
    rate: featured?.rate ?? config.rate ?? null,
    changePercent: featured?.changePercent ?? config.changePercent ?? null,
    rates,
    source,
    updatedAt,
    note: '1 foreign unit in Indian Rupees (INR)',
  };

  cache.data = payload;
  cache.at = Date.now();
  return payload;
};

export default { fetchLiveCurrency, CURRENCY_CATALOG };
