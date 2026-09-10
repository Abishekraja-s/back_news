/**
 * Live precious metals — Tamil Nadu / India rates.
 * Sources (priority order):
 *  1. IBJA API (India bullion benchmark) — gold, silver, platinum
 *  2. goldprice.dev — gold INR spot (free)
 *  3. Yahoo Finance futures + Frankfurter USD/INR — silver, platinum
 *  4. Indicative diamond reference from 24K gold (config ratio)
 */

const GOLDPRICE_DEV = 'https://api.goldprice.dev/v1/prices?symbol=';
const IBJA_BASE = process.env.IBJA_API_URL || 'https://ibja-api.vercel.app';
const FRANKFURTER = 'https://api.frankfurter.app/latest?from=USD&to=INR';
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';

const TROY_OZ_GRAMS = 31.1034768;
const K22_RATIO = 22 / 24;
const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; GreatIndiaNews/1.0)' };

const cache = new Map();
const CACHE_MS = 15 * 60 * 1000;

const round = (n) => Math.round(Number(n) || 0);

const applyMarkup = (rate, config) => {
  const pct = Number(config.markupPercent);
  if (Number.isFinite(pct) && pct !== 0) return round(rate * (1 + pct / 100));
  const flat = Number(config.markupFlat);
  if (Number.isFinite(flat) && flat !== 0) return round(rate + flat);
  return round(rate);
};

const defaultItems = () => [
  { type: 'gold', purity: '22K', unit: '1 gram', price: 0, currency: 'INR' },
  { type: 'gold', purity: '24K', unit: '1 gram', price: 0, currency: 'INR' },
  { type: 'silver', unit: '1 gram', price: 0, currency: 'INR' },
  { type: 'diamond', unit: '1 carat', price: 0, currency: 'INR' },
  { type: 'platinum', unit: '1 gram', price: 0, currency: 'INR' },
];

const normalizeConfigItems = (config) => {
  if (Array.isArray(config.items) && config.items.length) {
    return config.items.map((item) => ({ ...item }));
  }
  const g = config.gold || {};
  const items = defaultItems();
  if (g['22k']?.rate) items[0].price = g['22k'].rate;
  if (g['24k']?.rate) items[1].price = g['24k'].rate;
  return items;
};

const itemKey = (item) => {
  if (item.type === 'gold') return `gold:${(item.purity || '').toLowerCase()}`;
  return item.type;
};

const itemLabel = (item) => {
  if (item.type === 'gold') return `${item.purity} Gold`;
  if (item.type === 'silver') return 'Silver';
  if (item.type === 'platinum') return 'Platinum';
  if (item.type === 'diamond') return 'Diamond';
  return item.type;
};

const parseNum = (val) => {
  const n = parseFloat(String(val || '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json();
  if (!res.ok || data?.error) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data;
};

/** IBJA gold — rates per 10g for 999 (24K) and 916 (22K) */
const fetchIbjaGold = async () => {
  const data = await fetchJson(`${IBJA_BASE}/latest`);
  const rate24 = parseNum(data.lblGold999_PM ?? data.lblGold999_AM);
  const rate22 = parseNum(data.lblGold916_PM ?? data.lblGold916_AM);
  if (rate24 == null || rate22 == null) throw new Error('IBJA gold incomplete');
  return {
    rate24k: applyMarkup(rate24 / 10, {}),
    rate22k: applyMarkup(rate22 / 10, {}),
    source: 'ibja',
    updatedAt: data.date,
  };
};

/** IBJA silver — rate per 1 kg (999) */
const fetchIbjaSilver = async () => {
  const data = await fetchJson(`${IBJA_BASE}/silver/latest`);
  const perKg = parseNum(data.lblSilver999_PM ?? data.lblSilver999_AM);
  if (perKg == null) throw new Error('IBJA silver incomplete');
  return {
    pricePerGram: round(perKg / 1000),
    source: 'ibja',
    updatedAt: data.date,
  };
};

/** IBJA platinum — rate per gram (999) */
const fetchIbjaPlatinum = async () => {
  const data = await fetchJson(`${IBJA_BASE}/platinum/latest`);
  const perGram = parseNum(data.lblPlatinum999_PM ?? data.lblPlatinum999_AM);
  if (perGram == null) throw new Error('IBJA platinum incomplete');
  return {
    pricePerGram: round(perGram),
    source: 'ibja',
    updatedAt: data.date,
  };
};

const fetchGoldpriceDevGold = async (config) => {
  const data = await fetchJson(`${GOLDPRICE_DEV}XAU-INR-SPOT`);
  const spot = data?.symbols?.[0];
  if (!spot?.price) throw new Error('No gold spot');
  const perGram24 = applyMarkup(Number(spot.price) / TROY_OZ_GRAMS, config);
  return {
    rate24k: perGram24,
    rate22k: round(perGram24 * K22_RATIO),
    source: 'goldprice.dev',
    updatedAt: spot.computed_at,
  };
};

const fetchUsdInr = async () => {
  const cached = cache.get('usd-inr');
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.rate;

  const data = await fetchJson(FRANKFURTER);
  const rate = data?.rates?.INR;
  if (!rate) throw new Error('USD/INR unavailable');
  cache.set('usd-inr', { at: Date.now(), rate });
  return rate;
};

const fetchYahooUsdPerOz = async (ticker) => {
  const url = `${YAHOO_CHART}/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  const data = await fetchJson(url, { headers: YAHOO_HEADERS });
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!price) throw new Error(`Yahoo ${ticker} no price`);
  return Number(price);
};

const usdOzToInrGram = (usdPerOz, usdInr, config) =>
  applyMarkup((usdPerOz * usdInr) / TROY_OZ_GRAMS, config);

const fetchSilverLive = async (config) => {
  try {
    const ibja = await fetchIbjaSilver();
    return { price: applyMarkup(ibja.pricePerGram, config), source: ibja.source, updatedAt: ibja.updatedAt };
  } catch {
    /* fallback */
  }

  const [usdPerOz, usdInr] = await Promise.all([
    fetchYahooUsdPerOz('SI=F'),
    fetchUsdInr(),
  ]);
  return {
    price: usdOzToInrGram(usdPerOz, usdInr, config),
    source: 'yahoo-finance',
    updatedAt: new Date().toISOString(),
  };
};

const fetchPlatinumLive = async (config) => {
  try {
    const ibja = await fetchIbjaPlatinum();
    return { price: applyMarkup(ibja.pricePerGram, config), source: ibja.source, updatedAt: ibja.updatedAt };
  } catch {
    /* fallback */
  }

  const [usdPerOz, usdInr] = await Promise.all([
    fetchYahooUsdPerOz('PL=F'),
    fetchUsdInr(),
  ]);
  return {
    price: usdOzToInrGram(usdPerOz, usdInr, config),
    source: 'yahoo-finance',
    updatedAt: new Date().toISOString(),
  };
};

const fetchGoldLive = async (config) => {
  try {
    const ibja = await fetchIbjaGold();
    return {
      rate24k: applyMarkup(ibja.rate24k, config),
      rate22k: applyMarkup(ibja.rate22k, config),
      source: ibja.source,
      updatedAt: ibja.updatedAt,
    };
  } catch {
    /* fallback */
  }
  const spot = await fetchGoldpriceDevGold(config);
  return spot;
};

const fetchDiamondLive = (config, gold24PerGram) => {
  if (itemHasAdminPrice(config, 'diamond')) {
    const item = config.items?.find((i) => i.type === 'diamond');
    return { price: item.price, source: 'config', live: false };
  }

  const ratio = Number(config.diamondGoldRatio) || 28;
  if (!gold24PerGram) {
    return { price: 0, source: null, live: false };
  }

  return {
    price: round(gold24PerGram * ratio),
    source: 'indicative',
    live: true,
    note: 'Indicative reference · actual prices vary by 4C grading',
  };
};

const itemHasAdminPrice = (config, type) => {
  const item = config.items?.find((i) => i.type === type);
  return item?.price > 0;
};

const buildPayload = (config, items, meta = {}) => ({
  type: config.type || 'precious_metals',
  state: config.state || 'Tamil Nadu',
  country: config.country || 'India',
  auto_update: config.auto_update !== false,
  items,
  updatedAt: meta.updatedAt || new Date().toISOString(),
  source: meta.source || 'multi',
  note: meta.note || 'Live rates · gold/silver/platinum updated every 15 min',
});

/** @param {object} config */
export const fetchLiveGoldPrice = async (config = {}) => {
  const baseItems = normalizeConfigItems(config);

  if (config.auto_update === false) {
    return buildPayload(
      config,
      baseItems.map((item) => ({ ...item, label: itemLabel(item), live: false })),
      { source: 'config', note: 'Static config (auto_update disabled)' }
    );
  }

  const cacheKey = 'precious-metals-live-v2';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return buildPayload(config, cached.items, cached.meta);
  }

  const [gold, silver, platinum] = await Promise.all([
    fetchGoldLive(config).catch(() => null),
    fetchSilverLive(config).catch(() => null),
    fetchPlatinumLive(config).catch(() => null),
  ]);

  const diamond = fetchDiamondLive(config, gold?.rate24k);

  const prev = cached?.itemsByKey || {};
  const items = baseItems.map((item) => {
    const key = itemKey(item);
    const prevPrice = prev[key]?.price;
    let price = item.price;
    let live = false;
    let source = null;
    let note = item.note;

    if (item.type === 'gold' && gold) {
      const purity = String(item.purity || '').toUpperCase();
      price = purity === '22K' ? gold.rate22k : gold.rate24k;
      live = true;
      source = gold.source;
    } else if (item.type === 'silver' && silver) {
      price = silver.price;
      live = true;
      source = silver.source;
    } else if (item.type === 'platinum' && platinum) {
      price = platinum.price;
      live = true;
      source = platinum.source;
    } else if (item.type === 'diamond' && diamond?.price) {
      price = diamond.price;
      live = diamond.live;
      source = diamond.source;
      note = diamond.note;
    }

    const change = prevPrice != null && live && price ? price - prevPrice : item.change ?? null;

    return {
      ...item,
      price,
      change,
      live,
      source,
      note,
      label: itemLabel(item),
    };
  });

  const itemsByKey = Object.fromEntries(items.map((i) => [itemKey(i), i]));
  const updatedAt = gold?.updatedAt || silver?.updatedAt || platinum?.updatedAt || new Date().toISOString();
  const meta = {
    updatedAt,
    source: [gold?.source, silver?.source, platinum?.source].filter(Boolean).join(' + ') || 'multi',
  };

  cache.set(cacheKey, { at: Date.now(), items, itemsByKey, meta });
  return buildPayload(config, items, meta);
};

export default { fetchLiveGoldPrice };
