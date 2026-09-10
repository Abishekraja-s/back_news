import express from 'express';
import { getSitemap, getNewsSitemap, getRobots } from '../controllers/seoController.js';
import { getFeedXml, getRssXml, getGoogleNewsFeedXml, getCategoryFeedXml } from '../controllers/rssController.js';

const router = express.Router();

router.get('/sitemap.xml', getSitemap);
router.get('/news-sitemap.xml', getNewsSitemap);
router.get('/robots.txt', getRobots);

router.get('/feed.xml', getFeedXml);
router.get('/rss.xml', getRssXml);
router.get('/feed/google-news.xml', getGoogleNewsFeedXml);
router.get('/feed/category/:slug.xml', getCategoryFeedXml);

export default router;
