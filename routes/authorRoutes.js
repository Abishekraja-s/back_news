import express from 'express';
import {
  getAuthors,
  getAllAuthors,
  getAuthorBySlug,
  createAuthor,
  updateAuthor,
  deleteAuthor,
} from '../controllers/authorController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.get('/', getAuthors);
router.get('/all', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), getAllAuthors);
router.get('/:slug', getAuthorBySlug);
router.post('/', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), createAuthor);
router.put('/:id', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), updateAuthor);
router.delete('/:id', protect, authorize(ROLES.SUPER_ADMIN), deleteAuthor);

export default router;
