/**
 * Official Meta / Instagram integrations only (oEmbed + Graph API).
 * No HTML scraping of instagram.com pages.
 */
import Setting from '../models/Setting.js';

const TOKEN_KEY = 'instagramAccessToken';
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const maskToken = (token = '') => {
  if (!token || token.length < 8) return token ? '••••••••' : '';
  return `••••••••${token.slice(-4)}`;
};

export const resolveInstagramAccessToken = async () => {
  const fromEnv = (process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || '').trim();
  if (fromEnv) return { token: fromEnv, source: 'env' };

  const appId = (process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '').trim();
  const appSecret = (process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '').trim();
  if (appId && appSecret) {
    return { token: `${appId}|${appSecret}`, source: 'app' };
  }

  const row = await Setting.findOne({ key: TOKEN_KEY }).lean();
  const fromDb = typeof row?.value === 'string' ? row.value.trim() : '';
  if (fromDb) return { token: fromDb, source: 'database' };

  return { token: '', source: 'none' };
};

export const saveInstagramAccessToken = async (token) => {
  const value = String(token || '').trim();
  if (!value) {
    await Setting.deleteOne({ key: TOKEN_KEY });
    return { cleared: true };
  }
  await Setting.findOneAndUpdate(
    { key: TOKEN_KEY },
    { key: TOKEN_KEY, value, group: 'secrets' },
    { upsert: true, new: true }
  );
  return { cleared: false, masked: maskToken(value) };
};

/**
 * Extract shortcode from Instagram post / reel / TV URLs.
 */
export const parseInstagramUrl = (input = '') => {
  const raw = String(input).trim();
  if (!raw) {
    const err = new Error('Instagram post URL is required');
    err.statusCode = 400;
    err.code = 'INVALID_URL';
    throw err;
  }

  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    const err = new Error('Invalid Instagram URL');
    err.statusCode = 400;
    err.code = 'INVALID_URL';
    throw err;
  }

  if (!/(^|\.)instagram\.com$/i.test(url.hostname)) {
    const err = new Error('URL must be an instagram.com post link');
    err.statusCode = 400;
    err.code = 'INVALID_URL';
    throw err;
  }

  const match = url.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (!match) {
    const err = new Error('Could not find post ID. Use a link like https://www.instagram.com/p/POST_ID/');
    err.statusCode = 400;
    err.code = 'INVALID_URL';
    throw err;
  }

  const kind = match[1].toLowerCase();
  const shortcode = match[2];
  const pathKind = kind === 'reels' ? 'reel' : kind;
  const canonicalUrl = `https://www.instagram.com/${pathKind}/${shortcode}/`;

  return {
    shortcode,
    kind: pathKind,
    canonicalUrl,
    mediaTypeHint: pathKind === 'reel' || pathKind === 'tv' ? 'REEL' : 'UNKNOWN',
  };
};

const mapOEmbedError = (status, payload) => {
  const msg = payload?.error?.message || payload?.error?.error_user_msg || '';
  if (status === 401 || status === 403 || /access token|OAuthException|expired/i.test(msg)) {
    const err = new Error(
      msg || 'Instagram access token is missing, expired, or lacks oEmbed permission. Configure a Meta App token.'
    );
    err.statusCode = 401;
    err.code = 'TOKEN_ERROR';
    return err;
  }
  if (status === 404 || /cannot be found|not found|private/i.test(msg)) {
    const err = new Error(
      msg || 'Post not found, deleted, or from a private account that is not accessible via the API.'
    );
    err.statusCode = 404;
    err.code = 'UNAVAILABLE';
    return err;
  }
  const err = new Error(msg || `Instagram API error (${status})`);
  err.statusCode = status >= 400 && status < 600 ? status : 502;
  err.code = 'API_ERROR';
  return err;
};

/**
 * Official Instagram oEmbed via Meta Graph API.
 * @see https://developers.facebook.com/docs/instagram/oembed
 */
export const fetchInstagramOEmbed = async (postUrl, accessToken) => {
  if (!accessToken) {
    const err = new Error(
      'Instagram/Meta access token not configured. Set INSTAGRAM_ACCESS_TOKEN or META_APP_ID + META_APP_SECRET.'
    );
    err.statusCode = 400;
    err.code = 'TOKEN_MISSING';
    throw err;
  }

  const endpoint = new URL(`${GRAPH_BASE}/instagram_oembed`);
  endpoint.searchParams.set('url', postUrl);
  endpoint.searchParams.set('access_token', accessToken);
  endpoint.searchParams.set('omitscript', 'true');

  const res = await fetch(endpoint.toString(), {
    headers: { Accept: 'application/json' },
  });
  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw mapOEmbedError(res.status, payload);
  }

  return {
    title: payload.title || '',
    authorName: payload.author_name || '',
    authorUrl: payload.author_url || '',
    thumbnailUrl: payload.thumbnail_url || '',
    embedHtml: payload.html || '',
    providerName: payload.provider_name || 'Instagram',
    width: payload.width,
    height: payload.height,
    raw: payload,
  };
};

/**
 * Optional Graph enrichment for media owned by a connected IG Business account.
 * Uses INSTAGRAM_BUSINESS_ACCOUNT_ID to list recent media and match permalink.
 */
export const enrichFromBusinessAccount = async (canonicalUrl, accessToken) => {
  const igUserId = (process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '').trim();
  if (!igUserId || !accessToken) return null;

  try {
    const listUrl = new URL(`${GRAPH_BASE}/${igUserId}/media`);
    listUrl.searchParams.set(
      'fields',
      'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_url,media_type,thumbnail_url}'
    );
    listUrl.searchParams.set('limit', '50');
    listUrl.searchParams.set('access_token', accessToken);

    const res = await fetch(listUrl.toString());
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return null;

    const items = payload.data || [];
    const match = items.find(
      (m) =>
        m.permalink === canonicalUrl ||
        (m.permalink || '').replace(/\/$/, '') === canonicalUrl.replace(/\/$/, '')
    );
    if (!match) return null;

    const carouselImages = [];
    if (match.media_type === 'CAROUSEL_ALBUM' && match.children?.data) {
      for (const child of match.children.data) {
        const url = child.media_url || child.thumbnail_url;
        if (url) carouselImages.push(url);
      }
    } else if (match.media_url) {
      carouselImages.push(match.media_url);
    }

    return {
      graphMediaId: match.id,
      caption: match.caption || '',
      mediaType: match.media_type || 'UNKNOWN',
      mediaUrl: match.media_url || '',
      thumbnailUrl: match.thumbnail_url || match.media_url || '',
      publishedAt: match.timestamp ? new Date(match.timestamp) : null,
      carouselImages,
      raw: match,
    };
  } catch {
    return null;
  }
};

/**
 * Fetch post metadata for preview / import (official APIs only).
 */
export const fetchInstagramPostData = async (inputUrl) => {
  const parsed = parseInstagramUrl(inputUrl);
  const { token, source } = await resolveInstagramAccessToken();

  const oembed = await fetchInstagramOEmbed(parsed.canonicalUrl, token);
  const enriched = await enrichFromBusinessAccount(parsed.canonicalUrl, token);

  const mediaType =
    enriched?.mediaType ||
    parsed.mediaTypeHint ||
    (oembed.thumbnailUrl ? 'IMAGE' : 'UNKNOWN');

  const carouselImages =
    enriched?.carouselImages?.length > 0
      ? enriched.carouselImages
      : oembed.thumbnailUrl
        ? [oembed.thumbnailUrl]
        : [];

  const caption = enriched?.caption || oembed.title || '';
  const image = enriched?.thumbnailUrl || enriched?.mediaUrl || oembed.thumbnailUrl || carouselImages[0] || '';

  return {
    shortcode: parsed.shortcode,
    instagramUrl: parsed.canonicalUrl,
    title: caption.slice(0, 120) || `Instagram @${oembed.authorName || 'post'}`,
    description: caption,
    caption,
    image,
    thumbnailUrl: image,
    mediaUrl: enriched?.mediaUrl || image,
    mediaType,
    carouselImages,
    embedHtml: oembed.embedHtml,
    authorName: oembed.authorName,
    authorUrl: oembed.authorUrl,
    publishedAt: enriched?.publishedAt || null,
    graphMediaId: enriched?.graphMediaId || '',
    tokenSource: source,
    enrichment: Boolean(enriched),
    rawPayload: { oembed: oembed.raw, graph: enriched?.raw || null },
  };
};
