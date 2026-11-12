import PageContent from '../models/PageContent.js';
import {
  ABOUT_PAGE_DEFAULTS,
  mergeAboutContent,
  validateAboutContent,
} from '../config/aboutPageDefaults.js';
import {
  STATIC_LEGAL_PAGES,
  STATIC_LEGAL_DEFAULTS,
  isStaticLegalSlug,
  mergeStaticLegalContent,
  validateStaticLegalContent,
  getStaticLegalMeta,
} from '../config/staticLegalPages.js';

const ABOUT_SLUG = 'about';

const ensureAboutPage = async () => {
  let page = await PageContent.findOne({ slug: ABOUT_SLUG });
  if (!page) {
    page = await PageContent.create({
      slug: ABOUT_SLUG,
      title: ABOUT_PAGE_DEFAULTS.meta.pageTitle,
      content: ABOUT_PAGE_DEFAULTS,
      isPublished: true,
    });
  }
  return page;
};

const ensureLegalPage = async (slug) => {
  const defaults = STATIC_LEGAL_DEFAULTS[slug];
  if (!defaults) return null;

  let page = await PageContent.findOne({ slug });
  if (!page) {
    page = await PageContent.create({
      slug,
      title: defaults.pageTitle,
      content: defaults,
      isPublished: true,
    });
  }
  return page;
};

const ensureAllLegalPages = async () => {
  await Promise.all(STATIC_LEGAL_PAGES.map((p) => ensureLegalPage(p.slug)));
};

export const getPublicAboutPage = async (req, res, next) => {
  try {
    const page = await PageContent.findOne({ slug: ABOUT_SLUG, isPublished: true });
    const content = mergeAboutContent(page?.content);

    res.json({
      success: true,
      data: {
        slug: ABOUT_SLUG,
        title: page?.title || ABOUT_PAGE_DEFAULTS.meta.pageTitle,
        content,
        updatedAt: page?.updatedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicLegalPage = async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!isStaticLegalSlug(slug)) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    const page = await PageContent.findOne({ slug, isPublished: true });
    const content = mergeStaticLegalContent(slug, page?.content);
    const meta = getStaticLegalMeta(slug);

    res.json({
      success: true,
      data: {
        slug,
        title: page?.title || content.pageTitle,
        path: meta?.path || `/${slug}`,
        content,
        updatedAt: page?.updatedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** @deprecated alias — marketplace disclaimer uses generic legal pages */
export const getPublicMarketplaceDisclaimer = async (req, res, next) => {
  req.params.slug = 'marketplace-disclaimer';
  return getPublicLegalPage(req, res, next);
};

export const getAdminPages = async (req, res, next) => {
  try {
    await ensureAboutPage();
    await ensureAllLegalPages();
    const pages = await PageContent.find().sort({ title: 1 }).select('slug title isPublished updatedAt');
    res.json({
      success: true,
      data: pages,
      catalog: [
        { slug: 'about', label: 'About Us', path: '/about' },
        ...STATIC_LEGAL_PAGES,
      ],
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminPageBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (slug === ABOUT_SLUG) {
      const page = await ensureAboutPage();
      return res.json({
        success: true,
        data: {
          ...page.toObject(),
          content: mergeAboutContent(page.content),
        },
      });
    }

    if (isStaticLegalSlug(slug)) {
      const page = await ensureLegalPage(slug);
      return res.json({
        success: true,
        data: {
          ...page.toObject(),
          content: mergeStaticLegalContent(slug, page.content),
          meta: getStaticLegalMeta(slug),
        },
      });
    }

    const page = await PageContent.findOne({ slug });
    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }
    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
};

export const upsertAboutPage = async (req, res, next) => {
  try {
    const { title, content, isPublished = true } = req.body;
    const merged = mergeAboutContent(content);
    const errors = validateAboutContent(merged);

    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const page = await PageContent.findOneAndUpdate(
      { slug: ABOUT_SLUG },
      {
        slug: ABOUT_SLUG,
        title: (title || merged.meta?.pageTitle || ABOUT_PAGE_DEFAULTS.meta.pageTitle).trim(),
        content: merged,
        isPublished: Boolean(isPublished),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'About Us page saved',
      data: {
        ...page.toObject(),
        content: mergeAboutContent(page.content),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const upsertLegalPage = async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!isStaticLegalSlug(slug)) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    const { title, content, isPublished = true } = req.body;
    const merged = mergeStaticLegalContent(slug, content);
    const errors = validateStaticLegalContent(merged);

    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const page = await PageContent.findOneAndUpdate(
      { slug },
      {
        slug,
        title: (title || merged.pageTitle).trim(),
        content: merged,
        isPublished: Boolean(isPublished),
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: `${merged.pageTitle} saved`,
      data: {
        ...page.toObject(),
        content: mergeStaticLegalContent(slug, page.content),
        meta: getStaticLegalMeta(slug),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const upsertMarketplaceDisclaimerPage = async (req, res, next) => {
  req.params.slug = 'marketplace-disclaimer';
  return upsertLegalPage(req, res, next);
};
