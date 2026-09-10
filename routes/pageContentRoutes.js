import express from 'express';
import {
  getPublicAboutPage,
  getAdminPages,
  getAdminPageBySlug,
  upsertAboutPage,
} from '../controllers/pageContentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

router.get('/public/about', getPublicAboutPage);

router.get('/', protect, authorize(...managers), getAdminPages);
router.get('/:slug', protect, authorize(...managers), getAdminPageBySlug);
router.put('/about', protect, authorize(...managers), upsertAboutPage);

export default router;
