import AeoConfig from '../models/AeoConfig.js';
import AeoFaq from '../models/AeoFaq.js';
import AeoEntity from '../models/AeoEntity.js';
import AeoPage from '../models/AeoPage.js';
import AeoUsage from '../models/AeoUsage.js';
import Article from '../models/Article.js';
import {
  DEFAULT_AEO_CONFIG,
  AEO_MODULES,
  AEO_PAGE_TYPES,
  AEO_ENTITY_TYPES,
  AEO_PAGE_STATUS,
  GEMINI_MODELS,
  resolveGeminiModel,
} from '../config/aeoDefaults.js';
import {
  scorePageOptimization,
  scoreArticleOptimization,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  buildFaqJsonLd,
  buildRobotsText,
} from '../utils/aeoScore.js';
import {
  resolveGeminiApiKey,
  saveGeminiApiKey,
  maskApiKey,
  generateAeoGeoContent,
  testGeminiConnection,
} from '../services/geminiService.js';
import { ARTICLE_STATUS } from '../config/constants.js';
import { invalidateRssCache } from '../services/rssFeedService.js';

const getBaseUrl = () => {
  const url = process.env.CLIENT_URL || 'http://localhost:5173';
  return url.split(',')[0].trim().replace(/\/$/, '');
};

export { buildRobotsText };

export const getOrCreateConfig = async () => {
  let doc = await AeoConfig.findOne({ key: 'global' });
  if (!doc) doc = await AeoConfig.create({ key: 'global', config: { ...DEFAULT_AEO_CONFIG } });
  return doc;
};

export const mergeConfig = (stored = {}) => {
  const merged = {
    ...DEFAULT_AEO_CONFIG,
    ...stored,
    modules: { ...DEFAULT_AEO_CONFIG.modules, ...(stored.modules || {}) },
  };
  merged.geminiModel = resolveGeminiModel(merged.geminiModel);
  return merged;
};

const logUsage = async (fields) => {
  try {
    await AeoUsage.create(fields);
  } catch {
    /* non-fatal */
  }
};

export const getConfig = async (req, res, next) => {
  try {
    const doc = await getOrCreateConfig();
    const { key, source } = await resolveGeminiApiKey();
    res.json({
      success: true,
      data: mergeConfig(doc.config),
      modules: AEO_MODULES,
      gemini: {
        configured: Boolean(key),
        source,
        maskedKey: key ? maskApiKey(key) : '',
        models: GEMINI_MODELS,
      },
      meta: {
        pageTypes: AEO_PAGE_TYPES,
        entityTypes: AEO_ENTITY_TYPES,
        pageStatuses: AEO_PAGE_STATUS,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateConfig = async (req, res, next) => {
  try {
    const doc = await getOrCreateConfig();
    const incoming = { ...req.body };
    const apiKey = incoming.geminiApiKey;
    delete incoming.geminiApiKey;

    const nextConfig = mergeConfig({ ...doc.config, ...incoming });
    if (incoming.modules && typeof incoming.modules === 'object') {
      nextConfig.modules = { ...DEFAULT_AEO_CONFIG.modules, ...doc.config?.modules, ...incoming.modules };
    }

    doc.config = nextConfig;
    doc.updatedBy = req.user?._id;
    await doc.save();
    invalidateRssCache();

    let keyInfo = null;
    if (typeof apiKey === 'string') {
      keyInfo = await saveGeminiApiKey(apiKey);
    }

    const { key, source } = await resolveGeminiApiKey();
    res.json({
      success: true,
      data: mergeConfig(doc.config),
      gemini: {
        configured: Boolean(key),
        source,
        maskedKey: key ? maskApiKey(key) : '',
        keyUpdated: Boolean(keyInfo),
      },
      message: 'AEO/GEO settings saved',
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboard = async (req, res, next) => {
  try {
    const doc = await getOrCreateConfig();
    const config = mergeConfig(doc.config);
    const [faqActive, entityCount, pages, usageToday, usageTotal] = await Promise.all([
      AeoFaq.countDocuments({ isActive: true }),
      AeoEntity.countDocuments({ isActive: true }),
      AeoPage.find({ isActive: true }).select('score status path title').lean(),
      AeoUsage.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        success: true,
      }),
      AeoUsage.countDocuments({ success: true }),
    ]);
    const avgScore = pages.length
      ? Math.round(pages.reduce((s, p) => s + (p.score || 0), 0) / pages.length)
      : 0;
    const { key, source } = await resolveGeminiApiKey();

    res.json({
      success: true,
      data: {
        config,
        stats: {
          faqActive,
          entityCount,
          pageCount: pages.length,
          avgScore,
          geminiUsageToday: usageToday,
          geminiUsageTotal: usageTotal,
        },
        readiness: {
          aeo: config.aeoEnabled ? (faqActive >= 3 && avgScore >= 50 ? 'ready' : 'partial') : 'off',
          geo: config.geoEnabled ? (entityCount >= 3 ? 'ready' : 'partial') : 'off',
          gemini: key ? (config.geminiEnabled ? 'ready' : 'off') : 'missing_key',
        },
        gemini: { configured: Boolean(key), source, maskedKey: key ? maskApiKey(key) : '' },
        modules: AEO_MODULES.filter((m) => config.modules?.[m.key] !== false),
        lowScorePages: pages.filter((p) => (p.score || 0) < 60).slice(0, 8),
      },
    });
  } catch (error) {
    next(error);
  }
};

// FAQs
export const listFaqs = async (req, res, next) => {
  try {
    const faqs = await AeoFaq.find().sort({ priority: -1, createdAt: -1 }).lean();
    res.json({ success: true, data: faqs });
  } catch (error) {
    next(error);
  }
};

export const createFaq = async (req, res, next) => {
  try {
    if (!req.body.question?.trim() || !req.body.answer?.trim()) {
      return res.status(400).json({ success: false, message: 'Question and answer required' });
    }
    const faq = await AeoFaq.create(req.body);
    res.status(201).json({ success: true, data: faq });
  } catch (error) {
    next(error);
  }
};

export const updateFaq = async (req, res, next) => {
  try {
    const faq = await AeoFaq.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
    res.json({ success: true, data: faq });
  } catch (error) {
    next(error);
  }
};

export const deleteFaq = async (req, res, next) => {
  try {
    await AeoFaq.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

// Entities
export const listEntities = async (req, res, next) => {
  try {
    const entities = await AeoEntity.find().sort({ priority: -1, name: 1 }).lean();
    res.json({ success: true, data: entities });
  } catch (error) {
    next(error);
  }
};

export const createEntity = async (req, res, next) => {
  try {
    if (!req.body.name?.trim()) return res.status(400).json({ success: false, message: 'Name required' });
    const entity = await AeoEntity.create(req.body);
    res.status(201).json({ success: true, data: entity });
  } catch (error) {
    next(error);
  }
};

export const updateEntity = async (req, res, next) => {
  try {
    const entity = await AeoEntity.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!entity) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: entity });
  } catch (error) {
    next(error);
  }
};

export const deleteEntity = async (req, res, next) => {
  try {
    await AeoEntity.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

// Pages
export const listPages = async (req, res, next) => {
  try {
    const pages = await AeoPage.find({ isActive: true }).sort({ score: 1, updatedAt: -1 }).lean();
    res.json({ success: true, data: pages });
  } catch (error) {
    next(error);
  }
};

export const createPage = async (req, res, next) => {
  try {
    if (!req.body.path?.trim()) return res.status(400).json({ success: false, message: 'Path required' });
    const path = req.body.path.trim().startsWith('/') ? req.body.path.trim() : `/${req.body.path.trim()}`;
    if (await AeoPage.findOne({ path })) {
      return res.status(400).json({ success: false, message: 'Path already exists' });
    }
    const doc = await getOrCreateConfig();
    const scored = scorePageOptimization({ ...req.body, path }, mergeConfig(doc.config));
    const page = await AeoPage.create({
      ...req.body,
      path,
      score: scored.score,
      suggestions: scored.suggestions,
      lastScoredAt: new Date(),
      status: scored.score >= 85 ? 'optimized' : scored.score >= 50 ? 'needs_work' : 'draft',
    });
    res.status(201).json({ success: true, data: page, breakdown: scored.breakdown });
  } catch (error) {
    next(error);
  }
};

export const updatePage = async (req, res, next) => {
  try {
    const existing = await AeoPage.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    Object.assign(existing, req.body);
    if (req.body.path) {
      existing.path = req.body.path.trim().startsWith('/') ? req.body.path.trim() : `/${req.body.path.trim()}`;
    }
    const doc = await getOrCreateConfig();
    const scored = scorePageOptimization(existing.toObject(), mergeConfig(doc.config));
    existing.score = scored.score;
    existing.suggestions = scored.suggestions;
    existing.lastScoredAt = new Date();
    await existing.save();
    res.json({ success: true, data: existing, breakdown: scored.breakdown });
  } catch (error) {
    next(error);
  }
};

export const deletePage = async (req, res, next) => {
  try {
    await AeoPage.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

export const scorePreview = async (req, res, next) => {
  try {
    const doc = await getOrCreateConfig();
    const scored = scorePageOptimization(req.body || {}, mergeConfig(doc.config));
    res.json({ success: true, data: scored });
  } catch (error) {
    next(error);
  }
};

export const getSchemaPreview = async (req, res, next) => {
  try {
    const doc = await getOrCreateConfig();
    const config = mergeConfig(doc.config);
    const baseUrl = config.canonicalBaseUrl || getBaseUrl();
    const graphs = [];
    if (config.enableOrganizationSchema) graphs.push(buildOrganizationJsonLd(config, baseUrl));
    if (config.enableWebSiteSchema) graphs.push(buildWebSiteJsonLd(config, baseUrl));
    const faqs = await AeoFaq.find({ isActive: true, includeInSchema: true }).sort({ priority: -1 }).limit(20).lean();
    if (config.enableFaqSchema) {
      const faqLd = buildFaqJsonLd(faqs);
      if (faqLd) graphs.push(faqLd);
    }
    res.json({
      success: true,
      data: {
        jsonLd: graphs.length === 1 ? graphs[0] : { '@context': 'https://schema.org', '@graph': graphs },
        robotsPreview: buildRobotsText(config, baseUrl),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getReport = async (req, res, next) => {
  try {
    const doc = await getOrCreateConfig();
    const config = mergeConfig(doc.config);
    const [faqs, entities, pages, usage] = await Promise.all([
      AeoFaq.find().lean(),
      AeoEntity.find().lean(),
      AeoPage.find({ isActive: true }).lean(),
      AeoUsage.find().sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    const checklist = [
      { id: 'meta', label: 'Default SEO title & description', ok: Boolean(config.defaultSeoTitle && config.defaultMetaDescription) },
      { id: 'jsonld', label: 'JSON-LD enabled', ok: config.enableJsonLd },
      { id: 'faq', label: 'Active FAQs (≥3)', ok: faqs.filter((f) => f.isActive).length >= 3 },
      { id: 'entities', label: 'Entities (≥5)', ok: entities.filter((e) => e.isActive).length >= 5 },
      { id: 'gemini', label: 'Gemini enabled & keyed', ok: config.geminiEnabled && Boolean((await resolveGeminiApiKey()).key) },
      { id: 'ai_bots', label: 'AI crawlers allowed', ok: config.robotsAllowAiBots },
    ];
    const overall = Math.round((checklist.filter((c) => c.ok).length / checklist.length) * 100);
    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        overall,
        checklist,
        pageScores: pages.map((p) => ({ path: p.path, score: p.score, status: p.status })).sort((a, b) => a.score - b.score),
        recentGeminiUsage: usage,
        counts: { faqs: faqs.length, entities: entities.length, pages: pages.length },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Gemini ─────────────────────────────────────────────

export const getGeminiStatus = async (req, res, next) => {
  try {
    const doc = await getOrCreateConfig();
    const config = mergeConfig(doc.config);
    const { key, source } = await resolveGeminiApiKey();
    const [today, total, recent] = await Promise.all([
      AeoUsage.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        success: true,
      }),
      AeoUsage.countDocuments({ success: true }),
      AeoUsage.find().sort({ createdAt: -1 }).limit(15).populate('user', 'name email').lean(),
    ]);
    res.json({
      success: true,
      data: {
        enabled: config.geminiEnabled,
        configured: Boolean(key),
        source,
        maskedKey: key ? maskApiKey(key) : '',
        model: config.geminiModel,
        language: config.geminiLanguage,
        models: GEMINI_MODELS,
        usage: { today, total },
        recent,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const testGemini = async (req, res, next) => {
  try {
    const doc = await getOrCreateConfig();
    const config = mergeConfig(doc.config);
    const result = await testGeminiConnection(config);
    await logUsage({
      user: req.user?._id,
      action: 'config_test',
      model: config.geminiModel,
      success: result.ok,
      errorMessage: result.message || '',
      latencyMs: result.latencyMs || 0,
      targetType: 'preview',
    });
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message, data: result });
    }
    res.json({ success: true, data: result, message: 'Gemini connection OK' });
  } catch (error) {
    next(error);
  }
};

export const generateWithGemini = async (req, res, next) => {
  try {
    const doc = await getOrCreateConfig();
    const config = mergeConfig(doc.config);

    if (!config.geminiEnabled) {
      return res.status(403).json({ success: false, message: 'Gemini generation is disabled in AEO settings' });
    }

    const topic = (req.body.topic || req.body.title || '').trim();
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic or title is required' });
    }

    const isRegen = Boolean(req.body.regenerate);
    let result;
    try {
      result = await generateAeoGeoContent({
        topic,
        context: {
          path: req.body.path,
          pageType: req.body.pageType || 'custom',
          excerpt: req.body.excerpt,
          contentSnippet: req.body.content || req.body.contentSnippet,
          focusKeyword: req.body.focusKeyword,
          targetType: req.body.targetType || 'preview',
        },
        config,
      });
    } catch (error) {
      await logUsage({
        user: req.user?._id,
        action: isRegen ? 'regenerate' : 'generate',
        model: config.geminiModel,
        topic,
        success: false,
        errorMessage: error.message,
        targetType: req.body.targetType || 'preview',
        targetId: req.body.targetId || '',
        language: config.geminiLanguage,
      });
      return res.status(error.statusCode || 502).json({ success: false, message: error.message });
    }

    const scored = scorePageOptimization(
      {
        metaTitle: result.data.metaTitle,
        metaDescription: result.data.metaDescription,
        focusKeyword: result.data.focusKeyword,
        secondaryKeywords: result.data.secondaryKeywords,
        h1: result.data.h1,
        headings: result.data.headings,
        directAnswer: result.data.directAnswer,
        aiSummary: result.data.aiSummary,
        entities: result.data.entities,
        internalLinks: result.data.internalLinks,
        ogTitle: result.data.ogTitle,
        ogDescription: result.data.ogDescription,
        canonicalUrl: result.data.canonicalSuggestion,
      },
      config
    );

    await logUsage({
      user: req.user?._id,
      action: isRegen ? 'regenerate' : 'generate',
      model: result.model,
      topic,
      success: true,
      promptTokens: result.usage.promptTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
      latencyMs: result.latencyMs,
      targetType: req.body.targetType || 'preview',
      targetId: req.body.targetId || '',
      language: config.geminiLanguage,
    });

    res.json({
      success: true,
      data: {
        ...result.data,
        customJsonLd: result.data.jsonLd ? JSON.stringify(result.data.jsonLd, null, 2) : '',
        scorePreview: scored,
      },
      meta: {
        model: result.model,
        latencyMs: result.latencyMs,
        usage: result.usage,
      },
      message: 'Generated with Gemini — review before saving',
    });
  } catch (error) {
    next(error);
  }
};

/** Approve & save generated package to an AeoPage (+ optional FAQs) */
export const applyGeminiToPage = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const pathRaw = (payload.path || payload.canonicalSuggestion || '').trim();
    if (!pathRaw) return res.status(400).json({ success: false, message: 'Path is required to save' });
    const path = pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`;

    const doc = await getOrCreateConfig();
    const config = mergeConfig(doc.config);

    const pageFields = {
      path,
      title: payload.title || payload.h1 || payload.metaTitle || path,
      pageType: payload.pageType || 'custom',
      metaTitle: payload.metaTitle || '',
      metaDescription: payload.metaDescription || '',
      focusKeyword: payload.focusKeyword || '',
      secondaryKeywords: payload.secondaryKeywords || [],
      canonicalUrl: payload.canonicalUrl || `${config.canonicalBaseUrl || getBaseUrl()}${path}`,
      ogTitle: payload.ogTitle || '',
      ogDescription: payload.ogDescription || '',
      h1: payload.h1 || '',
      headings: payload.headings || [],
      directAnswer: payload.directAnswer || '',
      aiSummary: payload.aiSummary || '',
      entities: payload.entities || [],
      internalLinks: payload.internalLinks || [],
      customJsonLd: payload.customJsonLd || (payload.jsonLd ? JSON.stringify(payload.jsonLd) : ''),
      robots: payload.robots || 'index,follow',
      generatedByGemini: true,
      lastGeminiAt: new Date(),
    };

    const scored = scorePageOptimization(pageFields, config);
    pageFields.score = scored.score;
    pageFields.suggestions = scored.suggestions;
    pageFields.lastScoredAt = new Date();
    pageFields.status = scored.score >= 85 ? 'optimized' : 'needs_work';

    let page = await AeoPage.findOne({ path });
    if (page) Object.assign(page, pageFields);
    else page = new AeoPage(pageFields);
    await page.save();

    const createdFaqs = [];
    if (Array.isArray(payload.faqs) && payload.saveFaqs !== false) {
      for (const f of payload.faqs.slice(0, 10)) {
        if (!f.question || !f.answer) continue;
        const faq = await AeoFaq.create({
          question: f.question,
          answer: f.answer,
          pagePath: path,
          pageType: pageFields.pageType,
          entityTags: payload.entities || [],
          includeInSchema: true,
          isActive: true,
        });
        createdFaqs.push(faq);
      }
      if (createdFaqs.length) {
        page.faqIds = createdFaqs.map((f) => f._id);
        await page.save();
      }
    }

    if (Array.isArray(payload.entities) && payload.saveEntities !== false) {
      for (const name of payload.entities.slice(0, 12)) {
        if (!name?.trim()) continue;
        const exists = await AeoEntity.findOne({ name: name.trim() });
        if (!exists) {
          await AeoEntity.create({ name: name.trim(), type: 'topic', isActive: true });
        }
      }
    }

    await logUsage({
      user: req.user?._id,
      action: 'apply_page',
      model: config.geminiModel,
      topic: pageFields.title,
      success: true,
      targetType: 'page',
      targetId: String(page._id),
    });

    res.json({
      success: true,
      data: { page, faqsCreated: createdFaqs.length },
      message: 'Approved and saved to page optimization',
    });
  } catch (error) {
    next(error);
  }
};

/** Apply generated fields onto an Article (for article editor) */
export const applyGeminiToArticle = async (req, res, next) => {
  try {
    const { articleId, ...payload } = req.body || {};
    if (!articleId) return res.status(400).json({ success: false, message: 'articleId required' });

    const article = await Article.findById(articleId);
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });

    article.seoTitle = payload.metaTitle ?? article.seoTitle;
    article.metaDescription = payload.metaDescription ?? article.metaDescription;
    article.focusKeyword = payload.focusKeyword ?? article.focusKeyword;
    article.secondaryKeywords = payload.secondaryKeywords ?? article.secondaryKeywords;
    article.ogTitle = payload.ogTitle ?? article.ogTitle;
    article.ogDescription = payload.ogDescription ?? article.ogDescription;
    article.directAnswer = payload.directAnswer ?? article.directAnswer;
    article.aiSummary = payload.aiSummary ?? article.aiSummary;
    article.entities = payload.entities ?? article.entities;
    article.aeoHeadings = payload.headings ?? article.aeoHeadings;
    article.internalLinks = payload.internalLinks ?? article.internalLinks;
    article.faqs = payload.faqs ?? article.faqs;
    article.customJsonLd = payload.customJsonLd || (payload.jsonLd ? JSON.stringify(payload.jsonLd) : article.customJsonLd);
    article.robots = payload.robots ?? article.robots;
    if (payload.canonicalSuggestion && !article.canonicalUrl) {
      article.canonicalUrl = payload.canonicalSuggestion.startsWith('http')
        ? payload.canonicalSuggestion
        : `${getBaseUrl()}${payload.canonicalSuggestion.startsWith('/') ? '' : '/'}${payload.canonicalSuggestion}`;
    }

    const doc = await getOrCreateConfig();
    const scored = scoreArticleOptimization(article.toObject(), mergeConfig(doc.config));
    article.aeoScore = scored.score;
    article.aeoSuggestions = scored.suggestions;
    article.aeoScoredAt = new Date();
    await article.save();

    await logUsage({
      user: req.user?._id,
      action: 'apply_article',
      topic: article.title,
      success: true,
      targetType: 'article',
      targetId: String(article._id),
    });

    res.json({ success: true, data: article, message: 'Applied to article (not published yet — save from editor if needed)' });
  } catch (error) {
    next(error);
  }
};

export const getGeminiUsage = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await AeoUsage.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'name email role')
      .lean();
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
