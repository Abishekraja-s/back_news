import { ROLES } from './constants.js';

/** Admin sidebar pages — key is stored in role permissions */
export const ADMIN_PAGES = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin' },
  { key: 'articles', label: 'Articles', path: '/admin/articles' },
  { key: 'articles-create', label: 'Add Article', path: '/admin/articles/create' },
  { key: 'categories', label: 'Categories', path: '/admin/categories' },
  { key: 'authors', label: 'Authors', path: '/admin/authors' },
  { key: 'media', label: 'Media', path: '/admin/media' },
  { key: 'breaking-news', label: 'Breaking News', path: '/admin/breaking-news' },
  { key: 'advertisements', label: 'Advertisements', path: '/admin/advertisements' },
  { key: 'adsense', label: 'AdSense Placement', path: '/admin/adsense' },
  { key: 'google-analytics', label: 'Google Analytics', path: '/admin/google-analytics' },
  { key: 'features', label: 'Features', path: '/admin/features' },
  { key: 'feature-content', label: 'Feature Content', path: '/admin/feature-content' },
  { key: 'marketplace', label: 'Marketplace', path: '/admin/marketplace' },
  { key: 'matrimony', label: 'Matrimony', path: '/admin/matrimony' },
  { key: 'youtube-slider', label: 'YouTube Slider', path: '/admin/youtube-slider' },
  { key: 'instagram-posts', label: 'Instagram Posts', path: '/admin/instagram-posts' },
  { key: 'google-news', label: 'Google News', path: '/admin/google-news' },
  { key: 'travel-notifications', label: 'Travel Notifications', path: '/admin/travel-notifications' },
  { key: 'sports-live', label: 'Sports Live Updates', path: '/admin/sports-live' },
  { key: 'government-notifications', label: 'Government Notifications', path: '/admin/government-notifications' },
  { key: 'aeo-geo', label: 'AEO & GEO', path: '/admin/aeo-geo' },
  { key: 'menu-management', label: 'Menu Management', path: '/admin/page-menu' },
  { key: 'users', label: 'Users', path: '/admin/users' },
  { key: 'role-permissions', label: 'Role Permissions', path: '/admin/role-permissions' },
  { key: 'settings', label: 'Settings', path: '/admin/settings' },
];

export const ALL_ADMIN_PAGE_KEYS = ADMIN_PAGES.map((p) => p.key);

const editorPages = ALL_ADMIN_PAGE_KEYS.filter(
  (k) => !['users', 'role-permissions', 'settings'].includes(k)
);

export const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [...ALL_ADMIN_PAGE_KEYS],
  [ROLES.EDITOR]: editorPages,
  [ROLES.REPORTER]: [
    'dashboard',
    'articles',
    'articles-create',
    'media',
    'breaking-news',
  ],
  [ROLES.AUTHOR]: ['dashboard', 'articles', 'articles-create', 'media'],
  [ROLES.AD_MANAGER]: ['dashboard', 'advertisements', 'adsense', 'google-analytics'],
  [ROLES.SELLER]: [],
};

/** Map admin pathname to permission page key */
export const pathToPageKey = (pathname) => {
  if (!pathname || !pathname.startsWith('/admin')) return null;
  if (pathname === '/admin') return 'dashboard';
  if (pathname.startsWith('/admin/articles/create')) return 'articles-create';
  if (pathname.startsWith('/admin/articles')) return 'articles';
  if (pathname.startsWith('/admin/role-permissions')) return 'role-permissions';
  if (pathname.startsWith('/admin/matrimony')) return 'matrimony';
  if (pathname.startsWith('/admin/page-menu')) return 'menu-management';

  const match = ADMIN_PAGES.find(
    (p) => p.path !== '/admin' && (pathname === p.path || pathname.startsWith(`${p.path}/`))
  );
  return match?.key || null;
};

export const ADMIN_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.EDITOR,
  ROLES.REPORTER,
  ROLES.AUTHOR,
  ROLES.AD_MANAGER,
];
