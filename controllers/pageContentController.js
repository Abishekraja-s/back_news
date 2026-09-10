import PageContent from '../models/PageContent.js';
import {
  ABOUT_PAGE_DEFAULTS,
  mergeAboutContent,
  validateAboutContent,
} from '../config/aboutPageDefaults.js';

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

export const getAdminPages = async (req, res, next) => {
  try {
    await ensureAboutPage();
    const pages = await PageContent.find().sort({ title: 1 }).select('slug title isPublished updatedAt');
    res.json({ success: true, data: pages });
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
