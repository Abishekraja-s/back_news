import Article from '../models/Article.js';
import GoogleNewsItem from '../models/GoogleNewsItem.js';
import { ARTICLE_STATUS } from '../config/constants.js';
import { getArticlePublicUrl } from '../utils/articleUrls.js';

const SITE_NAME = 'The Great India News';
const FALLBACK_TITLE = 'The Great India News - தி கிரேட் இந்தியா நியூஸ்';
const FALLBACK_DESCRIPTION = 'Latest Tamil news from Tamil Nadu, India and World.';

const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripHtml = (s = '') =>
  String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getSiteUrl = () =>
  (process.env.CLIENT_URL || 'https://thegreatindianews.netlify.app')
    .split(',')[0]
    .trim()
    .replace(/\/$/, '');

const getApiPublicUrl = (req) => {
  const fromEnv = (
    process.env.PUBLIC_API_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'https://news-backend-pxp9-a6j6.onrender.com'
  ).replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  // Never emit localhost image URLs for social crawlers
  if (!host || /localhost|127\.0\.0\.1/i.test(host)) {
    return 'https://news-backend-pxp9-a6j6.onrender.com';
  }
  return `${proto}://${host}`.replace(/^http:/i, 'https:');
};

const toBase64Url = (s) =>
  Buffer.from(String(s), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

/** Absolute HTTPS image URL for WhatsApp / Facebook / Telegram crawlers */
export const toAbsoluteImageUrl = (image, req, seed = 'news') => {
  const site = getSiteUrl();
  const fallback = `${site}/assets/images/default-og-image.jpg`;
  if (!image || !String(image).trim()) return fallback;
  let img = String(image).trim();
  if (/^http:\/\//i.test(img)) img = img.replace(/^http:/i, 'https:');
  if (/^https:\/\/(localhost|127\.0\.0\.1)/i.test(img)) {
    const path = img.replace(/^https?:\/\/[^/]+/i, '');
    img = `${getApiPublicUrl(req)}${path}`;
  } else if (!/^https:\/\//i.test(img)) {
    const api = getApiPublicUrl(req);
    img = img.startsWith('/') ? `${api}${img}` : `${api}/${img}`;
  }
  if (!img.startsWith('https://')) return fallback;
  // Same-origin path proxy (no ?query) — WhatsApp can fetch picsum/CDN via our domain
  if (img.startsWith(site)) return img;
  if (img.includes('onrender.com') && !/picsum\.photos/i.test(img)) return img;
  return `${site}/og/img/${toBase64Url(img)}.jpg`;
};

const BOT_RE =
  /whatsapp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|bot|crawler|spider|preview/i;

const renderShareHtml = ({ title, description, image, pageUrl, siteName, shareUrl }, { redirect = true } = {}) => {
  const t = escapeHtml(title || FALLBACK_TITLE);
  const d = escapeHtml((description || FALLBACK_DESCRIPTION).slice(0, 200));
  const img = escapeHtml(image);
  const article = escapeHtml(pageUrl);
  const ogUrl = escapeHtml(shareUrl || pageUrl);
  const site = escapeHtml(siteName || SITE_NAME);
  const redirectBits = redirect
    ? `
  <meta http-equiv="refresh" content="1;url=${article}" />
  <script>setTimeout(function(){location.replace(${JSON.stringify(pageUrl)});},800);</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="ta">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${t} | ${site}</title>
  <link rel="canonical" href="${article}" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${site}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:url" content="${ogUrl}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:secure_url" content="${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${t}" />
  <meta property="og:locale" content="ta_IN" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
${redirectBits}
</head>
<body>
  <h1>${t}</h1>
  <p>${d}</p>
  <img src="${img}" alt="${t}" width="1200" height="630" />
  <p><a href="${article}">Continue to article →</a></p>
</body>
</html>`;
};

const resolveShareMeta = async (slug, req) => {
  const article = await Article.findOne({
    slug,
    status: ARTICLE_STATUS.PUBLISHED,
  })
    .select(
      'title excerpt content featuredImage ogImage ogTitle ogDescription metaDescription slug canonicalUrl category'
    )
    .populate({ path: 'category', select: 'slug' })
    .lean();

  if (article) {
    const title = article.ogTitle || article.title || FALLBACK_TITLE;
    const description =
      article.ogDescription ||
      article.metaDescription ||
      article.excerpt ||
      stripHtml(article.content).slice(0, 180) ||
      FALLBACK_DESCRIPTION;
    // Always use our site article URL for social previews (not external source canonical)
    const pageUrl = getArticlePublicUrl(article, getSiteUrl());
    return {
      title,
      description,
      image: toAbsoluteImageUrl(article.ogImage || article.featuredImage, req, article.slug),
      slug: article.slug,
      url: pageUrl,
    };
  }

  const gNews = await GoogleNewsItem.findOne({ slug, status: 'published' })
    .select('title description excerpt content image slug')
    .lean();

  if (!gNews) return null;

  return {
    title: gNews.title || FALLBACK_TITLE,
    description:
      gNews.excerpt ||
      gNews.description ||
      stripHtml(gNews.content || '').slice(0, 180) ||
      FALLBACK_DESCRIPTION,
    image: toAbsoluteImageUrl(gNews.image, req, gNews.slug || slug),
    slug: gNews.slug || slug,
    url: `${getSiteUrl()}/news/${gNews.slug || slug}`,
  };
};

/** GET /share/news/:slug — crawler HTML with full OG + Twitter tags */
export const shareNewsArticle = async (req, res, next) => {
  try {
    const meta = await resolveShareMeta(req.params.slug, req);
    if (!meta) {
      return res
        .status(404)
        .type('html')
        .send('<!DOCTYPE html><title>Not found</title><h1>Article not found</h1>');
    }

    const ua = req.get('user-agent') || '';
    const isBot = BOT_RE.test(ua);
    const site = getSiteUrl();
    const shareUrl = `${site}/og/news/${encodeURIComponent(meta.slug)}`;

    res
      .status(200)
      .type('html')
      .set('Cache-Control', 'public, max-age=60, must-revalidate')
      .send(
        renderShareHtml(
          {
            title: meta.title,
            description: meta.description,
            image: meta.image,
            pageUrl: meta.url,
            shareUrl,
            siteName: SITE_NAME,
          },
          // Instant redirect breaks WhatsApp — never redirect crawlers
          { redirect: !isBot }
        )
      );
  } catch (error) {
    next(error);
  }
};

/** GET /api/share/news/:slug/meta — JSON for edge / debugging */
export const shareNewsMeta = async (req, res, next) => {
  try {
    const meta = await resolveShareMeta(req.params.slug, req);
    if (!meta) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }
    res.json({
      success: true,
      data: {
        title: meta.title,
        description: meta.description,
        image: meta.image,
        url: meta.url,
        siteName: SITE_NAME,
        og: {
          'og:title': meta.title,
          'og:description': meta.description,
          'og:image': meta.image,
          'og:url': meta.url,
          'og:type': 'article',
          'og:site_name': SITE_NAME,
        },
        twitter: {
          'twitter:card': 'summary_large_image',
          'twitter:title': meta.title,
          'twitter:description': meta.description,
          'twitter:image': meta.image,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
