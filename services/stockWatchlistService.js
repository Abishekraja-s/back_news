/**
 * Live NSE stock watchlist via Yahoo Finance chart API.
 */

import { INDIA_WATCHLIST, WATCHLIST_INDEXES } from '../config/indiaWatchlist.js';

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
};
const cache = { data: null, at: 0 };
const CACHE_MS = 45 * 1000;

const round = (n, d = 2) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const p = 10 ** d;
  return Math.round(v * p) / p;
};

const fmtCap = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1e12) return `₹${(v / 1e12).toFixed(2)} L Cr`;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  return `₹${v.toLocaleString('en-IN')}`;
};

const fmtVol = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
  return v.toLocaleString('en-IN');
};

const fetchJson = async (url) => {
  const res = await fetch(url, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(12000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.chart?.error?.description || `HTTP ${res.status}`);
  return data;
};

const parseChart = (data, meta) => {
  const result = data?.chart?.result?.[0];
  const q = result?.meta;
  if (!q) return null;
  const bars = result.indicators?.quote?.[0] || {};
  const last = (arr) => {
    const list = Array.isArray(arr) ? arr : [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (Number.isFinite(list[i])) return list[i];
    }
    return null;
  };
  const price = Number(q.regularMarketPrice ?? last(bars.close));
  if (!Number.isFinite(price)) return null;
  const pct = Number(q.regularMarketChangePercent ?? q.fulldayChangePercent);
  const change = Number.isFinite(Number(q.fulldayChange))
    ? Number(q.fulldayChange)
    : Number.isFinite(pct)
      ? (price * pct) / 100
      : null;
  const prev = Number.isFinite(change) ? price - change : Number(q.chartPreviousClose);
  return {
    symbol: meta.symbol,
    ticker: meta.symbol.replace('.NS', '').replace('^', ''),
    name: meta.name,
    nameTamil: meta.nameTamil || '',
    sector: meta.sector || 'Other',
    price: round(price, price >= 1000 ? 1 : 2),
    change: round(change, 2),
    changePercent: round(pct, 2),
    open: round(last(bars.open) ?? q.regularMarketOpen, 2),
    prevClose: round(prev, 2),
    high: round(q.regularMarketDayHigh ?? last(bars.high), 2),
    low: round(q.regularMarketDayLow ?? last(bars.low), 2),
    volume: Number(q.regularMarketVolume ?? last(bars.volume)) || null,
    volumeLabel: fmtVol(q.regularMarketVolume ?? last(bars.volume)),
    marketCap: null,
    marketCapLabel: fmtCap(q.marketCap),
    pe: null,
    week52High: round(q.fiftyTwoWeekHigh, 2),
    week52Low: round(q.fiftyTwoWeekLow, 2),
    marketState: q.currentTradingPeriod?.regular ? 'REGULAR' : '',
    currency: q.currency || 'INR',
  };
};

const mapPool = async (items, limit, fn) => {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      try {
        out[idx] = await fn(items[idx]);
      } catch {
        out[idx] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out.filter(Boolean);
};

const fetchOne = async (meta) => {
  const data = await fetchJson(
    `${YAHOO_CHART}/${encodeURIComponent(meta.symbol)}?interval=1d&range=5d&includePrePost=false`
  );
  return parseChart(data, meta);
};

export const fetchLiveStockWatchlist = async ({ force = false } = {}) => {
  if (!force && cache.data && Date.now() - cache.at < CACHE_MS) {
    return { ...cache.data, fetchedAt: new Date().toISOString() };
  }

  const [indexes, stocks] = await Promise.all([
    mapPool(WATCHLIST_INDEXES, 3, fetchOne),
    mapPool(INDIA_WATCHLIST, 8, fetchOne),
  ]);

  if (!stocks.length) throw new Error('Watchlist fetch empty');

  const gainers = [...stocks]
    .filter((s) => (s.changePercent || 0) > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5);
  const losers = [...stocks]
    .filter((s) => (s.changePercent || 0) < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 5);
  const sorted = [...stocks].sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0));

  const payload = {
    indexes,
    stocks: sorted,
    gainers,
    losers,
    count: stocks.length,
    source: 'yahoo-finance',
    note: 'NSE live quotes · auto-refresh every minute',
    updatedAt: new Date().toISOString(),
  };

  cache.data = payload;
  cache.at = Date.now();
  return payload;
};

export default { fetchLiveStockWatchlist };
