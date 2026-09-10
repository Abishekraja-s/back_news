/**
 * Dynamic RSS 2.0 feeds from published Article records.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Article from '../models/Article.js';
import Category from '../models/Category.js';
import AeoConfig from '../models/AeoConfig.js';
import { ARTICLE_STATUS } from '../config/constants.js';
import { DEFAULT_AEO_CONFIG } from '../config/aeoDefaults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const mergeAeoConfig = (stored = {}) => ({
  ...DEFAULT_AEO_CONFIG,
  ...stored,
  modules: { ...DEFAULT_AEO_CONFIG.modules, ...(stored.modules || {}) },
});

const getOrCreateAeoConfig = async () => {
  let doc = await AeoConfig.findOne({ key: 'global' });
  if (!doc) doc = await AeoConfig.create({ key: 'global', config: { ...DEFAULT_AEO_CONFIG } });
  return mergeAeoConfig(doc.config);
};

const RSS_CONTENT_TYPES = {
  full: 'full',
  excerpt: 'excerpt',
  none: 'none',
};

const cache = new Map();
const imageSizeCache = new Map();

export const invalidateRssCache = () => {
  cache.clear();
  imageSizeCache.clear();
};

const getClientBaseUrl = (config = {}) => {
  const fromEnv = process.env.CLIENT_URL || 'https://www.thegreatindianews.com';
  const base = (config.canonicalBaseUrl || fromEnv.split(',')[0].trim()).replace(/\/$/, '');
  return base;
};

export const getRssSettings = async () => {
  const merged = await getOrCreateAeoConfig();
  const articleSegment = String(merged.rssArticlePath || 'post').replace(/^\/+|\/+$/g, '') || 'post';
  return {
    enabled: merged.rssEnabled !== false,
    channelTitle: merged.rssChannelTitle || 'The Great India News Live RSS Dispatch',
    channelDescription:
      merged.rssChannelDescription ||
      'The standard of excellence in Indian journalism. Premium regional breaking news and investigations.',
    feedLimit: Math.min(Math.max(parseInt(merged.rssFeedLimit, 10) || 30, 1), 100),
    bodyContentDepth: RSS_CONTENT_TYPES[merged.rssBodyContentDepth]
      ? merged.rssBodyContentDepth
      : 'full',
    language: merged.rssLanguage || 'en-IN',
    cacheSeconds: Math.min(Math.max(parseInt(merged.rssCacheSeconds, 10) || 300, 60), 3600),
    baseUrl: getClientBaseUrl(merged),
    articlePath: articleSegment,
  };
};

/** Published, public, non-future articles only */
export const buildPublishedArticleFilter = (extra = {}) => {
  const now = new Date();
  return {
    status: ARTICLE_STATUS.PUBLISHED,
    publishedAt: { $lte: now, $ne: null },
    robots: { $not: /noindex/i },
    ...extra,
  };
};

const escapeXml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const wrapCdata = (value = '') => {
  const s = String(value);
  return `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
};

const resolveAbsoluteUrl = (url, baseUrl) => {
  if (!url || !String(url).trim()) return '';
  const u = String(url).trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return `https:${u}`;
  const rel = u.startsWith('/') ? u : `/${u}`;
  return `${baseUrl}${rel}`;
};

export const buildArticleUrl = (article, baseUrl, articlePath = 'post') => {
  if (article.canonicalUrl?.trim()) {
    return resolveAbsoluteUrl(article.canonicalUrl, baseUrl);
  }
  const segment = String(articlePath || 'post').replace(/^\/+|\/+$/g, '') || 'post';
  return `${baseUrl}/${segment}/${article.slug}`;
};

const guessImageMime = (url = '') => {
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
};

const stripHtml = (html = '') =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getDescription = (article) =>
  (article.excerpt || article.metaDescription || stripHtml(article.content)).trim();

const getFeaturedImageUrl = (article, baseUrl) =>
  resolveAbsoluteUrl(article.ogImage || article.featuredImage, baseUrl);

const getLocalUploadPath = (imageUrl) => {
  if (!imageUrl) return null;
  const u = String(imageUrl);
  const idx = u.indexOf('/uploads/');
  if (idx === -1) return null;
  const rel = u.slice(idx + '/uploads/'.length).split('?')[0];
  if (!rel || rel.includes('..')) return null;
  return path.join(UPLOADS_DIR, rel);
};

const getImageByteLength = async (imageUrl) => {
  if (!imageUrl) return 0;
  if (imageSizeCache.has(imageUrl)) return imageSizeCache.get(imageUrl);

  let size = 0;
  const localPath = getLocalUploadPath(imageUrl);
  if (localPath) {
    try {
      size = fs.statSync(localPath).size;
    } catch {
      size = 0;
    }
  } else if (/^https?:\/\//i.test(imageUrl)) {
    try {
      const res = await fetch(imageUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(4000),
      });
      const len = res.headers.get('content-length');
      size = len ? parseInt(len, 10) || 0 : 0;
    } catch {
      size = 0;
    }
  }

  imageSizeCache.set(imageUrl, size);
  return size;
};

const selectFields = (bodyContentDepth) => {
  const base =
    'title slug excerpt metaDescription featuredImage ogImage canonicalUrl publishedAt updatedAt category author';
  if (bodyContentDepth === 'full') return `${base} content`;
  return base;
};

export const fetchFeedArticles = async ({ limit = 30, categorySlug = null } = {}) => {
  const filter = buildPublishedArticleFilter();

  if (categorySlug) {
    const category = await Category.findOne({ slug: categorySlug, status: 'active' }).select('_id name slug').lean();
    if (!category) return { articles: [], category: null };
    filter.category = category._id;
    const settings = await getRssSettings();
    const articles = await Article.find(filter)
      .select(selectFields(settings.bodyContentDepth))
      .populate('category', 'name slug')
      .populate('author', 'name')
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
    return { articles, category };
  }

  const settings = await getRssSettings();
  const articles = await Article.find(filter)
    .select(selectFields(settings.bodyContentDepth))
    .populate('category', 'name slug')
    .populate('author', 'name')
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean();

  return { articles, category: null };
};

const buildItemXml = async (article, { baseUrl, articlePath, bodyContentDepth, googleNews = false }) => {
  const link = buildArticleUrl(article, baseUrl, articlePath);
  const title = escapeXml(article.title);
  const pubDate = article.publishedAt ? new Date(article.publishedAt).toUTCString() : new Date().toUTCString();
  const authorName = escapeXml(article.author?.name || 'Editorial Board');
  const categoryName = escapeXml(article.category?.name || 'News');
  const description = getDescription(article);
  const imageUrl = getFeaturedImageUrl(article, baseUrl);

  let item = '';
  item += '<item>\n';
  item += `<title>${title}</title>\n`;
  item += `<link>${escapeXml(link)}</link>\n`;
  item += `<guid isPermaLink="true">${escapeXml(link)}</guid>\n`;
  item += `<pubDate>${pubDate}</pubDate>\n`;
  item += `<dc:creator>${authorName}</dc:creator>\n`;
  if (googleNews && article.category?.name) {
    item += `<category domain="${escapeXml(baseUrl)}">${categoryName}</category>\n`;
  } else {
    item += `<category>${categoryName}</category>\n`;
  }

  if (bodyContentDepth !== 'none' && description) {
    item += `<description>${wrapCdata(description)}</description>\n`;
  }

  if (imageUrl) {
    const mime = guessImageMime(imageUrl);
    const length = await getImageByteLength(imageUrl);
    item += `<enclosure url="${escapeXml(imageUrl)}" length="${length}" type="${mime}" />\n`;
    item += `<media:content url="${escapeXml(imageUrl)}" medium="image">\n`;
    item += `<media:title type="plain">${title}</media:title>\n`;
    item += `</media:content>\n`;
  }

  if (bodyContentDepth === 'full' && article.content) {
    item += `<content:encoded>${wrapCdata(article.content)}</content:encoded>\n`;
  }

  item += '</item>\n';
  return item;
};

export const generateRssXml = async ({
  feedPath = '/feed.xml',
  categorySlug = null,
  googleNews = false,
  channelTitleOverride = null,
  channelDescriptionOverride = null,
} = {}) => {
  const settings = await getRssSettings();
  const limit = settings.feedLimit;
  const { articles, category } = await fetchFeedArticles({ limit, categorySlug });

  const channelTitle =
    channelTitleOverride ||
    (category ? `${category.name} — ${settings.channelTitle}` : settings.channelTitle);
  const channelDescription =
    channelDescriptionOverride ||
    (category
      ? `Latest ${category.name} news from ${settings.channelTitle}`
      : settings.channelDescription);

  const selfHref = `${settings.baseUrl}${feedPath}`;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0"\n';
  xml += '  xmlns:content="http://purl.org/rss/1.0/modules/content/"\n';
  xml += '  xmlns:dc="http://purl.org/dc/elements/1.1/"\n';
  xml += '  xmlns:atom="http://www.w3.org/2005/Atom"\n';
  xml += '  xmlns:media="http://search.yahoo.com/mrss/">\n';
  xml += '<channel>\n';
  xml += `<title>${escapeXml(channelTitle)}</title>\n`;
  xml += `<link>${escapeXml(settings.baseUrl)}</link>\n`;
  xml += `<description>${escapeXml(channelDescription)}</description>\n`;
  xml += `<language>${escapeXml(settings.language)}</language>\n`;
  xml += `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;
  xml += `<atom:link href="${escapeXml(selfHref)}" rel="self" type="application/rss+xml" />\n`;

  for (const article of articles) {
    xml += await buildItemXml(article, {
      baseUrl: settings.baseUrl,
      articlePath: settings.articlePath,
      bodyContentDepth: settings.bodyContentDepth,
      googleNews,
    });
  }

  xml += '</channel>\n</rss>';
  return xml;
};

const getCachedOrGenerate = async (cacheKey, generator) => {
  const settings = await getRssSettings();
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) return hit.xml;

  const xml = await generator();
  cache.set(cacheKey, { xml, expiresAt: now + settings.cacheSeconds * 1000 });
  return xml;
};

export const serveMainFeed = () => getCachedOrGenerate('main', () => generateRssXml({ feedPath: '/feed.xml' }));

export const serveGoogleNewsFeed = () =>
  getCachedOrGenerate('google-news', () =>
    generateRssXml({ feedPath: '/feed/google-news.xml', googleNews: true })
  );

export const serveCategoryFeed = async (categorySlug) => {
  const category = await Category.findOne({ slug: categorySlug, status: 'active' }).select('_id').lean();
  if (!category) return null;
  return getCachedOrGenerate(`category:${categorySlug}`, () =>
    generateRssXml({
      feedPath: `/feed/category/${categorySlug}.xml`,
      categorySlug,
    })
  );
};

export default {
  invalidateRssCache,
  getRssSettings,
  generateRssXml,
  serveMainFeed,
  serveGoogleNewsFeed,
  serveCategoryFeed,
  buildArticleUrl,
  fetchFeedArticles,
};
