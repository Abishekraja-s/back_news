import express from 'express';
import {
  getConfigStatus,
  updateConfig,
  fetchPreview,
  getPublicPosts,
  getAdminPosts,
  createPost,
  updatePost,
  deletePost,
  reorderPosts,
  syncPost,
  syncAll,
} from '../controllers/instagramPostController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

router.get('/public', getPublicPosts);

router.get('/config', protect, authorize(...managers), getConfigStatus);
router.put('/config', protect, authorize(ROLES.SUPER_ADMIN), updateConfig);

router.post('/fetch', protect, authorize(...managers), fetchPreview);
router.post('/sync-all', protect, authorize(...managers), syncAll);
router.put('/reorder', protect, authorize(...managers), reorderPosts);

router.get('/', protect, authorize(...managers), getAdminPosts);
router.post('/', protect, authorize(...managers), createPost);
router.put('/:id/sync', protect, authorize(...managers), syncPost);
router.put('/:id', protect, authorize(...managers), updatePost);
router.delete('/:id', protect, authorize(...managers), deletePost);

export default router;
