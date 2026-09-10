import express from 'express';
import {
  getConfig,
  updateConfig,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getDashboard,
  listAdminProfiles,
  getAdminProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  reviewProfile,
  toggleFlags,
  getPublicProfiles,
  getHubProfiles,
  getPublicProfile,
  getPublicCategories,
  registerMatrimonyMember,
  getMyProfile,
  createMyProfile,
  updateMyProfile,
  deleteMyProfile,
  createEnquiry,
  getMySubmittedEnquiries,
  getReceivedEnquiries,
  updateReceivedEnquiry,
  getAdminProfileEnquiries,
  updateAdminEnquiry,
} from '../controllers/matrimonyController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { upload, uploadDocument } from '../middleware/upload.js';

const router = express.Router();
const managers = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

// Public
router.get('/public', getPublicProfiles);
router.get('/public/hub', getHubProfiles);
router.get('/public/categories', getPublicCategories);
router.post('/public/:id/enquiries', optionalAuth, createEnquiry);
router.get('/public/:id', getPublicProfile);

// Admin
router.get('/admin/dashboard', protect, authorize(...managers), getDashboard);
router.get('/admin/config', protect, authorize(...managers), getConfig);
router.put('/admin/config', protect, authorize(...managers), updateConfig);

router.get('/admin/categories', protect, authorize(...managers), listCategories);
router.post('/admin/categories', protect, authorize(...managers), createCategory);
router.put('/admin/categories/:id', protect, authorize(...managers), updateCategory);
router.delete('/admin/categories/:id', protect, authorize(...managers), deleteCategory);

router.get('/admin/profiles', protect, authorize(...managers), listAdminProfiles);
router.get('/admin/profiles/:id', protect, authorize(...managers), getAdminProfile);
router.post('/admin/profiles', protect, authorize(...managers), createProfile);
router.put('/admin/profiles/:id', protect, authorize(...managers), updateProfile);
router.delete('/admin/profiles/:id', protect, authorize(...managers), deleteProfile);
router.put('/admin/profiles/:id/review', protect, authorize(...managers), reviewProfile);
router.put('/admin/profiles/:id/flags', protect, authorize(...managers), toggleFlags);
router.get('/admin/profiles/:id/enquiries', protect, authorize(...managers), getAdminProfileEnquiries);
router.put('/admin/profiles/:id/enquiries/:enquiryId', protect, authorize(...managers), updateAdminEnquiry);

router.post(
  '/admin/upload',
  protect,
  authorize(...managers),
  upload.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    res.json({
      success: true,
      data: { url: `/uploads/${req.file.filename}`, filename: req.file.filename },
    });
  }
);

router.post(
  '/admin/upload-document',
  protect,
  authorize(...managers),
  uploadDocument.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    res.json({
      success: true,
      data: { url: `/uploads/${req.file.filename}`, filename: req.file.filename },
    });
  }
);

// Member portal
router.post('/member/register', registerMatrimonyMember);
router.get('/member/profile', protect, authorize(ROLES.MATRIMONY), getMyProfile);
router.post('/member/profile', protect, authorize(ROLES.MATRIMONY), createMyProfile);
router.put('/member/profile', protect, authorize(ROLES.MATRIMONY), updateMyProfile);
router.delete('/member/profile', protect, authorize(ROLES.MATRIMONY), deleteMyProfile);
router.get('/member/enquiries', protect, authorize(ROLES.MATRIMONY), getMySubmittedEnquiries);
router.get('/member/enquiries/received', protect, authorize(ROLES.MATRIMONY), getReceivedEnquiries);
router.put('/member/enquiries/:id', protect, authorize(ROLES.MATRIMONY), updateReceivedEnquiry);

router.post(
  '/member/upload',
  protect,
  authorize(ROLES.MATRIMONY),
  upload.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    res.json({
      success: true,
      data: { url: `/uploads/${req.file.filename}`, filename: req.file.filename },
    });
  }
);

router.post(
  '/member/upload-document',
  protect,
  authorize(ROLES.MATRIMONY),
  uploadDocument.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    res.json({
      success: true,
      data: { url: `/uploads/${req.file.filename}`, filename: req.file.filename },
    });
  }
);

export default router;
