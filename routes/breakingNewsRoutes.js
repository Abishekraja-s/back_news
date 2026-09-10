import express from 'express';
import {
  getActiveBreakingNews,
  getAllBreakingNews,
  createBreakingNews,
  updateBreakingNews,
  deleteBreakingNews,
} from '../controllers/breakingNewsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.get('/active', getActiveBreakingNews);
router.get('/', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), getAllBreakingNews);
router.post('/', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), createBreakingNews);
router.put('/:id', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), updateBreakingNews);
router.delete('/:id', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), deleteBreakingNews);

export default router;
