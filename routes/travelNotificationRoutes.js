import express from 'express';
import {
  getConfig,
  updateConfig,
  fetchNow,
  getUpdates,
  updateItem,
  deleteItem,
  getPublicUpdates,
  getPublicList,
  getStatus,
  getFetchLogs,
} from '../controllers/travelNotificationController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

router.get('/public', getPublicUpdates);
router.get('/public/list', getPublicList);

router.get('/config', protect, authorize(...managers), getConfig);
router.get('/status', protect, authorize(...managers), getStatus);
router.get('/fetch-logs', protect, authorize(...managers), getFetchLogs);
router.put('/config', protect, authorize(...managers), updateConfig);
router.post('/fetch', protect, authorize(...managers), fetchNow);

router.get('/updates', protect, authorize(...managers), getUpdates);
router.put('/updates/:id', protect, authorize(...managers), updateItem);
router.delete('/updates/:id', protect, authorize(...managers), deleteItem);

export default router;
