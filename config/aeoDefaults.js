/**
 * AEO / GEO defaults + Gemini config (API key never stored here).
 */

export const AEO_PAGE_TYPES = ['home', 'article', 'category', 'static', 'marketplace', 'explore', 'custom'];
export const AEO_PAGE_STATUS = ['draft', 'optimized', 'needs_work', 'indexed', 'noindex'];
export const AEO_ENTITY_TYPES = ['person', 'place', 'organization', 'topic', 'event', 'product', 'other'];

export const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

/** Legacy model IDs mapped to current GA equivalents */
export const GEMINI_DEPRECATED_MODELS = {
  'gemini-2.0-flash': 'gemini-3.6-flash',
  'gemini-1.5-flash': 'gemini-3.6-flash',
  'gemini-1.5-pro': 'gemini-3.6-flash',
};

export const DEFAULT_AEO_CONFIG = {
  defaultSeoTitle: 'The Great India News - Latest Tamil News',
  defaultMetaDescription:
    'Latest Tamil news from Tamil Nadu, India and World. Breaking news, politics, sports, cinema and more.',
  defaultKeywords: 'tamil news, chennai news, tamil nadu, india news',
  titleTemplate: '%s | The Great India News',
  canonicalBaseUrl: '',
  enableCanonical: true,
  enableOpenGraph: true,
  enableTwitterCards: true,
  ogSiteName: 'The Great India News',
  ogDefaultImage: '',
  twitterHandle: '',
  robotsTxtCustom: '',
  robotsAllowAiBots: true,
  sitemapEnabled: true,
  newsSitemapEnabled: true,
  rssEnabled: true,
  rssChannelTitle: 'The Great India News Live RSS Dispatch',
  rssChannelDescription:
    'The standard of excellence in Indian journalism. Premium regional breaking news and investigations.',
  rssFeedLimit: 30,
  rssBodyContentDepth: 'full',
  rssLanguage: 'en-IN',
  rssCacheSeconds: 300,
  rssArticlePath: 'post',
  rssPreviewAutoRefresh: true,
  rssPreviewRefreshSeconds: 10,
  enableJsonLd: true,
  enableOrganizationSchema: true,
  enableWebSiteSchema: true,
  enableNewsArticleSchema: true,
  enableFaqSchema: true,
  enableBreadcrumbSchema: true,
  organizationName: 'The Great India News',
  organizationLogo: '',
  organizationSameAs: [],
  aeoEnabled: true,
  preferQuestionHeadings: true,
  requireDirectAnswer: true,
  minAnswerLength: 40,
  maxAnswerLength: 300,
  citeSourcesInAnswers: true,
  faqPerPageTarget: 5,
  speakableEnabled: true,
  geoEnabled: true,
  optimizeForGoogleAiOverviews: true,
  optimizeForChatGPT: true,
  optimizeForGemini: true,
  optimizeForPerplexity: true,
  optimizeForBingCopilot: true,
  entityDensityTarget: 3,
  internalLinksPerPage: 3,
  aiSummaryEnabled: true,
  aiCitationFriendly: true,
  clearAttribution: true,
  minWordCount: 300,
  targetWordCount: 800,
  minHeadings: 2,
  requireH1: true,
  requireMetaDescription: true,
  metaDescriptionMin: 120,
  metaDescriptionMax: 160,
  titleMin: 30,
  titleMax: 60,
  // Gemini (key stored separately — never in this object returned raw)
  geminiEnabled: true,
  geminiModel: 'gemini-3.6-flash',
  geminiLanguage: 'ta',
  geminiThinkingLevel: 'medium',
  geminiTemperature: 0.7,
  geminiMaxOutputTokens: 4096,
  modules: {
    dashboard: true,
    globalSeo: true,
    aeoGeo: true,
    gemini: true,
    faqs: true,
    entities: true,
    pages: true,
    schema: true,
    indexing: true,
    reports: true,
  },
  status: 'active',
  lastScoredAt: null,
};

export const resolveGeminiModel = (model) => {
  if (GEMINI_MODELS.includes(model)) return model;
  if (GEMINI_DEPRECATED_MODELS[model]) return GEMINI_DEPRECATED_MODELS[model];
  return DEFAULT_AEO_CONFIG.geminiModel;
};

export const AEO_MODULES = [
  { key: 'dashboard', label: 'Dashboard', description: 'Scores and quick actions' },
  { key: 'gemini', label: 'Gemini Generate', description: 'Generate AEO/GEO with Gemini AI' },
  { key: 'globalSeo', label: 'SEO Basics', description: 'Titles, meta, OG' },
  { key: 'aeoGeo', label: 'AEO & GEO', description: 'AI answer engine settings' },
  { key: 'faqs', label: 'FAQs', description: 'FAQ content and schema' },
  { key: 'entities', label: 'Entities', description: 'Keywords and entities' },
  { key: 'pages', label: 'Pages', description: 'Page-level optimization' },
  { key: 'schema', label: 'Schema', description: 'JSON-LD preview' },
  { key: 'indexing', label: 'Indexing', description: 'robots.txt and sitemaps' },
  { key: 'reports', label: 'Reports', description: 'Readiness reports' },
];

/** Secret Setting keys — never expose full values to clients */
export const AEO_SECRET_KEYS = ['geminiApiKey'];
