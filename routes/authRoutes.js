import express from 'express';
import { login, logout, getMe, refreshToken, updateProfile, changePassword } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { body } from 'express-validator';

const router = express.Router();

router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  login
);
router.post('/logout', logout);
router.post('/refresh', refreshToken);
router.get('/me', protect, getMe);
router.put(
  '/profile',
  protect,
  [body('name').optional().trim().notEmpty(), body('email').optional().isEmail()],
  validate,
  updateProfile
);
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  changePassword
);

export default router;
