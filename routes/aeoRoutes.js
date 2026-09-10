import express from 'express';
import {
  getConfig,
  updateConfig,
  getDashboard,
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  listEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  listPages,
  createPage,
  updatePage,
  deletePage,
  scorePreview,
  getSchemaPreview,
  getReport,
  getGeminiStatus,
  testGemini,
  generateWithGemini,
  applyGeminiToPage,
  applyGeminiToArticle,
  getGeminiUsage,
} from '../controllers/aeoController.js';
import { getRssPreviewXml } from '../controllers/rssController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];
const writers = [ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.REPORTER, ROLES.AUTHOR];

router.get('/dashboard', protect, authorize(...managers), getDashboard);
router.get('/config', protect, authorize(...managers), getConfig);
router.put('/config', protect, authorize(ROLES.SUPER_ADMIN), updateConfig);

router.get('/faqs', protect, authorize(...managers), listFaqs);
router.post('/faqs', protect, authorize(...managers), createFaq);
router.put('/faqs/:id', protect, authorize(...managers), updateFaq);
router.delete('/faqs/:id', protect, authorize(...managers), deleteFaq);

router.get('/entities', protect, authorize(...managers), listEntities);
router.post('/entities', protect, authorize(...managers), createEntity);
router.put('/entities/:id', protect, authorize(...managers), updateEntity);
router.delete('/entities/:id', protect, authorize(...managers), deleteEntity);

router.get('/pages', protect, authorize(...managers), listPages);
router.post('/pages', protect, authorize(...managers), createPage);
router.put('/pages/:id', protect, authorize(...managers), updatePage);
router.delete('/pages/:id', protect, authorize(...managers), deletePage);
router.post('/pages/score-preview', protect, authorize(...writers), scorePreview);

router.get('/schema/preview', protect, authorize(...managers), getSchemaPreview);
router.get('/rss/preview', protect, authorize(...managers), getRssPreviewXml);
router.get('/report', protect, authorize(...managers), getReport);

router.get('/gemini/status', protect, authorize(...writers), getGeminiStatus);
router.post('/gemini/test', protect, authorize(ROLES.SUPER_ADMIN), testGemini);
router.post('/gemini/generate', protect, authorize(...writers), generateWithGemini);
router.post('/gemini/apply-page', protect, authorize(...managers), applyGeminiToPage);
router.post('/gemini/apply-article', protect, authorize(...writers), applyGeminiToArticle);
router.get('/gemini/usage', protect, authorize(...managers), getGeminiUsage);

export default router;
