/**
 * Inbound RSS/Atom → Article ingest.
 * Full article enrich from publisher page + Tamil translation (Gemini).
 */

import slugify from 'slugify';
import Article from '../models/Article.js';
import RssFeedSource from '../models/RssFeedSource.js';
import { ARTICLE_STATUS } from '../config/constants.js';
import { sanitizeContent } from '../utils/sanitize.js';
import { generateSlug } from '../utils/helpers.js';
import { invalidateRssCache } from './rssFeedService.js';
import { enrichRssItem } from './articleEnrichmentService.js';
import { translateNewsToTamil } from './rssTranslateService.js';

const decodeXml = (s = '') =>
  String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

const stripHtml = (s = '') =>
  decodeXml(s)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractTag = (block, tag) => {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const m = block.match(re);
  return m ? decodeXml(m[1]) : '';
};

const extractAttr = (block, tag, attr) => {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*/?>`, 'i');
  const m = block.match(re);
  return m ? decodeXml(m[1]) : '';
};

const firstImgSrc = (html = '') => {
  const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? decodeXml(m[1]) : '';
};

const toAbsoluteUrl = (url, baseFeedUrl) => {
  let u = String(url || '').trim();
  if (!u) return '';
  u = u.replace(/\s+/g, ' ').trim();
  if (/^https?:\/\//i.test(u)) {
    try {
      const parsed = new URL(u);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) =>
        parsed.searchParams.delete(k)
      );
      return parsed.toString();
    } catch {
      return u;
    }
  }
  try {
    return new URL(u, baseFeedUrl).href;
  } catch {
    return u;
  }
};

const excerptFrom = (text, max = 280) => {
  const t = stripHtml(text);
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, '')}…`;
};

const htmlFromText = (title, bodyHtml, sourceUrl) => {
  const body = String(bodyHtml || '').trim();
  const safeBody = body.includes('<') ? body : `<p>${stripHtml(body) || title}</p>`;
  const source = sourceUrl
    ? `<p><a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">மூலம் / Source</a></p>`
    : '';
  return `${safeBody}${source}`;
};

const plainToHtml = (text = '') => {
  const raw = String(text || '');
  if (raw.includes('<p') || raw.includes('<div')) return raw;
  const parts = raw
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!parts.length) {
    const one = raw.replace(/\s+/g, ' ').trim();
    return one ? `<p>${one}</p>` : '';
  }
  return parts.map((p) => `<p>${p}</p>`).join('\n');
};

/** Parse RSS 2.0 <item> and Atom <entry> blocks */
export const parseFeedItems = (xml = '', feedUrl = '') => {
  const items = [];
  const rssBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const atomBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const block of rssBlocks) {
    const title = stripHtml(extractTag(block, 'title'));
    const link = extractTag(block, 'link') || extractAttr(block, 'link', 'href');
    const guid = extractTag(block, 'guid') || link;
    const descriptionRaw = extractTag(block, 'description');
    const contentEncoded =
      extractTag(block, 'content:encoded') || extractTag(block, 'encoded') || '';
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date');
    const category = stripHtml(extractTag(block, 'category'));
    const creator =
      stripHtml(extractTag(block, 'dc:creator')) || stripHtml(extractTag(block, 'author'));
    const enclosure = extractAttr(block, 'enclosure', 'url');
    const mediaContent =
      extractAttr(block, 'media:content', 'url') ||
      extractAttr(block, 'media:thumbnail', 'url');
    const image =
      mediaContent ||
      enclosure ||
      firstImgSrc(contentEncoded) ||
      firstImgSrc(descriptionRaw);

    if (!title) continue;
    items.push({
      title,
      link: toAbsoluteUrl(link || guid, feedUrl),
      guid: guid || link || title,
      description: descriptionRaw,
      contentHtml: contentEncoded || descriptionRaw,
      publishedAt: pubDate ? new Date(pubDate) : new Date(),
      categoryHint: category,
      creator,
      image: toAbsoluteUrl(image, feedUrl),
    });
  }

  for (const block of atomBlocks) {
    const title = stripHtml(extractTag(block, 'title'));
    const link = extractAttr(block, 'link', 'href') || extractTag(block, 'link');
    const guid = extractTag(block, 'id') || link;
    const summary = extractTag(block, 'summary');
    const content = extractTag(block, 'content') || summary;
    const published = extractTag(block, 'published') || extractTag(block, 'updated');
    const category =
      extractAttr(block, 'category', 'term') || stripHtml(extractTag(block, 'category'));
    const creator =
      stripHtml(extractTag(block, 'name')) || stripHtml(extractTag(block, 'author'));
    const media =
      extractAttr(block, 'media:thumbnail', 'url') ||
      extractAttr(block, 'media:content', 'url') ||
      firstImgSrc(content);
    if (!title) continue;
    items.push({
      title,
      link: toAbsoluteUrl(link || guid, feedUrl),
      guid: guid || link || title,
      description: summary,
      contentHtml: content || summary,
      publishedAt: published ? new Date(published) : new Date(),
      categoryHint: category,
      creator,
      image: toAbsoluteUrl(media, feedUrl),
    });
  }

  return items;
};

const isFeedXml = (text = '') =>
  /<\s*rss[\s>]|<\s*feed[\s>]|<\s*rdf:RDF/i.test(text);

const isHtmlDocument = (text = '') =>
  /<\s*html[\s>]/i.test(text) && !isFeedXml(text);

/** Find RSS/Atom URLs advertised in an HTML page (<link rel="alternate" ...>). */
export const discoverFeedUrlsFromHtml = (html, pageUrl) => {
  const found = [];
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    const type = (tag.match(/\btype=["']([^"']+)["']/i) || [])[1] || '';
    const rel = (tag.match(/\brel=["']([^"']+)["']/i) || [])[1] || '';
    const href = (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1] || '';
    if (!href) continue;
    const isFeedType = /application\/(rss|atom)\+xml/i.test(type) || /rss|atom/i.test(type);
    const isAlternate = /\balternate\b/i.test(rel);
    if (isFeedType || (isAlternate && /feed|rss|atom/i.test(href))) {
      const abs = toAbsoluteUrl(href, pageUrl);
      if (abs && !found.includes(abs)) found.push(abs);
    }
  }
  return found;
};

const candidateFeedUrls = (pageUrl) => {
  try {
    const u = new URL(pageUrl);
    const origin = u.origin;
    const path = u.pathname.replace(/\/+$/, '') || '';
    return [
      `${origin}/feedapi/latest-news/`,
      `${origin}/feed/`,
      `${origin}/feed`,
      `${origin}/rss`,
      `${origin}/rss.xml`,
      `${origin}/atom.xml`,
      `${origin}/index.xml`,
      `${origin}/?feed=rss2`,
      path ? `${origin}${path}/feed/` : null,
    ].filter(Boolean);
  } catch {
    return [];
  }
};

const fetchUrlText = async (url) => {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5',
      'Accept-Language': 'en-IN,en;q=0.9,ta;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    const err = new Error(`Feed fetch failed (HTTP ${res.status})`);
    err.statusCode = res.status;
    throw err;
  }
  const text = await res.text();
  return { text, finalUrl: res.url || url };
};

export const fetchFeedXml = async (url) => {
  const tried = new Set();
  const queue = [url];

  while (queue.length) {
    const next = queue.shift();
    if (!next || tried.has(next)) continue;
    tried.add(next);

    let text;
    let finalUrl = next;
    try {
      ({ text, finalUrl } = await fetchUrlText(next));
    } catch (err) {
      if (tried.size === 1 && queue.length === 0) throw err;
      continue;
    }

    if (isFeedXml(text)) {
      return text;
    }

    if (isHtmlDocument(text)) {
      const discovered = discoverFeedUrlsFromHtml(text, finalUrl || next);
      for (const d of discovered) {
        if (!tried.has(d) && !queue.includes(d)) queue.push(d);
      }
      // Only guess common paths from the original site URL once
      if (next === url) {
        for (const c of candidateFeedUrls(url)) {
          if (!tried.has(c) && !queue.includes(c)) queue.push(c);
        }
      }
      continue;
    }
  }

  const err = new Error('URL did not return an RSS/Atom feed');
  err.statusCode = 422;
  throw err;
};

/** Enrich RSS item with full publisher article + optional Tamil translation */
const prepareItemForArticle = async (item, source) => {
  let working = {
    title: item.title,
    link: item.link,
    image: item.image,
    description: stripHtml(item.description || ''),
    content: stripHtml(item.contentHtml || item.description || ''),
    descriptionHtml: item.description || '',
    guid: item.guid,
    publishedAt: item.publishedAt,
    categoryHint: item.categoryHint,
  };

  if (source.fetchFullContent !== false && working.link) {
    try {
      // Always scrape the article page — RSS description is only a short blurb
      const enriched = await enrichRssItem(working, { forceFullContent: true });
      working = { ...working, ...enriched };
    } catch (err) {
      console.warn('[RssIngest] enrich failed:', err.message);
    }
  }

  // Prefer longest body: scraped content → RSS content:encoded → description
  const rssPlain = stripHtml(item.contentHtml || '');
  const scrapedPlain = stripHtml(working.content || '');
  const descPlain = stripHtml(working.description || item.description || '');
  const fullPlain = [scrapedPlain, rssPlain, descPlain, working.title || item.title || '']
    .sort((a, b) => b.length - a.length)[0];

  let title = String(working.title || item.title || '').trim();
  // Excerpt stays short; content gets the full story
  let excerpt = excerptFrom(
    (working.description && working.description.length <= 400
      ? working.description
      : '') || fullPlain || title
  );
  let contentHtml = plainToHtml(fullPlain || title);

  let translated = false;
  if (source.translateToTamil !== false) {
    try {
      const ta = await translateNewsToTamil({
        title,
        excerpt,
        content: fullPlain || excerpt,
      });
      if (ta?.title) {
        title = ta.title;
        excerpt = ta.excerpt || excerpt;
        contentHtml = ta.contentHtml || contentHtml;
        translated = true;
      }
    } catch (err) {
      console.warn('[RssIngest] Tamil translate failed:', err.message);
    }
  }

  return {
    title,
    excerpt,
    contentHtml,
    image: working.image || item.image || '',
    link: working.sourceUrl || working.link || item.link || '',
    guid: item.guid,
    categoryHint: item.categoryHint,
    publishedAt: item.publishedAt,
    translated,
  };
};

const buildArticlePayload = async (prepared, source) => {
  const title = prepared.title.trim();
  const sourceUrl = prepared.link || '';
  const excerpt = prepared.excerpt || excerptFrom(prepared.contentHtml || title);
  const content = sanitizeContent(
    htmlFromText(title, prepared.contentHtml || excerpt, sourceUrl)
  );
  const featuredImage = prepared.image || '';
  const tags = [
    ...(Array.isArray(source.tags) ? source.tags : []),
    ...(prepared.categoryHint ? [prepared.categoryHint] : []),
    ...(prepared.translated ? ['தமிழ்', 'tamil'] : []),
  ]
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 12);

  const slugBase =
    slugify(title, { lower: true, strict: true }) || `rss-${Date.now().toString(36)}`;
  const slug = await generateSlug(slugBase);

  const status = source.createAsStatus || ARTICLE_STATUS.DRAFT;
  const payload = {
    title,
    slug,
    excerpt,
    content,
    featuredImage,
    imageAlt: title,
    imageCaption: '',
    category: source.category,
    author: source.author,
    tags,
    status,
    seoTitle: title.slice(0, 70),
    metaDescription: excerpt.slice(0, 160),
    focusKeyword: tags[0] || title.split(/\s+/).slice(0, 3).join(' '),
    ogTitle: title.slice(0, 70),
    ogDescription: excerpt.slice(0, 160),
    ogImage: featuredImage,
    twitterTitle: title.slice(0, 70),
    twitterDescription: excerpt.slice(0, 160),
    twitterImage: featuredImage,
    aiSummary: excerpt,
    directAnswer: excerpt,
    canonicalUrl: sourceUrl,
    sourceUrl,
    importSource: 'rss',
    importGuid: String(prepared.guid || sourceUrl || title).slice(0, 500),
    rssFeed: source._id,
    robots: 'index,follow',
  };

  if (status === ARTICLE_STATUS.PUBLISHED) {
    payload.publishedAt =
      prepared.publishedAt && !Number.isNaN(prepared.publishedAt.getTime())
        ? prepared.publishedAt
        : new Date();
  }

  return payload;
};

export const ingestFeedSource = async (source, { userId } = {}) => {
  const counts = { fetched: 0, created: 0, skipped: 0, errors: 0, translated: 0 };
  try {
    const xml = await fetchFeedXml(source.feedUrl);
    const items = parseFeedItems(xml, source.feedUrl);
    const limit = Math.min(50, Math.max(1, source.maxItemsPerFetch || 20));
    const slice = items.slice(0, limit);
    counts.fetched = slice.length;

    for (const item of slice) {
      try {
        const guid = String(item.guid || item.link || item.title).slice(0, 500);
        const exists = await Article.findOne({
          $or: [
            { importSource: 'rss', importGuid: guid },
            ...(item.link ? [{ sourceUrl: item.link }] : []),
          ],
        })
          .select('_id')
          .lean();
        if (exists) {
          counts.skipped += 1;
          continue;
        }

        const prepared = await prepareItemForArticle(item, source);
        if (prepared.translated) counts.translated += 1;

        const payload = await buildArticlePayload(prepared, source);
        if (userId) payload.createdBy = userId;
        await Article.create(payload);
        counts.created += 1;
      } catch (err) {
        counts.errors += 1;
        console.warn('[RssIngest] item error:', err.message);
      }
    }

    if (counts.created > 0 && source.createAsStatus === ARTICLE_STATUS.PUBLISHED) {
      invalidateRssCache();
    }

    source.lastFetchAt = new Date();
    source.lastFetchStatus = 'success';
    source.lastFetchMessage = `Fetched ${counts.fetched}, created ${counts.created}, Tamil ${counts.translated}, skipped ${counts.skipped}`;
    source.lastFetchCounts = counts;
    await source.save();

    return { success: true, counts, message: source.lastFetchMessage };
  } catch (err) {
    source.lastFetchAt = new Date();
    source.lastFetchStatus = 'error';
    source.lastFetchMessage = err.message || 'Fetch failed';
    source.lastFetchCounts = counts;
    await source.save();
    return { success: false, counts, error: source.lastFetchMessage };
  }
};

export const runAllRssIngest = async ({ userId, onlyAuto = false } = {}) => {
  const query = { enabled: true };
  if (onlyAuto) query.autoFetchEnabled = true;
  const sources = await RssFeedSource.find(query);
  const results = [];
  let created = 0;
  let skipped = 0;
  let fetched = 0;
  let translated = 0;

  for (const source of sources) {
    const result = await ingestFeedSource(source, { userId });
    results.push({
      id: source._id,
      name: source.name,
      ...result,
    });
    fetched += result.counts?.fetched || 0;
    created += result.counts?.created || 0;
    skipped += result.counts?.skipped || 0;
    translated += result.counts?.translated || 0;
  }

  return {
    success: true,
    sources: results.length,
    fetched,
    created,
    skipped,
    translated,
    results,
  };
};
