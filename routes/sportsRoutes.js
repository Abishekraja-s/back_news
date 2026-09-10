import express from 'express';
import {
  getConfig,
  updateConfig,
  fetchNow,
  getStatus,
  getMatches,
  updateMatch,
  deleteMatch,
  getStandings,
  deleteStanding,
  getPublicWidgets,
  getPublicList,
  getPublicMatchDetail,
  getPublicMatchPlayer,
} from '../controllers/sportsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

router.get('/public', getPublicWidgets);
router.get('/public/list', getPublicList);
router.get('/public/matches/:id', getPublicMatchDetail);
router.get('/public/matches/:id/players/:playerKey', getPublicMatchPlayer);

router.get('/config', protect, authorize(...managers), getConfig);
router.get('/status', protect, authorize(...managers), getStatus);
router.put('/config', protect, authorize(...managers), updateConfig);
router.post('/fetch', protect, authorize(...managers), fetchNow);

router.get('/matches', protect, authorize(...managers), getMatches);
router.put('/matches/:id', protect, authorize(...managers), updateMatch);
router.delete('/matches/:id', protect, authorize(...managers), deleteMatch);

router.get('/standings', protect, authorize(...managers), getStandings);
router.delete('/standings/:id', protect, authorize(...managers), deleteStanding);

export default router;
