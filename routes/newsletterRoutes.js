import express from 'express';
import { subscribe, getSubscribers } from '../controllers/newsletterController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.post('/subscribe', subscribe);
router.get('/', protect, authorize(ROLES.SUPER_ADMIN), getSubscribers);

export default router;
