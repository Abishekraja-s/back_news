import express from 'express';
import {
  getArticles,
  getArticleBySlug,
  getArticleById,
  getLatest,
  getFeatured,
  getMustWatch,
  getPopular,
  getByCategory,
  getByDistrict,
  searchArticles,
  getRelated,
  createArticle,
  updateArticle,
  deleteArticle,
  addLiveUpdate,
  getDashboardStats,
} from '../controllers/articleController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const editors = [ROLES.SUPER_ADMIN, ROLES.EDITOR];
const writers = [ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.REPORTER, ROLES.AUTHOR];

router.get('/latest', getLatest);
router.get('/featured', getFeatured);
router.get('/must-watch', getMustWatch);
router.get('/popular', getPopular);
router.get('/search', searchArticles);
router.get('/category/:slug', getByCategory);
router.get('/district/:district', getByDistrict);
router.get('/dashboard/stats', protect, authorize(...editors), getDashboardStats);
router.get('/:slug/related', getRelated);
router.get('/slug/:slug', getArticleBySlug);

router.get('/', protect, authorize(...writers), getArticles);
router.get('/:id', protect, authorize(...writers), getArticleById);
router.post('/', protect, authorize(...writers), createArticle);
router.put('/:id', protect, authorize(...writers), updateArticle);
router.delete('/:id', protect, authorize(...writers), deleteArticle);
router.post('/:id/live-updates', protect, authorize(...editors), addLiveUpdate);

export default router;
