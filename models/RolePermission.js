import mongoose from 'mongoose';
import { DEFAULT_ROLE_PERMISSIONS } from '../config/adminPages.js';

const rolePermissionSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    /** role → array of page keys */
    roles: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_ROLE_PERMISSIONS }),
    },
  },
  { timestamps: true }
);

export default mongoose.model('RolePermission', rolePermissionSchema);
