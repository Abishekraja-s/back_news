import express from 'express';
import {
  getSettings,
  updateSettings,
  getPublicSettings,
  uploadBrandSetting,
} from '../controllers/settingController.js';
import { protect, authorize } from '../middleware/auth.js';
import { uploadBrandAsset } from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.get('/public', getPublicSettings);
router.get('/', protect, authorize(ROLES.SUPER_ADMIN), getSettings);
router.put('/', protect, authorize(ROLES.SUPER_ADMIN), updateSettings);
router.post(
  '/upload-brand',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  (req, res, next) => {
    uploadBrandAsset.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'Upload failed',
        });
      }
      next();
    });
  },
  uploadBrandSetting
);

export default router;
