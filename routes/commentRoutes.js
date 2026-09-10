import express from 'express';
import {
  getComments,
  createComment,
  updateCommentStatus,
  deleteComment,
  getArticleComments,
} from '../controllers/commentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.get('/article/:articleId', getArticleComments);
router.post('/', createComment);
router.get('/', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), getComments);
router.put('/:id/status', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), updateCommentStatus);
router.delete('/:id', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), deleteComment);

export default router;
