import express from 'express';
import {
  getPublicAboutPage,
  getPublicLegalPage,
  getPublicMarketplaceDisclaimer,
  getAdminPages,
  getAdminPageBySlug,
  upsertAboutPage,
  upsertLegalPage,
  upsertMarketplaceDisclaimerPage,
} from '../controllers/pageContentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

router.get('/public/about', getPublicAboutPage);
router.get('/public/marketplace-disclaimer', getPublicMarketplaceDisclaimer);
router.get('/public/:slug', getPublicLegalPage);

router.get('/', protect, authorize(...managers), getAdminPages);
router.put('/about', protect, authorize(...managers), upsertAboutPage);
router.put('/marketplace-disclaimer', protect, authorize(...managers), upsertMarketplaceDisclaimerPage);
router.put('/legal/:slug', protect, authorize(...managers), upsertLegalPage);
router.get('/:slug', protect, authorize(...managers), getAdminPageBySlug);

export default router;
