/**
 * Government notifications fetcher — official RSS feeds and JSON APIs only.
 * Does not scrape protected/restricted pages.
 */

import { isMostlyEnglish, matchesPreferredLanguage } from './governmentTextUtils.js';

const decodeXml = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

const stripHtml = (s = '') =>
  decodeXml(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractTag = (block, tag) => {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = block.match(re);
  return m ? decodeXml(m[1]) : '';
};

const extractAttr = (block, tag, attr) => {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*/?>`, 'i');
  const m = block.match(re);
  return m ? decodeXml(m[1]) : '';
};

const hash = (s) => {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return `g${Math.abs(h)}`;
};

export const buildFingerprint = (item) =>
  hash([item.officialUrl || item.sourceUrl || '', item.title || '', item.publishedAt || ''].join('|'));

export const parseRssItems = (xml = '') => {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const title = stripHtml(extractTag(block, 'title'));
    const link = extractTag(block, 'link') || extractAttr(block, 'link', 'href');
    const guid = extractTag(block, 'guid') || link;
    const description = stripHtml(extractTag(block, 'description'));
    const pubDate = extractTag(block, 'pubDate');
    const category = stripHtml(extractTag(block, 'category'));
    if (!title) continue;
    items.push({
      title,
      summary: description,
      officialUrl: link || guid,
      publishedAt: pubDate ? new Date(pubDate) : new Date(),
      categoryHint: category,
      guid,
    });
  }
  return items;
};

export const fetchRssFeed = async (url) => {
  const res = await fetch(url, {
    headers: {
      // PIB and many .gov.in feeds block non-browser user agents (403)
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      'Accept-Language': 'en-IN,en;q=0.9',
      Referer: 'https://www.pib.gov.in/',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    const hint =
      res.status === 403
        ? ' — source blocked the request (check feed URL or try again later)'
        : '';
    const err = new Error(`Feed fetch failed (${res.status})${hint}`);
    err.statusCode = res.status;
    throw err;
  }
  const text = await res.text();
  // Reject HTML login walls / non-feed responses
  if (/<\s*html[\s>]/i.test(text) && !/<\s*rss[\s>]|<\s*feed[\s>]/i.test(text)) {
    const err = new Error('URL did not return an RSS/Atom feed (blocked or HTML page)');
    err.statusCode = 422;
    throw err;
  }
  const items = parseRssItems(text);
  if (!items.length) {
    const err = new Error('Feed returned no items (empty or unsupported format)');
    err.statusCode = 422;
    throw err;
  }
  return items;
};

export const fetchJsonApi = async (url) => {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-IN,en;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    const err = new Error(`API fetch failed (${res.status})`);
    err.statusCode = res.status;
    throw err;
  }
  const json = await res.json();
  const list = Array.isArray(json) ? json : json.data || json.items || json.results || [];
  if (!Array.isArray(list)) {
    throw new Error('API response format not recognized');
  }
  return list.map((raw) => ({
    title: raw.title || raw.name || raw.subject || 'Government notification',
    summary: raw.summary || raw.description || raw.excerpt || '',
    content: raw.content || raw.body || '',
    officialUrl: raw.url || raw.link || raw.officialUrl || '',
    publishedAt: raw.publishedAt || raw.date || raw.pubDate || new Date(),
    categoryHint: raw.category || '',
    titleTamil: raw.titleTamil || raw.title_ta || '',
    summaryTamil: raw.summaryTamil || raw.summary_ta || '',
  }));
};

const guessCategory = (text = '', hint = '', sourceCategory = 'general') => {
  const t = `${hint} ${text}`.toLowerCase();
  if (/tender|e-procure|bid/.test(t)) return 'tender';
  if (/recruit|vacancy|job|employment|நிரப்பு/.test(t)) return 'job';
  if (/scheme|yojana|திட்ட/.test(t)) return 'scheme';
  if (/circular|சுற்றறிக்கை/.test(t)) return 'circular';
  if (/order|g\.?o\.?|அரசாணை/.test(t)) return 'order';
  if (/alert|warning|emergency|எச்சரிக்கை/.test(t)) return 'alert';
  if (/welfare|நல/.test(t)) return 'welfare';
  if (/notice|அறிவிப்பு/.test(t)) return 'public_notice';
  if (/announce|press/.test(t)) return 'announcement';
  return sourceCategory || 'general';
};

const matchesKeywords = (item, keywords = []) => {
  if (!keywords?.length) return true;
  const hay = `${item.title} ${item.summary}`.toLowerCase();
  return keywords.some((k) => hay.includes(String(k).toLowerCase()));
};

const PIB_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  Referer: 'https://www.pib.gov.in/',
};

const extractMetaContent = (html, prop) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  return decodeXml(html.match(re)?.[1] || html.match(alt)?.[1] || '');
};

const extractPageTitle = (html = '') => {
  const og = extractMetaContent(html, 'og:title');
  if (og) return stripHtml(og);
  const t = extractTag(html, 'title');
  return stripHtml(t);
};

const extractPageSummary = (html = '') => {
  const og = extractMetaContent(html, 'og:description') || extractMetaContent(html, 'description');
  if (og) return stripHtml(og);
  const span = html.match(/<span[^>]*id=["']lblContent["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
  return stripHtml(span || '').slice(0, 500);
};

const isPibFeedUrl = (url = '') => /pib\.gov\.in\/RssMain\.aspx/i.test(url);

/** PIB lists Hindi on Regid=3; English Regid=1 is often empty — resolve English from release pages */
const pibListingFeedUrl = (url = '') => {
  const u = String(url).trim();
  if (!isPibFeedUrl(u)) return u;
  if (/Regid=1/i.test(u) && /Lang=1/i.test(u)) {
    return u.replace(/Regid=1/i, 'Regid=3');
  }
  return u;
};

const resolvePibEnglishItem = async (rssItem) => {
  const iframeUrl = rssItem.officialUrl;
  if (!iframeUrl) return null;

  const iframePrid = parseInt(iframeUrl.match(/PRID=(\d+)/i)?.[1] || '0', 10);

  const res = await fetch(iframeUrl, { headers: PIB_HEADERS, redirect: 'follow' });
  if (!res.ok) return null;
  const html = await res.text();

  const rawLinks = [
    ...html.matchAll(/href=["']([^"']*PressReleasePage\.aspx\?PRID=\d+[^"']*)["']/gi),
  ].map((m) => m[1].replace(/&amp;/g, '&'));

  const candidates = [
    ...new Set(
      rawLinks
        .filter((u) => !/facebook|twitter|whatsapp|linkedin|mail\.google/i.test(u))
        .map((u) => (u.startsWith('http') ? u : `https://pib.gov.in/${u.replace(/^\//, '')}`))
    ),
  ].sort((a, b) => {
    const pridA = parseInt(a.match(/PRID=(\d+)/i)?.[1] || '0', 10);
    const pridB = parseInt(b.match(/PRID=(\d+)/i)?.[1] || '0', 10);
    if (!iframePrid) return 0;
    return Math.abs(pridA - iframePrid) - Math.abs(pridB - iframePrid);
  });

  for (const url of candidates.slice(0, 8)) {
    try {
      const pr = await fetch(url, { headers: PIB_HEADERS, redirect: 'follow' });
      if (!pr.ok) continue;
      const pageHtml = await pr.text();
      const title = extractPageTitle(pageHtml);
      if (!title || !isMostlyEnglish(title)) continue;
      const summary = extractPageSummary(pageHtml) || rssItem.summary || '';
      const cleanUrl = url.replace(/&amp;/g, '&').split('#')[0];
      return {
        title,
        summary: isMostlyEnglish(summary) ? summary : '',
        content: isMostlyEnglish(summary) ? summary : title,
        officialUrl: cleanUrl,
        publishedAt: rssItem.publishedAt,
        categoryHint: rssItem.categoryHint,
        guid: cleanUrl,
      };
    } catch {
      /* try next candidate */
    }
  }
  return null;
};

const fetchPibEnglishFromSource = async (source, globalKeywords = [], maxItems = 20) => {
  const keywords = [...(source.keywords || []), ...globalKeywords].filter(Boolean);
  const listingUrl = pibListingFeedUrl(normalizeKnownFeedUrl(source.feedUrl));
  const raw = await fetchRssFeed(listingUrl);

  const resolved = [];
  for (const item of raw.slice(0, maxItems + 10)) {
    if (resolved.length >= maxItems) break;
    const english = await resolvePibEnglishItem(item);
    if (!english) continue;
    if (!matchesKeywords(english, keywords)) continue;
    resolved.push(english);
  }

  const items = resolved.map((item) => ({
    title: item.title,
    titleTamil: '',
    summary: item.summary || '',
    summaryTamil: '',
    content: item.content || item.summary || '',
    category: guessCategory(`${item.title} ${item.summary}`, item.categoryHint, source.category),
    level: source.level || 'central',
    department: source.department || source.name,
    sourceName: source.name,
    sourceUrl: source.websiteUrl || listingUrl,
    officialUrl: item.officialUrl || '',
    language: 'en',
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
    keywords,
    isImportant: item.categoryHint === 'alert' || /alert|emergency|urgent/i.test(item.title),
  }));

  return { items, source: source.name, skipped: false };
};

/**
 * Default public RSS-capable source templates (admin can edit/disable).
 * Only legitimate public feed endpoints — not scrapers.
 */
export const DEFAULT_SOURCES = [
  {
    name: 'Press Information Bureau (PIB)',
    level: 'central',
    department: 'Press Information Bureau',
    /** PIB listing feed (Hindi RSS); English titles resolved from official release pages */
    feedUrl: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3',
    websiteUrl: 'https://pib.gov.in',
    category: 'announcement',
    language: 'en',
    keywords: [],
    isActive: true,
  },
  {
    name: 'PIB — Press Releases (National / Regid 1)',
    level: 'central',
    department: 'Press Information Bureau',
    feedUrl: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3',
    websiteUrl: 'https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=1',
    category: 'announcement',
    language: 'en',
    keywords: [],
    isActive: false,
  },
  {
    name: 'India.gov.in — News & Alerts',
    level: 'central',
    department: 'National Portal of India',
    feedUrl: '',
    websiteUrl: 'https://www.india.gov.in',
    category: 'general',
    language: 'en',
    keywords: ['scheme', 'notification'],
    isActive: false,
  },
  {
    name: 'Tamil Nadu Government — Information',
    level: 'tamil_nadu',
    department: 'Government of Tamil Nadu',
    feedUrl: '',
    websiteUrl: 'https://www.tn.gov.in',
    category: 'announcement',
    language: 'both',
    keywords: [],
    isActive: false,
  },
];

/** Fix known broken PIB URLs already saved in DB */
export const normalizeKnownFeedUrl = (url = '') => {
  const u = String(url).trim();
  if (!u) return u;
  // Empty English listing (Regid=1) — use Regid=3 and resolve English from pages
  if (/pib\.gov\.in\/RssMain\.aspx/i.test(u) && /Regid=1/i.test(u) && /Lang=1/i.test(u)) {
    return u.replace(/Regid=1/i, 'Regid=3');
  }
  if (/pib\.gov\.in\/RssMain\.aspx/i.test(u) && /Lang=2/i.test(u)) {
    return u.replace(/Lang=2/i, 'Lang=1');
  }
  // Old incorrect template
  if (/pib\.gov\.in\/RssMain\.aspx\?Lang=1&Modid=1/i.test(u)) {
    return 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3';
  }
  if (/pib\.gov\.in\/RssMain\.aspx\?.*Modid=1/i.test(u) && !/ModId=6/i.test(u)) {
    return 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3';
  }
  return u;
};

export const fetchFromSource = async (source, globalKeywords = [], maxItems = 20) => {
  const keywords = [...(source.keywords || []), ...globalKeywords].filter(Boolean);
  const sourceLang = source.language || 'en';
  const feedUrl = normalizeKnownFeedUrl(source.feedUrl);

  if (isPibFeedUrl(feedUrl) && sourceLang === 'en') {
    return fetchPibEnglishFromSource(source, globalKeywords, maxItems);
  }

  let raw = [];

  if (feedUrl) {
    raw = await fetchRssFeed(feedUrl);
  } else if (source.apiUrl?.trim()) {
    raw = await fetchJsonApi(source.apiUrl.trim());
  } else {
    return { items: [], source: source.name, skipped: true, reason: 'No feed/API URL configured' };
  }

  const items = raw
    .filter((item) => matchesKeywords(item, keywords))
    .filter((item) => {
      if (sourceLang === 'both') return true;
      return matchesPreferredLanguage(
        { title: item.title, summary: item.summary, content: item.content },
        sourceLang
      );
    })
    .slice(0, maxItems)
    .map((item) => ({
      title: item.title,
      titleTamil: item.titleTamil || '',
      summary: item.summary || '',
      summaryTamil: item.summaryTamil || '',
      content: item.content || item.summary || '',
      category: guessCategory(`${item.title} ${item.summary}`, item.categoryHint, source.category),
      level: source.level || 'central',
      department: source.department || source.name,
      sourceName: source.name,
      sourceUrl: source.websiteUrl || source.feedUrl || source.apiUrl || '',
      officialUrl: item.officialUrl || '',
      language: sourceLang === 'both' ? (isMostlyEnglish(item.title) ? 'en' : 'ta') : sourceLang,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
      keywords,
      isImportant: item.categoryHint === 'alert' || /alert|emergency|urgent/i.test(item.title),
    }));

  return { items, source: source.name, skipped: false };
};

export default {
  fetchFromSource,
  buildFingerprint,
  DEFAULT_SOURCES,
  parseRssItems,
  normalizeKnownFeedUrl,
  pibListingFeedUrl,
};
