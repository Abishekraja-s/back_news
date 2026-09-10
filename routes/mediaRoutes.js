import express from 'express';
import { getMedia, uploadMedia, uploadAudioMedia, updateMedia, deleteMedia } from '../controllers/mediaController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload, uploadAudio } from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.get('/', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.REPORTER), getMedia);
router.post(
  '/upload',
  protect,
  authorize(
    ROLES.SUPER_ADMIN,
    ROLES.EDITOR,
    ROLES.REPORTER,
    ROLES.AUTHOR,
    ROLES.AD_MANAGER,
    ROLES.SELLER
  ),
  upload.single('file'),
  uploadMedia
);
router.post(
  '/upload-audio',
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.REPORTER, ROLES.AUTHOR),
  uploadAudio.single('file'),
  uploadAudioMedia
);
router.put('/:id', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), updateMedia);
router.delete('/:id', protect, authorize(ROLES.SUPER_ADMIN, ROLES.EDITOR), deleteMedia);

export default router;
