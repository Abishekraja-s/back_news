/**
 * Live “On this day” history from Wikipedia (no API key).
 * Date always uses Asia/Kolkata.
 */

const cache = { key: '', data: null, at: 0 };
const CACHE_MS = 20 * 1000;

const istParts = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    year: Number(get('year')),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
    weekday: get('weekday'),
  };
};

const fetchJson = async (url) => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'GreatIndiaNews/1.0 (today-in-history; https://thegreatindianews.com)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || data?.title || `HTTP ${res.status}`);
  return data;
};

const mapItems = (list = [], kind) =>
  (Array.isArray(list) ? list : [])
    .map((row, i) => {
      const page = row.pages?.[0] || {};
      const thumb = page.thumbnail?.source || page.originalimage?.source || '';
      const title = page.titles?.normalized || page.title || '';
      const text = String(row.text || page.description || title || '').trim();
      if (!text) return null;
      return {
        id: `${kind}-${row.year || 'x'}-${i}`,
        kind,
        year: row.year ?? null,
        text,
        title,
        thumbnail: thumb,
        url: page.content_urls?.desktop?.page || page.content_urls?.mobile?.page || '',
        india: /india|tamil|chennai|madras|delhi|mumbai|bengal|kerala|gandhi|nehru/i.test(`${text} ${title}`),
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.india) - Number(a.india) || (b.year || 0) - (a.year || 0));

export const fetchTodayInHistory = async ({ force = false } = {}) => {
  const p = istParts();
  const dateKey = `${p.month}-${p.day}`;
  if (!force && cache.data && cache.key === dateKey && Date.now() - cache.at < CACHE_MS) {
    return {
      ...cache.data,
      clock: `${p.hour}:${p.minute}:${p.second}`,
      fetchedAt: new Date().toISOString(),
    };
  }

  const mm = p.month;
  const dd = p.day;
  let en = {};
  let ta = {};
  try {
    const [enRes, taRes] = await Promise.allSettled([
      fetchJson(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${mm}/${dd}`),
      fetchJson(`https://ta.wikipedia.org/api/rest_v1/feed/onthisday/all/${mm}/${dd}`),
    ]);
    if (enRes.status === 'fulfilled') en = enRes.value;
    if (taRes.status === 'fulfilled') ta = taRes.value;
  } catch {
    /* keep empty */
  }

  const events = mapItems(en.selected?.length ? en.selected : en.events, 'event').slice(0, 24);
  const moreEvents = mapItems(en.events, 'event');
  const mergedEvents = [...events];
  moreEvents.forEach((e) => {
    if (!mergedEvents.find((x) => x.year === e.year && (x.title === e.title || x.text.slice(0, 40) === e.text.slice(0, 40)))) {
      mergedEvents.push(e);
    }
  });

  const payload = {
    dateKey,
    dateLabel: `${p.weekday}, ${Number(p.day)} ${new Date(2000, Number(p.month) - 1, 1).toLocaleString('en-GB', { month: 'long' })}`,
    dateTamil: 'வரலாற்றில் இன்று',
    month: Number(p.month),
    day: Number(p.day),
    clock: `${p.hour}:${p.minute}:${p.second}`,
    events: mergedEvents.slice(0, 30),
    births: mapItems(en.births, 'birth').slice(0, 16),
    deaths: mapItems(en.deaths, 'death').slice(0, 16),
    holidays: mapItems(en.holidays, 'holiday').slice(0, 10),
    tamilEvents: mapItems(ta.events || ta.selected, 'ta').slice(0, 8),
    source: events.length || moreEvents.length ? 'wikipedia' : 'empty',
    note: 'Live from Wikipedia · On this day · IST',
    updatedAt: new Date().toISOString(),
  };

  cache.key = dateKey;
  cache.data = payload;
  cache.at = Date.now();
  return payload;
};

export default { fetchTodayInHistory };
