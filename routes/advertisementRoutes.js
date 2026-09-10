import express from 'express';
import {
  getAdsByPosition,
  getAllAds,
  createAd,
  updateAd,
  deleteAd,
} from '../controllers/advertisementController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const adManagers = [ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.AD_MANAGER];

router.get('/position/:position', getAdsByPosition);
router.get('/', protect, authorize(...adManagers), getAllAds);
router.post('/', protect, authorize(...adManagers), createAd);
router.put('/:id', protect, authorize(...adManagers), updateAd);
router.delete('/:id', protect, authorize(...adManagers), deleteAd);

export default router;
