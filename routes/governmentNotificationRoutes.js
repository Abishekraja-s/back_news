import express from 'express';
import {
  getConfig,
  updateConfig,
  fetchNow,
  getNotifications,
  updateNotification,
  bulkStatus,
  bulkDelete,
  deleteByDate,
  deleteNotification,
  publishAll,
  getPublic,
  getPublicList,
  getHub,
} from '../controllers/governmentNotificationController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

router.get('/public', getPublic);
router.get('/public/hub', getHub);
router.get('/public/list', getPublicList);

router.get('/config', protect, authorize(...managers), getConfig);
router.put('/config', protect, authorize(...managers), updateConfig);
router.post('/fetch', protect, authorize(...managers), fetchNow);

router.get('/notifications', protect, authorize(...managers), getNotifications);
router.put('/notifications/bulk-status', protect, authorize(...managers), bulkStatus);
router.post('/notifications/bulk-delete', protect, authorize(...managers), bulkDelete);
router.post('/notifications/delete-by-date', protect, authorize(...managers), deleteByDate);
router.post('/notifications/publish-all', protect, authorize(...managers), publishAll);
router.put('/notifications/:id', protect, authorize(...managers), updateNotification);
router.delete('/notifications/:id', protect, authorize(...managers), deleteNotification);

export default router;
