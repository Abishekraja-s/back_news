import express from 'express';
import {
  getMeta,
  getAllPlacements,
  getPlacementById,
  createPlacement,
  updatePlacement,
  deletePlacement,
  togglePlacement,
  getPublicPlacements,
} from '../controllers/adSenseController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.AD_MANAGER];

router.get('/public', getPublicPlacements);
router.get('/meta', protect, authorize(...managers), getMeta);

router.get('/', protect, authorize(...managers), getAllPlacements);
router.post('/', protect, authorize(...managers), createPlacement);
router.get('/:id', protect, authorize(...managers), getPlacementById);
router.put('/:id', protect, authorize(...managers), updatePlacement);
router.put('/:id/toggle', protect, authorize(...managers), togglePlacement);
router.delete('/:id', protect, authorize(...managers), deletePlacement);

export default router;
