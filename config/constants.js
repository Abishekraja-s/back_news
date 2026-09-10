export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  EDITOR: 'EDITOR',
  REPORTER: 'REPORTER',
  AUTHOR: 'AUTHOR',
  AD_MANAGER: 'AD_MANAGER',
  SELLER: 'SELLER',
  MATRIMONY: 'MATRIMONY',
};

export const MARKETPLACE_PRODUCT_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SOLD: 'SOLD',
  INACTIVE: 'INACTIVE',
};

export const MARKETPLACE_ENQUIRY_STATUS = {
  NEW: 'NEW',
  READ: 'READ',
  REPLIED: 'REPLIED',
  CLOSED: 'CLOSED',
};

export const MATRIMONY_PROFILE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  INACTIVE: 'INACTIVE',
};

export const MATRIMONY_GENDERS = ['male', 'female', 'other'];
export const MATRIMONY_MARITAL_STATUSES = [
  'never_married',
  'divorced',
  'widowed',
  'separated',
  'awaiting_divorce',
];

export const ARTICLE_STATUS = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  SCHEDULED: 'SCHEDULED',
  TRASH: 'TRASH',
};

export const COMMENT_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

export const AD_POSITIONS = [
  'header',
  'top_banner',
  'homepage_top',
  'homepage_middle',
  'sidebar',
  'article_top',
  'article_middle',
  'article_bottom',
  'footer',
  'mobile_sticky',
];

/** AdSense placement locations (includes custom) */
export const ADSENSE_LOCATIONS = [
  'header',
  'homepage',
  'homepage_top',
  'homepage_middle',
  'article_top',
  'article_middle',
  'article_bottom',
  'sidebar',
  'footer',
  'top_banner',
  'mobile_sticky',
  'custom',
];

export const ADSENSE_FORMATS = [
  'auto',
  'fluid',
  'rectangle',
  'horizontal',
  'vertical',
  'in-article',
  'in-feed',
];

export const ADSENSE_PAGES = [
  'all',
  'home',
  'article',
  'category',
  'explore',
  'search',
  'author',
  'static',
];

export const DEFAULT_CATEGORIES = [
  { name: 'Tamil Nadu', nameTamil: 'தமிழ்நாடு', slug: 'tamil-nadu', order: 1 },
  { name: 'Chennai', nameTamil: 'சென்னை', slug: 'chennai', order: 2 },
  { name: 'India', nameTamil: 'இந்தியா', slug: 'india', order: 3 },
  { name: 'World', nameTamil: 'உலகம்', slug: 'world', order: 4 },
  { name: 'Politics', nameTamil: 'அரசியல்', slug: 'politics', order: 5 },
  { name: 'Business', nameTamil: 'வணிகம்', slug: 'business', order: 6 },
  { name: 'Sports', nameTamil: 'விளையாட்டு', slug: 'sports', order: 7 },
  { name: 'Cinema', nameTamil: 'சினிமா', slug: 'cinema', order: 8 },
  { name: 'Technology', nameTamil: 'தொழில்நுட்பம்', slug: 'technology', order: 9 },
  { name: 'Education', nameTamil: 'கல்வி', slug: 'education', order: 10 },
  { name: 'Jobs', nameTamil: 'வேலைவாய்ப்பு', slug: 'jobs', order: 11 },
  { name: 'Spiritual', nameTamil: 'ஆன்மிகம்', slug: 'spiritual', order: 12 },
  { name: 'District', nameTamil: 'மாவட்ட செய்திகள்', slug: 'district', order: 13 },
  { name: 'Special', nameTamil: 'சிறப்பு', slug: 'special', order: 14 },
];

export const TAMIL_NADU_DISTRICTS = [
  { name: 'Chennai', nameTamil: 'சென்னை', slug: 'chennai' },
  { name: 'Coimbatore', nameTamil: 'கோயம்புத்தூர்', slug: 'coimbatore' },
  { name: 'Madurai', nameTamil: 'மதுரை', slug: 'madurai' },
  { name: 'Trichy', nameTamil: 'திருச்சி', slug: 'trichy' },
  { name: 'Erode', nameTamil: 'ஈரோடு', slug: 'erode' },
  { name: 'Salem', nameTamil: 'சேலம்', slug: 'salem' },
  { name: 'Thanjavur', nameTamil: 'தஞ்சாவூர்', slug: 'thanjavur' },
  { name: 'Tirunelveli', nameTamil: 'திருநelveli', slug: 'tirunelveli' },
  { name: 'Vellore', nameTamil: 'வellore', slug: 'vellore' },
  { name: 'Tiruppur', nameTamil: 'திருப்பூர்', slug: 'tiruppur' },
  { name: 'Dindigul', nameTamil: 'திண்டுக்கல்', slug: 'dindigul' },
  { name: 'Kanyakumari', nameTamil: 'கanyakumari', slug: 'kanyakumari' },
];
