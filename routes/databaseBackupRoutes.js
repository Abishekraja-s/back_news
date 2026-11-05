import express from 'express';
import {
  getBackupStats,
  createBackupJob,
  getBackupJob,
  downloadBackupJobFile,
} from '../controllers/databaseBackupController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.get('/stats', protect, authorize(ROLES.SUPER_ADMIN), getBackupStats);
router.post('/jobs', protect, authorize(ROLES.SUPER_ADMIN), createBackupJob);
router.get('/jobs/:jobId', protect, authorize(ROLES.SUPER_ADMIN), getBackupJob);

// Token in query allows native browser download (no Authorization header needed)
router.get('/jobs/:jobId/file', optionalAuth, downloadBackupJobFile);

export default router;
