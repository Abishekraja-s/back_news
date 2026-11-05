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

export const CATEGORY_AD_SLUGS = [
  'district',
  'politics',
  'chennai',
  'tamil-nadu',
  'india',
  'world',
  'crime',
  'pocso',
  'spiritual',
  'special',
  'education',
  'sports',
  'jobs',
  'agriculture',
  'sri-lanka',
  'business',
  'health',
  'short-news',
  'weather',
  'other-news',
];

/** Banner under each homepage category section title */
export const CATEGORY_AD_POSITIONS = CATEGORY_AD_SLUGS.map((slug) => `category_${slug}`);

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
  'category_below',
  ...CATEGORY_AD_POSITIONS,
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
  { name: 'District', nameTamil: 'மாவட்டம்', slug: 'district', order: 1 },
  { name: 'Politics', nameTamil: 'அரசியல்', slug: 'politics', order: 2 },
  { name: 'Chennai', nameTamil: 'சென்னை', slug: 'chennai', order: 3 },
  { name: 'Tamil Nadu', nameTamil: 'தமிழ்நாடு', slug: 'tamil-nadu', order: 4 },
  { name: 'India', nameTamil: 'இந்தியா', slug: 'india', order: 5 },
  { name: 'World', nameTamil: 'உலகம்', slug: 'world', order: 6 },
  { name: 'Crime', nameTamil: 'குற்றம்', slug: 'crime', order: 7 },
  { name: 'POCSO', nameTamil: 'போக்சோ', slug: 'pocso', order: 8 },
  { name: 'Spiritual', nameTamil: 'ஆன்மீகம்', slug: 'spiritual', order: 9 },
  { name: 'Special', nameTamil: 'சிறப்பு செய்திகள்', slug: 'special', order: 10 },
  { name: 'Education', nameTamil: 'கல்வி', slug: 'education', order: 11 },
  { name: 'Sports', nameTamil: 'விளையாட்டு', slug: 'sports', order: 12 },
  { name: 'Jobs', nameTamil: 'வேலை வாய்ப்பு', slug: 'jobs', order: 13 },
  { name: 'Agriculture', nameTamil: 'விவசாயம்', slug: 'agriculture', order: 14 },
  { name: 'Sri Lanka', nameTamil: 'இலங்கை', slug: 'sri-lanka', order: 15 },
  { name: 'Business', nameTamil: 'வணிகம்', slug: 'business', order: 16 },
  { name: 'Health', nameTamil: 'மருத்துவம்', slug: 'health', order: 17 },
  { name: 'Short News', nameTamil: 'ஷார்ட் நியூஸ்', slug: 'short-news', order: 18 },
  { name: 'Weather', nameTamil: 'வானிலை', slug: 'weather', order: 19 },
  { name: 'Other News', nameTamil: 'மற்ற செய்திகள்', slug: 'other-news', order: 20 },
  // Legacy (kept for existing articles; not in main nav)
  { name: 'Cinema', nameTamil: 'சினிமா', slug: 'cinema', order: 90 },
  { name: 'Technology', nameTamil: 'தொழில்நுட்பம்', slug: 'technology', order: 91 },
];

/** All 38 Tamil Nadu districts (news category chips under மாவட்ட செய்திகள்) */
export const TAMIL_NADU_DISTRICTS = [
  { name: 'Ariyalur', nameTamil: 'அரியலூர்', slug: 'ariyalur' },
  { name: 'Chengalpattu', nameTamil: 'செங்கல்பட்டு', slug: 'chengalpattu' },
  { name: 'Chennai', nameTamil: 'சென்னை', slug: 'chennai' },
  { name: 'Coimbatore', nameTamil: 'கோயம்புத்தூர்', slug: 'coimbatore' },
  { name: 'Cuddalore', nameTamil: 'கடலூர்', slug: 'cuddalore' },
  { name: 'Dharmapuri', nameTamil: 'தருமபுரி', slug: 'dharmapuri' },
  { name: 'Dindigul', nameTamil: 'திண்டுக்கல்', slug: 'dindigul' },
  { name: 'Erode', nameTamil: 'ஈரோடு', slug: 'erode' },
  { name: 'Kallakurichi', nameTamil: 'கள்ளக்குறிச்சி', slug: 'kallakurichi' },
  { name: 'Kancheepuram', nameTamil: 'காஞ்சிபுரம்', slug: 'kancheepuram' },
  { name: 'Kanniyakumari', nameTamil: 'கன்னியாகுமரி', slug: 'kanyakumari' },
  { name: 'Karur', nameTamil: 'கரூர்', slug: 'karur' },
  { name: 'Krishnagiri', nameTamil: 'கிருஷ்ணகிரி', slug: 'krishnagiri' },
  { name: 'Madurai', nameTamil: 'மதுரை', slug: 'madurai' },
  { name: 'Mayiladuthurai', nameTamil: 'மயிலாடுதுறை', slug: 'mayiladuthurai' },
  { name: 'Nagapattinam', nameTamil: 'நாகப்பட்டினம்', slug: 'nagapattinam' },
  { name: 'Namakkal', nameTamil: 'நாமக்கல்', slug: 'namakkal' },
  { name: 'Nilgiris', nameTamil: 'நீலகிரி', slug: 'nilgiris' },
  { name: 'Perambalur', nameTamil: 'பெரம்பலூர்', slug: 'perambalur' },
  { name: 'Pudukkottai', nameTamil: 'புதுக்கோட்டை', slug: 'pudukkottai' },
  { name: 'Ramanathapuram', nameTamil: 'ராமநாதபுரம்', slug: 'ramanathapuram' },
  { name: 'Ranipet', nameTamil: 'ராணிப்பேட்டை', slug: 'ranipet' },
  { name: 'Salem', nameTamil: 'சேலம்', slug: 'salem' },
  { name: 'Sivaganga', nameTamil: 'சிவகங்கை', slug: 'sivaganga' },
  { name: 'Tenkasi', nameTamil: 'தென்காசி', slug: 'tenkasi' },
  { name: 'Thanjavur', nameTamil: 'தஞ்சாவூர்', slug: 'thanjavur' },
  { name: 'Theni', nameTamil: 'தேனி', slug: 'theni' },
  { name: 'Thoothukudi', nameTamil: 'தூத்துக்குடி', slug: 'thoothukudi' },
  { name: 'Tiruchirappalli', nameTamil: 'திருச்சி', slug: 'trichy' },
  { name: 'Tirunelveli', nameTamil: 'திருநெல்வேலி', slug: 'tirunelveli' },
  { name: 'Tirupathur', nameTamil: 'திருப்பத்தூர்', slug: 'tirupathur' },
  { name: 'Tiruppur', nameTamil: 'திருப்பூர்', slug: 'tiruppur' },
  { name: 'Tiruvallur', nameTamil: 'திருவள்ளூர்', slug: 'tiruvallur' },
  { name: 'Tiruvannamalai', nameTamil: 'திருவண்ணாமலை', slug: 'tiruvannamalai' },
  { name: 'Tiruvarur', nameTamil: 'திருவாரூர்', slug: 'tiruvarur' },
  { name: 'Vellore', nameTamil: 'வேலூர்', slug: 'vellore' },
  { name: 'Viluppuram', nameTamil: 'விழுப்புரம்', slug: 'viluppuram' },
  { name: 'Virudhunagar', nameTamil: 'விருதுநகர்', slug: 'virudhunagar' },
];
