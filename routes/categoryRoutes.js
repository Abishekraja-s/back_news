import express from 'express';
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/:slug', getCategoryBySlug);
router.post('/', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), createCategory);
router.put('/:id', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), updateCategory);
router.delete('/:id', protect, authorize(ROLES.SUPER_ADMIN), deleteCategory);

export default router;
