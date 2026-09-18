import express from 'express';
import {
  listSources,
  createSource,
  updateSource,
  deleteSource,
  fetchNow,
  listRssArticles,
  publishRssArticle,
  bulkPublishRssArticles,
  bulkDeleteRssArticles,
  deleteRssArticlesByDate,
  deleteRssArticle,
} from '../controllers/rssIngestController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const editors = [ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.REPORTER];

router.use(protect, authorize(...editors));

router.get('/sources', listSources);
router.post('/sources', createSource);
router.put('/sources/:id', updateSource);
router.delete('/sources/:id', deleteSource);

router.post('/fetch', fetchNow);

router.get('/articles', listRssArticles);
router.post('/articles/bulk-publish', bulkPublishRssArticles);
router.post('/articles/bulk-delete', bulkDeleteRssArticles);
router.post('/articles/delete-by-date', deleteRssArticlesByDate);
router.post('/articles/:id/publish', publishRssArticle);
router.delete('/articles/:id', deleteRssArticle);

export default router;
