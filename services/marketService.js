/**
 * Live stock / index quotes for the Market hub widget + /explore/market.
 * Source: Yahoo Finance public chart API (same family as goldPriceService).
 */

export const MARKET_INDEXES = [
  { symbol: '^NSEI', name: 'NIFTY 50', nameTamil: 'நிஃப்டி 50', region: 'India' },
  { symbol: '^BSESN', name: 'SENSEX', nameTamil: 'சென்செக்ஸ்', region: 'India' },
  { symbol: '^NSEBANK', name: 'NIFTY Bank', nameTamil: 'நிஃப்டி வங்கி', region: 'India' },
  { symbol: '^CNXIT', name: 'NIFTY IT', nameTamil: 'நிஃப்டி ஐடி', region: 'India' },
  { symbol: '^NSMIDCP', name: 'NIFTY Midcap 100', nameTamil: 'நிஃப்டி மிட்கேப்', region: 'India' },
  { symbol: '^INDIAVIX', name: 'India VIX', nameTamil: 'இந்தியா விக்ஸ்', region: 'India' },
  { symbol: '^HSI', name: 'Hang Seng', nameTamil: 'ஹாங் செங்', region: 'Asia' },
  { symbol: '^N225', name: 'Nikkei 225', nameTamil: 'நிக்கேய் 225', region: 'Asia' },
  { symbol: '000001.SS', name: 'Shanghai Composite', nameTamil: 'ஷாங்காய்', region: 'Asia' },
  { symbol: '^KS11', name: 'KOSPI', nameTamil: 'கோஸ்பி', region: 'Asia' },
  { symbol: '^STI', name: 'Straits Times', nameTamil: 'ஸ்ட்ரெய்ட்ஸ் டைம்ஸ்', region: 'Asia' },
  { symbol: '^GSPC', name: 'S&P 500', nameTamil: 'எஸ் அண்ட் பி 500', region: 'US' },
  { symbol: '^DJI', name: 'Dow Jones', nameTamil: 'டோ ஜோன்ஸ்', region: 'US' },
  { symbol: '^IXIC', name: 'Nasdaq Composite', nameTamil: 'நாஸ்டாக்', region: 'US' },
  { symbol: '^RUT', name: 'Russell 2000', nameTamil: 'ரஸல் 2000', region: 'US' },
  { symbol: '^FTSE', name: 'FTSE 100', nameTamil: 'எஃப்டிஎஸ்இ 100', region: 'Europe' },
  { symbol: '^GDAXI', name: 'DAX', nameTamil: 'டாக்ஸ்', region: 'Europe' },
  { symbol: '^FCHI', name: 'CAC 40', nameTamil: 'சிஏசி 40', region: 'Europe' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50', nameTamil: 'யூரோ ஸ்டாக்ஸ் 50', region: 'Europe' },
];

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_QUOTE = 'https://query1.finance.yahoo.com/v7/finance/quote';
const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; GreatIndiaNews/1.0)', Accept: 'application/json' };

const cache = { data: null, at: 0 };
const CACHE_MS = 5 * 60 * 1000;

const round = (n, d = 2) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const p = 10 ** d;
  return Math.round(v * p) / p;
};

const fetchJson = async (url) => {
  const res = await fetch(url, {
    headers: YAHOO_HEADERS,
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
};

const parseQuoteRow = (q, meta) => {
  const price = Number(q.regularMarketPrice ?? q.price);
  const prev = Number(q.regularMarketPreviousClose ?? q.chartPreviousClose);
  const change = Number(q.regularMarketChange);
  const changePercent = Number(q.regularMarketChangePercent);
  if (!Number.isFinite(price)) return null;
  const pct = Number.isFinite(changePercent)
    ? round(changePercent, 2)
    : Number.isFinite(prev) && prev
      ? round(((price - prev) / prev) * 100, 2)
      : null;
  return {
    symbol: meta.symbol,
    name: meta.name,
    nameTamil: meta.nameTamil,
    region: meta.region,
    value: round(price, price >= 1000 ? 1 : 2),
    change: Number.isFinite(change) ? round(change, 2) : Number.isFinite(prev) ? round(price - prev, 2) : null,
    changePercent: pct,
    currency: q.currency || 'INR',
    marketState: q.marketState || '',
  };
};

const fetchQuoteBatch = async (indexes) => {
  const symbols = indexes.map((i) => i.symbol).join(',');
  const data = await fetchJson(`${YAHOO_QUOTE}?symbols=${encodeURIComponent(symbols)}&region=IN&lang=en-IN`);
  const rows = data?.quoteResponse?.result;
  if (!Array.isArray(rows) || !rows.length) throw new Error('Yahoo quote empty');
  const bySymbol = new Map(rows.map((r) => [r.symbol, r]));
  return indexes
    .map((meta) => {
      const q = bySymbol.get(meta.symbol);
      return q ? parseQuoteRow(q, meta) : null;
    })
    .filter(Boolean);
};

const fetchOneChart = async (meta) => {
  const data = await fetchJson(
    `${YAHOO_CHART}/${encodeURIComponent(meta.symbol)}?interval=1d&range=5d&includePrePost=false`
  );
  const result = data?.chart?.result?.[0];
  const q = result?.meta;
  if (!q) throw new Error(`chart empty ${meta.symbol}`);
  const closes = result.indicators?.quote?.[0]?.close || [];
  const lastClose = [...closes].reverse().find((n) => Number.isFinite(n));
  return parseQuoteRow(
    {
      regularMarketPrice: q.regularMarketPrice ?? lastClose,
      regularMarketPreviousClose: q.chartPreviousClose ?? q.previousClose,
      regularMarketChange: q.regularMarketPrice - (q.chartPreviousClose || q.previousClose || 0),
      regularMarketChangePercent:
        q.chartPreviousClose
          ? ((q.regularMarketPrice - q.chartPreviousClose) / q.chartPreviousClose) * 100
          : null,
      currency: q.currency,
      marketState: q.marketState,
      symbol: meta.symbol,
    },
    meta
  );
};

const fetchCharts = async (indexes) => {
  const out = [];
  for (const meta of indexes) {
    try {
      const row = await fetchOneChart(meta);
      if (row) out.push(row);
    } catch {
      /* skip one index */
    }
  }
  if (!out.length) throw new Error('Yahoo chart fetch failed');
  return out;
};

export const fetchLiveMarket = async (config = {}, { force = false } = {}) => {
  if (!force && cache.data && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }

  let indexes = MARKET_INDEXES;
  if (Array.isArray(config.indexes) && config.indexes.length) {
    indexes = config.indexes.map((i) => ({
      symbol: i.symbol,
      name: i.name || i.symbol,
      nameTamil: i.nameTamil || '',
      region: i.region || 'Other',
    }));
  }

  let rows = [];
  let source = 'yahoo-finance';
  try {
    rows = await fetchQuoteBatch(indexes);
  } catch {
    rows = await fetchCharts(indexes);
    source = 'yahoo-finance-chart';
  }

  const highlightName = String(config.index || config.highlight || 'NIFTY 50').trim();
  const featured =
    rows.find((r) => r.name.toUpperCase() === highlightName.toUpperCase()) ||
    rows.find((r) => r.symbol === '^NSEI') ||
    rows[0];

  const payload = {
    index: featured?.name || 'NIFTY 50',
    value: featured?.value ?? config.value ?? null,
    changePercent: featured?.changePercent ?? config.changePercent ?? null,
    change: featured?.change ?? null,
    highlight: featured?.symbol || '^NSEI',
    indexes: rows,
    source,
    updatedAt: new Date().toISOString(),
    note: 'Live index levels',
  };

  cache.data = payload;
  cache.at = Date.now();
  return payload;
};

export default { fetchLiveMarket, MARKET_INDEXES };
