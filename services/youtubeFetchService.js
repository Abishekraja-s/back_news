/**
 * Resolve YouTube channel IDs and fetch latest videos via Atom RSS
 * (no API key required). Optional YOUTUBE_API_KEY improves @handle resolve.
 */

const CHANNEL_ID_RE = /^UC[\w-]{20,}$/;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const fetchHeaders = {
  'User-Agent': BROWSER_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9,ta;q=0.8',
  'Cache-Control': 'no-cache',
};

export const extractVideoId = (urlOrId = '') => {
  const s = String(urlOrId).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/|youtube-nocookie\.com\/embed\/)([\w-]{11})/,
    /[?&]v=([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return '';
};

export const buildWatchUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;

export const thumbnailFor = (videoId) =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

const extractHandle = (url = '') => {
  const m = String(url).match(/youtube\.com\/@([\w.-]+)/i);
  return m ? m[1] : '';
};

/** YouTube Data API v3 — forHandle (needs YOUTUBE_API_KEY) */
const resolveViaApi = async (handle) => {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key || !handle) return null;
  try {
    const apiUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
    apiUrl.searchParams.set('part', 'id,snippet');
    apiUrl.searchParams.set('forHandle', handle.replace(/^@/, ''));
    apiUrl.searchParams.set('key', key);
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const data = await res.json();
    const id = data?.items?.[0]?.id;
    if (CHANNEL_ID_RE.test(id)) {
      return {
        channelId: id,
        channelHandle: `@${handle.replace(/^@/, '')}`,
        resolvedFrom: 'api',
      };
    }
  } catch (err) {
    console.warn('[YouTube] API resolve failed:', err.message);
  }
  return null;
};

const parseChannelIdFromHtml = (html = '') => {
  const idMatchers = [
    /"channelId":"(UC[\w-]{20,})"/,
    /"browseId":"(UC[\w-]{20,})"/,
    /"externalId":"(UC[\w-]{20,})"/,
    /channel_id=(UC[\w-]{20,})/,
    /youtube\.com\/channel\/(UC[\w-]{20,})/,
    /\/channel\/(UC[\w-]{20,})/,
  ];
  for (const re of idMatchers) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return '';
};

/**
 * Parse channel URL / @handle / UC id into a channelId when possible.
 */
export const resolveChannelId = async (channelUrl = '') => {
  const input = String(channelUrl).trim();
  if (!input) {
    const err = new Error('Channel URL is required');
    err.statusCode = 400;
    throw err;
  }

  if (CHANNEL_ID_RE.test(input)) {
    return { channelId: input, channelHandle: '', resolvedFrom: 'id' };
  }

  let url = input;
  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith('@')) url = `https://www.youtube.com/${url}`;
    else if (url.includes('youtube.com') || url.includes('youtu.be')) url = `https://${url.replace(/^\/\//, '')}`;
    else url = `https://www.youtube.com/@${url.replace(/^@/, '')}`;
  }

  const channelMatch = url.match(/youtube\.com\/channel\/(UC[\w-]{20,})/i);
  if (channelMatch) {
    return { channelId: channelMatch[1], channelHandle: '', resolvedFrom: 'url' };
  }

  const handle = extractHandle(url) || input.replace(/^@/, '').split('/')[0];

  // Prefer Data API when key is set (most reliable for @handles)
  const viaApi = await resolveViaApi(handle);
  if (viaApi) return viaApi;

  // Scrape channel / videos page HTML
  const candidates = [
    url,
    handle ? `https://www.youtube.com/@${handle}` : '',
    handle ? `https://www.youtube.com/@${handle}/videos` : '',
    handle ? `https://www.youtube.com/@${handle}/about` : '',
  ].filter(Boolean);

  let lastStatus = 0;
  for (const pageUrl of [...new Set(candidates)]) {
    try {
      const res = await fetch(pageUrl, {
        headers: fetchHeaders,
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
      lastStatus = res.status;
      if (!res.ok) continue;
      const html = await res.text();
      const channelId = parseChannelIdFromHtml(html);
      if (channelId) {
        return {
          channelId,
          channelHandle: handle ? `@${handle}` : '',
          resolvedFrom: 'page',
        };
      }
    } catch (err) {
      console.warn('[YouTube] page resolve failed:', pageUrl, err.message);
    }
  }

  const err = new Error(
    lastStatus
      ? `Could not resolve channel ID (HTTP ${lastStatus}). Use https://www.youtube.com/channel/UCxxxx or set YOUTUBE_API_KEY.`
      : 'Could not resolve channel ID. Use a URL like https://www.youtube.com/@handle or https://www.youtube.com/channel/UCxxxx'
  );
  err.statusCode = 400;
  throw err;
};

const decodeXml = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeXml(m[1]) : '';
};

const attr = (block, name, attrName) => {
  const m = block.match(new RegExp(`<${name}[^>]*${attrName}=["']([^"']+)["']`, 'i'));
  return m ? m[1] : '';
};

/**
 * Fetch latest videos from YouTube Atom feed (max ~15 typically).
 */
export const fetchChannelVideos = async (channelId, max = 15) => {
  if (!CHANNEL_ID_RE.test(channelId)) {
    const err = new Error('Invalid channel ID');
    err.statusCode = 400;
    throw err;
  }

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(feedUrl, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'application/atom+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = new Error(`YouTube RSS fetch failed (${res.status}). Channel may be invalid or unavailable.`);
    err.statusCode = 502;
    throw err;
  }

  const xml = await res.text();
  const feedTitle = tag(xml, 'title') || '';
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];

  const videos = entries
    .slice(0, max)
    .map((entry, index) => {
      const fromYt = tag(entry, 'yt:videoId');
      const fromId = (tag(entry, 'id').match(/video:([\w-]{11})/) || [])[1] || '';
      const fromLink = (attr(entry, 'link', 'href').match(/[?&]v=([\w-]{11})/) || [])[1] || '';
      const id = fromYt || fromId || fromLink;
      const title = tag(entry, 'title') || 'Untitled';
      const description = tag(entry, 'media:description') || tag(entry, 'summary') || '';
      const publishedAt = tag(entry, 'published') || tag(entry, 'updated') || null;
      const thumb = attr(entry, 'media:thumbnail', 'url') || (id ? thumbnailFor(id) : '');
      const author = tag(entry, 'name') || '';

      return {
        videoId: id,
        title,
        description: description.slice(0, 2000),
        thumbnail: thumb,
        youtubeUrl: id ? buildWatchUrl(id) : '',
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        feedIndex: index,
        metadata: {
          author,
          raw: { source: 'youtube_rss' },
        },
      };
    })
    .filter((v) => v.videoId);

  return { channelTitle: feedTitle.replace(/ - YouTube$/i, ''), videos, feedUrl };
};
