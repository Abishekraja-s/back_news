import MarketplaceCategory from '../models/MarketplaceCategory.js';

export const DEFAULT_MARKETPLACE_CATEGORIES = [
  'Electronics',
  'Mobiles',
  'Computers',
  'Cars',
  'Bikes',
  'Appliances',
  'Furniture',
  'Fashion',
  'Sports',
  'Books',
];

const toSlug = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'category';

/** Ensure default marketplace categories exist (safe to run on every boot). */
export const seedMarketplaceCategories = async () => {
  let created = 0;
  for (let i = 0; i < DEFAULT_MARKETPLACE_CATEGORIES.length; i += 1) {
    const name = DEFAULT_MARKETPLACE_CATEGORIES[i];
    const slug = toSlug(name);
    const existing = await MarketplaceCategory.findOne({
      $or: [{ slug }, { name }],
    });
    if (existing) continue;
    await MarketplaceCategory.create({
      name,
      slug,
      isActive: true,
      sortOrder: i + 1,
    });
    created += 1;
  }
  return { created };
};

export const getPublicCategories = async (req, res, next) => {
  try {
    const categories = await MarketplaceCategory.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('name slug sortOrder')
      .lean();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export const getAdminCategories = async (req, res, next) => {
  try {
    const categories = await MarketplaceCategory.find()
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    const slug = toSlug(req.body.slug || name);
    const exists = await MarketplaceCategory.findOne({ $or: [{ name }, { slug }] });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }
    const maxOrder = await MarketplaceCategory.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    const category = await MarketplaceCategory.create({
      name,
      slug,
      isActive: req.body.isActive !== false,
      sortOrder: Number(req.body.sortOrder) || (maxOrder?.sortOrder || 0) + 1,
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const category = await MarketplaceCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }
      category.name = name;
      if (!req.body.slug) category.slug = toSlug(name);
    }
    if (req.body.slug !== undefined) category.slug = toSlug(req.body.slug);
    if (req.body.isActive !== undefined) category.isActive = Boolean(req.body.isActive);
    if (req.body.sortOrder !== undefined) category.sortOrder = Number(req.body.sortOrder) || 0;
    await category.save();
    res.json({ success: true, data: category });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, message: 'Category name or slug already exists' });
    }
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const category = await MarketplaceCategory.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
};
