import express from 'express';
import {
  getActiveEventGif,
  getAllEventGifs,
  createEventGif,
  updateEventGif,
  deleteEventGif,
} from '../controllers/eventGifController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.AD_MANAGER];

router.get('/active', getActiveEventGif);
router.get('/', protect, authorize(...managers), getAllEventGifs);
router.post('/', protect, authorize(...managers), createEventGif);
router.put('/:id', protect, authorize(...managers), updateEventGif);
router.delete('/:id', protect, authorize(...managers), deleteEventGif);

export default router;
