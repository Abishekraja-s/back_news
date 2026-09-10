import express from 'express';
import {
  getPublicProducts,
  getPublicProduct,
  getHubProducts,
  registerSeller,
  getMyProducts,
  createProduct,
  updateMyProduct,
  deleteMyProduct,
  getMyEnquiries,
  updateEnquiry,
  createEnquiry,
  getAdminProducts,
  reviewProduct,
  getAdminEnquiries,
  getSellerDashboardStats,
} from '../controllers/marketplaceController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
const admins = [ROLES.SUPER_ADMIN, ROLES.EDITOR];

// Public
router.get('/products', getPublicProducts);
router.get('/products/hub', getHubProducts);
router.get('/products/:id', getPublicProduct);
router.post('/products/:id/enquiries', createEnquiry);
router.post('/seller/register', registerSeller);

// Seller
router.get('/seller/stats', protect, authorize(ROLES.SELLER), getSellerDashboardStats);
router.get('/seller/products', protect, authorize(ROLES.SELLER), getMyProducts);
router.post('/seller/products', protect, authorize(ROLES.SELLER), createProduct);
router.put('/seller/products/:id', protect, authorize(ROLES.SELLER), updateMyProduct);
router.delete('/seller/products/:id', protect, authorize(ROLES.SELLER), deleteMyProduct);
router.get('/seller/enquiries', protect, authorize(ROLES.SELLER), getMyEnquiries);
router.put('/seller/enquiries/:id', protect, authorize(ROLES.SELLER), updateEnquiry);

// Admin
router.get('/admin/products', protect, authorize(...admins), getAdminProducts);
router.put('/admin/products/:id/review', protect, authorize(...admins), reviewProduct);
router.get('/admin/enquiries', protect, authorize(...admins), getAdminEnquiries);

export default router;
