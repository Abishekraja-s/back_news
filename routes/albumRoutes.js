import express from 'express';
import {
  getPublicAlbums,
  getPublicAlbumBySlug,
  getPublicCategories,
  getAdminAlbums,
  getAdminAlbumById,
  createAlbum,
  updateAlbum,
  toggleAlbumPublish,
  deleteAlbum,
  uploadAlbumImagesHandler,
  updateAlbumImage,
  reorderAlbumImages,
  setAlbumCover,
  deleteAlbumImage,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createFromTodayNews,
} from '../controllers/albumController.js';
import { protect, authorize } from '../middleware/auth.js';
import { uploadAlbumImages } from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR, ROLES.REPORTER];

/* Public */
router.get('/', getPublicAlbums);
router.get('/categories', getPublicCategories);
router.get('/slug/:slug', getPublicAlbumBySlug);

/* Admin categories */
router.get('/admin/categories', protect, authorize(...managers), getAdminCategories);
router.post('/admin/categories', protect, authorize(...managers), createCategory);
router.put('/admin/categories/:id', protect, authorize(...managers), updateCategory);
router.delete('/admin/categories/:id', protect, authorize(...managers), deleteCategory);

/* Admin albums */
router.get('/admin', protect, authorize(...managers), getAdminAlbums);
router.post('/admin/from-today-news', protect, authorize(...managers), createFromTodayNews);
router.get('/admin/:id', protect, authorize(...managers), getAdminAlbumById);
router.post('/admin', protect, authorize(...managers), createAlbum);
router.put('/admin/:id', protect, authorize(...managers), updateAlbum);
router.patch('/admin/:id/publish', protect, authorize(...managers), toggleAlbumPublish);
router.delete('/admin/:id', protect, authorize(...managers), deleteAlbum);

router.post(
  '/admin/:id/images',
  protect,
  authorize(...managers),
  (req, res, next) => {
    uploadAlbumImages.array('files', 40)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Each image must be 12 MB or less before compression',
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Maximum 40 images per upload',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Upload failed',
      });
    });
  },
  uploadAlbumImagesHandler
);
router.put('/admin/:id/images/reorder', protect, authorize(...managers), reorderAlbumImages);
router.put('/admin/:id/cover', protect, authorize(...managers), setAlbumCover);
router.put('/admin/images/:imageId', protect, authorize(...managers), updateAlbumImage);
router.delete('/admin/images/:imageId', protect, authorize(...managers), deleteAlbumImage);

export default router;
