import express from 'express';
import { getUsers, createUser, updateUser, deleteUser, getRoles } from '../controllers/userController.js';
import {
  getPermissionConfig,
  getMyPermissions,
  updateRolePermissions,
  checkPageAccess,
} from '../controllers/rolePermissionController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.get('/permissions/me', protect, getMyPermissions);
router.get('/permissions/check', protect, checkPageAccess);
router.get('/permissions', protect, authorize(ROLES.SUPER_ADMIN), getPermissionConfig);
router.put('/permissions/:role', protect, authorize(ROLES.SUPER_ADMIN), updateRolePermissions);

router.get('/', protect, authorize(ROLES.SUPER_ADMIN), getUsers);
router.get('/roles', protect, authorize(ROLES.SUPER_ADMIN), getRoles);
router.post('/', protect, authorize(ROLES.SUPER_ADMIN), createUser);
router.put('/:id', protect, authorize(ROLES.SUPER_ADMIN), updateUser);
router.delete('/:id', protect, authorize(ROLES.SUPER_ADMIN), deleteUser);

export default router;
