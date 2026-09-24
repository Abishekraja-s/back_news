import express from 'express';
import {
  getAdminDashboard,
  getAdminConfig,
  updateAdminConfig,
  testConnection,
  syncNow,
  getSyncLogs,
  getSyncLogById,
  getAdminHoroscopes,
  getAdminHoroscopeById,
  updateAdminHoroscope,
  getAdminPanchang,
  getPublicToday,
  getPublicRasi,
  getPublicRasiList,
} from '../controllers/astrologyController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

// Public (no login)
router.get('/public/today', getPublicToday);
router.get('/public/rasis', getPublicRasiList);
router.get('/public/rasi/:slug', getPublicRasi);

// Admin
router.get('/admin/dashboard', protect, authorize(...managers), getAdminDashboard);
router.get('/admin/config', protect, authorize(...managers), getAdminConfig);
router.put('/admin/config', protect, authorize(...managers), updateAdminConfig);
router.post('/admin/test-connection', protect, authorize(...managers), testConnection);
router.post('/admin/sync', protect, authorize(...managers), syncNow);
router.get('/admin/sync-logs', protect, authorize(...managers), getSyncLogs);
router.get('/admin/sync-logs/:id', protect, authorize(...managers), getSyncLogById);
router.get('/admin/horoscopes', protect, authorize(...managers), getAdminHoroscopes);
router.get('/admin/horoscopes/:id', protect, authorize(...managers), getAdminHoroscopeById);
router.put('/admin/horoscopes/:id', protect, authorize(...managers), updateAdminHoroscope);
router.get('/admin/panchang', protect, authorize(...managers), getAdminPanchang);

export default router;
