import express from 'express';
import {
  getConfig,
  updateConfig,
  fetchNow,
  getAdminItems,
  getAdminFilterOptions,
  createItem,
  getItemById,
  updateItem,
  bulkUpdateStatus,
  deleteItem,
  getPublicItems,
  getPublicList,
  getPublicBySlug,
  getRelatedPublic,
  enrichExistingItems,
} from '../controllers/googleNewsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

router.get('/public', getPublicItems);
router.get('/public/list', getPublicList);
router.get('/public/slug/:slug/related', getRelatedPublic);
router.get('/public/slug/:slug', getPublicBySlug);

router.get('/config', protect, authorize(...managers), getConfig);
router.put('/config', protect, authorize(...managers), updateConfig);
router.post('/fetch', protect, authorize(...managers), fetchNow);
router.post('/enrich', protect, authorize(...managers), enrichExistingItems);

router.get('/filters', protect, authorize(...managers), getAdminFilterOptions);
router.get('/items', protect, authorize(...managers), getAdminItems);
router.post('/items', protect, authorize(...managers), createItem);
router.put('/items/bulk-status', protect, authorize(...managers), bulkUpdateStatus);
router.get('/items/:id', protect, authorize(...managers), getItemById);
router.put('/items/:id', protect, authorize(...managers), updateItem);
router.delete('/items/:id', protect, authorize(...managers), deleteItem);

export default router;
