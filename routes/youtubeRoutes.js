import express from 'express';
import {
  getPublicSlider,
  getAdminOverview,
  updateChannelSettings,
  syncNow,
  listVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  reorderVideos,
} from '../controllers/youtubeController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

router.get('/public', getPublicSlider);

router.get('/admin', protect, authorize(...managers), getAdminOverview);
router.put('/channel', protect, authorize(...managers), updateChannelSettings);
router.post('/sync', protect, authorize(...managers), syncNow);

router.get('/videos', protect, authorize(...managers), listVideos);
router.post('/videos', protect, authorize(...managers), createVideo);
router.put('/videos/reorder', protect, authorize(...managers), reorderVideos);
router.put('/videos/:id', protect, authorize(...managers), updateVideo);
router.delete('/videos/:id', protect, authorize(...managers), deleteVideo);

export default router;
