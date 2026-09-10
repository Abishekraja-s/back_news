import RolePermission from '../models/RolePermission.js';
import {
  ADMIN_PAGES,
  ADMIN_ROLES,
  ALL_ADMIN_PAGE_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  pathToPageKey,
} from '../config/adminPages.js';
import { ROLES } from '../config/constants.js';

const getOrCreateConfig = async () => {
  let config = await RolePermission.findOne({ key: 'default' });
  if (!config) {
    config = await RolePermission.create({ key: 'default', roles: { ...DEFAULT_ROLE_PERMISSIONS } });
    return config;
  }

  const roles = { ...(config.roles || {}) };
  let changed = false;
  for (const [role, pages] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    if (!Array.isArray(roles[role])) {
      roles[role] = pages;
      changed = true;
    }
  }
  if (changed) {
    config.roles = roles;
    await config.save();
  }
  return config;
};

const getPagesForRole = (config, role) => {
  if (role === ROLES.SUPER_ADMIN) return [...ALL_ADMIN_PAGE_KEYS];
  const stored = config?.roles?.[role];
  if (Array.isArray(stored) && stored.length) {
    return stored.filter((k) => ALL_ADMIN_PAGE_KEYS.includes(k));
  }
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
};

export const getPermissionConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateConfig();
    const roles = {};
    for (const role of ADMIN_ROLES) {
      roles[role] = getPagesForRole(config, role);
    }
    res.json({
      success: true,
      data: {
        pages: ADMIN_PAGES,
        roles,
        adminRoles: ADMIN_ROLES,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyPermissions = async (req, res, next) => {
  try {
    const config = await getOrCreateConfig();
    const role = req.user.role;
    const pages = getPagesForRole(config, role);
    res.json({
      success: true,
      data: {
        role,
        pages,
        pagesMeta: ADMIN_PAGES.filter((p) => pages.includes(p.key)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateRolePermissions = async (req, res, next) => {
  try {
    const { role } = req.params;
    const { pages } = req.body;

    if (!ADMIN_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    if (role === ROLES.SUPER_ADMIN) {
      return res.status(400).json({
        success: false,
        message: 'Super Admin always has full access and cannot be restricted',
      });
    }
    if (!Array.isArray(pages)) {
      return res.status(400).json({ success: false, message: 'pages array required' });
    }

    const sanitized = pages.filter((k) => ALL_ADMIN_PAGE_KEYS.includes(k));
    const config = await getOrCreateConfig();
    config.roles = { ...(config.roles || {}), [role]: sanitized };
    await config.save();

    res.json({
      success: true,
      data: { role, pages: sanitized },
      message: 'Role permissions updated',
    });
  } catch (error) {
    next(error);
  }
};

export const checkPageAccess = async (req, res, next) => {
  try {
    const pathname = req.query.path || '';
    const pageKey = pathToPageKey(pathname);
    if (!pageKey) {
      return res.json({ success: true, data: { allowed: true, pageKey: null } });
    }

    const config = await getOrCreateConfig();
    const pages = getPagesForRole(config, req.user.role);
    res.json({
      success: true,
      data: { allowed: pages.includes(pageKey), pageKey },
    });
  } catch (error) {
    next(error);
  }
};
