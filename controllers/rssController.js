import {
  getRssSettings,
  serveMainFeed,
  serveGoogleNewsFeed,
  serveCategoryFeed,
  generateRssXml,
} from '../services/rssFeedService.js';

const RSS_CONTENT_TYPE = 'application/rss+xml; charset=UTF-8';

const sendRssDisabled = (res) => {
  res.status(404).type('text/plain').send('Not Found');
};

const sendRssXml = (res, xml) => {
  res.status(200).type(RSS_CONTENT_TYPE).send(xml);
};

const handleRssRequest = async (res, generator) => {
  const settings = await getRssSettings();
  if (!settings.enabled) {
    sendRssDisabled(res);
    return;
  }
  const xml = await generator();
  sendRssXml(res, xml);
};

/** GET /feed.xml */
export const getFeedXml = async (req, res, next) => {
  try {
    await handleRssRequest(res, serveMainFeed);
  } catch (error) {
    next(error);
  }
};

/** GET /rss.xml — backward-compatible alias */
export const getRssXml = getFeedXml;

/** GET /feed/google-news.xml */
export const getGoogleNewsFeedXml = async (req, res, next) => {
  try {
    await handleRssRequest(res, serveGoogleNewsFeed);
  } catch (error) {
    next(error);
  }
};

/** GET /feed/category/:slug.xml */
export const getCategoryFeedXml = async (req, res, next) => {
  try {
    const settings = await getRssSettings();
    if (!settings.enabled) {
      sendRssDisabled(res);
      return;
    }

    const slug = String(req.params.slug || '')
      .trim()
      .toLowerCase()
      .replace(/\.xml$/i, '');

    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      res.status(404).type('text/plain').send('Not Found');
      return;
    }

    const xml = await serveCategoryFeed(slug);
    if (!xml) {
      res.status(404).type('text/plain').send('Not Found');
      return;
    }

    sendRssXml(res, xml);
  } catch (error) {
    next(error);
  }
};

/** Admin preview — real XML from DB */
export const getRssPreviewXml = async (req, res, next) => {
  try {
    const type = String(req.query.type || 'main').toLowerCase();
    const slug = String(req.query.slug || 'politics').toLowerCase();

    if (type === 'google-news') {
      const xml = await generateRssXml({ feedPath: '/feed/google-news.xml', googleNews: true });
      return res.json({ success: true, data: { xml, type } });
    }

    if (type === 'category') {
      const xml = await generateRssXml({
        feedPath: `/feed/category/${slug}.xml`,
        categorySlug: slug,
      });
      return res.json({ success: true, data: { xml, type, slug } });
    }

    const xml = await generateRssXml({ feedPath: '/feed.xml' });
    res.json({ success: true, data: { xml, type: 'main' } });
  } catch (error) {
    next(error);
  }
};
