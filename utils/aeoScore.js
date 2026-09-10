import { DEFAULT_AEO_CONFIG } from '../config/aeoDefaults.js';

export const articleToScoreInput = (article = {}) => ({
  title: article.title,
  metaTitle: article.seoTitle || article.title,
  metaDescription: article.metaDescription || article.excerpt || '',
  focusKeyword: article.focusKeyword,
  secondaryKeywords: article.secondaryKeywords || [],
  canonicalUrl: article.canonicalUrl,
  ogTitle: article.ogTitle,
  ogDescription: article.ogDescription,
  h1: article.title,
  headings: article.aeoHeadings || [],
  directAnswer: article.directAnswer,
  aiSummary: article.aiSummary,
  entities: article.entities || [],
  internalLinks: Array.isArray(article.internalLinks) ? article.internalLinks : [],
});

export const scoreArticleOptimization = (article = {}, config = {}) =>
  scorePageOptimization(articleToScoreInput(article), config);

export const scorePageOptimization = (page = {}, config = {}) => {
  const cfg = { ...DEFAULT_AEO_CONFIG, ...config };
  const suggestions = [];
  const breakdown = {};
  let earned = 0;
  let total = 0;

  const check = (key, points, ok, tip) => {
    total += points;
    if (ok) {
      earned += points;
      breakdown[key] = { ok: true, points };
    } else {
      breakdown[key] = { ok: false, points };
      if (tip) suggestions.push(tip);
    }
  };

  const title = page.metaTitle || page.title || '';
  const desc = page.metaDescription || '';
  const answer = page.directAnswer || '';
  const summary = page.aiSummary || '';
  const h1 = page.h1 || '';
  const headings = page.headings || [];
  const entities = page.entities || [];
  const links = page.internalLinks || [];
  const keywords = [page.focusKeyword, ...(page.secondaryKeywords || [])].filter(Boolean);

  check('metaTitle', 12, title.length >= cfg.titleMin && title.length <= cfg.titleMax, `Meta title should be ${cfg.titleMin}–${cfg.titleMax} chars (now ${title.length}).`);
  check('metaDescription', 12, desc.length >= cfg.metaDescriptionMin && desc.length <= cfg.metaDescriptionMax, `Meta description should be ${cfg.metaDescriptionMin}–${cfg.metaDescriptionMax} chars.`);
  check('focusKeyword', 8, Boolean(page.focusKeyword?.trim()), 'Add a focus keyword.');
  check('h1', 8, Boolean(h1.trim()) || !cfg.requireH1, 'Add a clear H1.');
  check('headings', 8, headings.length >= cfg.minHeadings, `Add at least ${cfg.minHeadings} headings.`);
  check('canonical', 6, Boolean(page.canonicalUrl?.trim()) || !cfg.enableCanonical, 'Set a canonical URL.');
  check('openGraph', 6, Boolean(page.ogTitle || page.ogDescription || !cfg.enableOpenGraph), 'Fill Open Graph fields.');

  if (cfg.aeoEnabled) {
    check('directAnswer', 14, answer.length >= cfg.minAnswerLength, `Add a direct answer (${cfg.minAnswerLength}+ chars).`);
    check('questionHeadings', 6, !cfg.preferQuestionHeadings || headings.some((h) => /\?|who|what|when|where|why|how|என்ன|எப்படி|யார்/i.test(h)), 'Use question-style headings.');
  }
  if (cfg.geoEnabled) {
    check('aiSummary', 10, summary.length >= 60, 'Add an AI-friendly summary.');
    check('entities', 8, entities.length >= Math.min(cfg.entityDensityTarget, 2), `Add ~${cfg.entityDensityTarget} entities.`);
    check('internalLinks', 6, links.length >= Math.min(cfg.internalLinksPerPage, 2), `Add ~${cfg.internalLinksPerPage} internal links.`);
  }
  check('keywords', 6, keywords.length >= 1, 'Define focus keywords.');

  const score = total ? Math.round((earned / total) * 100) : 0;
  if (score >= 85) suggestions.unshift('Strong AEO/GEO readiness.');
  else if (score >= 60) suggestions.unshift('Solid base — improve answers and entities.');
  else suggestions.unshift('Priority: meta, H1, direct answer, entities.');

  return { score, suggestions, breakdown, earned, total };
};

export const buildOrganizationJsonLd = (config, baseUrl) => ({
  '@context': 'https://schema.org',
  '@type': 'NewsMediaOrganization',
  name: config.organizationName || 'The Great India News',
  url: baseUrl,
  logo: config.organizationLogo || undefined,
  sameAs: (config.organizationSameAs || []).filter(Boolean),
});

export const buildWebSiteJsonLd = (config, baseUrl) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: config.organizationName || 'The Great India News',
  url: baseUrl,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${baseUrl}/search?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

export const buildFaqJsonLd = (faqs = []) => {
  const mainEntity = faqs
    .filter((f) => f.isActive !== false && f.includeInSchema !== false)
    .map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    }));
  if (!mainEntity.length) return null;
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity };
};

export const buildRobotsText = (config, baseUrl) => {
  const lines = ['User-agent: *', 'Allow: /'];
  (config.noindexPaths || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((p) => {
      const path = p.startsWith('/') ? p : `/${p}`;
      lines.push(`Disallow: ${path}`);
    });
  if (config.robotsTxtCustom?.trim()) {
    lines.push('', '# Custom', config.robotsTxtCustom.trim());
  }
  if (config.robotsAllowAiBots) {
    lines.push('', 'User-agent: GPTBot', 'Allow: /', 'User-agent: Google-Extended', 'Allow: /', 'User-agent: PerplexityBot', 'Allow: /', 'User-agent: ClaudeBot', 'Allow: /');
  } else {
    lines.push('', 'User-agent: GPTBot', 'Disallow: /', 'User-agent: Google-Extended', 'Disallow: /');
  }
  lines.push('');
  if (config.sitemapEnabled !== false) lines.push(`Sitemap: ${baseUrl}/sitemap.xml`);
  if (config.newsSitemapEnabled !== false) lines.push(`Sitemap: ${baseUrl}/news-sitemap.xml`);
  return `${lines.join('\n')}\n`;
};
