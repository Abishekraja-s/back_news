import slugify from 'slugify';
import fs from 'fs';
import mongoose from 'mongoose';
import Album from '../models/Album.js';
import AlbumImage from '../models/AlbumImage.js';
import AlbumCategory from '../models/AlbumCategory.js';
import Article from '../models/Article.js';
import { ARTICLE_STATUS } from '../config/constants.js';
import { paginate } from '../utils/helpers.js';
import {
  processAlbumImage,
  deleteAlbumImageFiles,
  deleteAlbumFolder,
} from '../utils/albumImageProcessor.js';

/** Start of "today" in IST (UTC+5:30) */
const getTodayRangeIST = () => {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();
  const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0) - istOffsetMs);
  const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - istOffsetMs);
  return { startUtc, endUtc, labelDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
};

const generateAlbumSlug = async (title, excludeId = null) => {
  let baseSlug = slugify(title, { lower: true, strict: true, locale: 'ta' });
  if (!baseSlug) {
    baseSlug = slugify(title, { lower: true, strict: false }) || `album-${Date.now()}`;
  }
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await Album.findOne(query).select('_id').lean();
    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return slug;
};

const syncImageCount = async (albumId) => {
  const count = await AlbumImage.countDocuments({ album: albumId });
  await Album.findByIdAndUpdate(albumId, { imageCount: count });
  return count;
};

const populateAlbum = (query) =>
  query
    .populate('category', 'name slug')
    .populate('createdBy', 'name email');

/* ─── Public ─────────────────────────────────────────────── */

export const getPublicAlbums = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit || 12);
    const query = { status: 'published' };
    if (req.query.category) {
      const catFilter = { isActive: true };
      if (mongoose.isValidObjectId(req.query.category)) {
        catFilter.$or = [{ _id: req.query.category }, { slug: req.query.category }];
      } else {
        catFilter.slug = req.query.category;
      }
      const cat = await AlbumCategory.findOne(catFilter).select('_id');
      if (cat) query.category = cat._id;
      else return res.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 1 } });
    }
    if (req.query.search) {
      const q = String(req.query.search).trim();
      if (q) {
        query.$or = [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
        ];
      }
    }

    const [albums, total] = await Promise.all([
      populateAlbum(
        Album.find(query)
          .sort({ displayOrder: 1, albumDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
      ).lean(),
      Album.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: albums,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicAlbumBySlug = async (req, res, next) => {
  try {
    const album = await populateAlbum(
      Album.findOne({ slug: req.params.slug, status: 'published' })
    ).lean();
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }
    const images = await AlbumImage.find({ album: album._id })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, data: { ...album, images } });
  } catch (error) {
    next(error);
  }
};

export const getPublicCategories = async (req, res, next) => {
  try {
    const categories = await AlbumCategory.find({ isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

/* ─── Admin albums ───────────────────────────────────────── */

export const getAdminAlbums = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit || 20);
    const query = {};
    if (req.query.status && ['draft', 'published'].includes(req.query.status)) {
      query.status = req.query.status;
    }
    if (req.query.category) query.category = req.query.category;
    if (req.query.search) {
      const q = String(req.query.search).trim();
      if (q) {
        query.$or = [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
        ];
      }
    }

    const [albums, total] = await Promise.all([
      populateAlbum(
        Album.find(query)
          .sort({ displayOrder: 1, updatedAt: -1 })
          .skip(skip)
          .limit(limit)
      ).lean(),
      Album.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: albums,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminAlbumById = async (req, res, next) => {
  try {
    const album = await populateAlbum(Album.findById(req.params.id)).lean();
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }
    const images = await AlbumImage.find({ album: album._id })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, data: { ...album, images } });
  } catch (error) {
    next(error);
  }
};

export const createAlbum = async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ success: false, message: 'Album title is required' });
    }
    const slug = await generateAlbumSlug(title);
    const album = await Album.create({
      title,
      slug,
      description: String(req.body.description || '').trim(),
      category: req.body.category || null,
      coverImage: String(req.body.coverImage || '').trim(),
      albumDate: req.body.albumDate ? new Date(req.body.albumDate) : new Date(),
      status: req.body.status === 'published' ? 'published' : 'draft',
      displayOrder: Number(req.body.displayOrder) || 0,
      createdBy: req.user?._id,
    });
    const populated = await populateAlbum(Album.findById(album._id)).lean();
    res.status(201).json({ success: true, data: { ...populated, images: [] } });
  } catch (error) {
    next(error);
  }
};

export const updateAlbum = async (req, res, next) => {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    if (req.body.title != null) {
      const title = String(req.body.title).trim();
      if (!title) {
        return res.status(400).json({ success: false, message: 'Album title is required' });
      }
      if (title !== album.title) {
        album.title = title;
        album.slug = await generateAlbumSlug(title, album._id);
      }
    }
    if (req.body.description != null) album.description = String(req.body.description).trim();
    if (req.body.category !== undefined) {
      album.category = req.body.category || null;
    }
    if (req.body.coverImage != null) album.coverImage = String(req.body.coverImage).trim();
    if (req.body.albumDate != null) {
      album.albumDate = req.body.albumDate ? new Date(req.body.albumDate) : album.albumDate;
    }
    if (req.body.status != null && ['draft', 'published'].includes(req.body.status)) {
      album.status = req.body.status;
    }
    if (req.body.displayOrder != null) {
      album.displayOrder = Number(req.body.displayOrder) || 0;
    }

    await album.save();
    const populated = await populateAlbum(Album.findById(album._id)).lean();
    const images = await AlbumImage.find({ album: album._id })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, data: { ...populated, images } });
  } catch (error) {
    next(error);
  }
};

export const toggleAlbumPublish = async (req, res, next) => {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }
    album.status = album.status === 'published' ? 'draft' : 'published';
    await album.save();
    res.json({ success: true, data: album });
  } catch (error) {
    next(error);
  }
};

export const deleteAlbum = async (req, res, next) => {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }
    const images = await AlbumImage.find({ album: album._id });
    for (const img of images) deleteAlbumImageFiles(img);
    await AlbumImage.deleteMany({ album: album._id });
    deleteAlbumFolder(album._id);
    await album.deleteOne();
    res.json({ success: true, message: 'Album deleted' });
  } catch (error) {
    next(error);
  }
};

/* ─── Images ─────────────────────────────────────────────── */

export const uploadAlbumImagesHandler = async (req, res, next) => {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    }

    const last = await AlbumImage.findOne({ album: album._id })
      .sort({ displayOrder: -1 })
      .select('displayOrder')
      .lean();
    let order = (last?.displayOrder ?? -1) + 1;
    const created = [];

    for (const file of files) {
      try {
        const processed = await processAlbumImage(file.path, {
          albumId: album._id,
          originalName: file.originalname,
        });
        const doc = await AlbumImage.create({
          album: album._id,
          url: processed.url,
          webpUrl: processed.webpUrl,
          thumbnailUrl: processed.thumbnailUrl,
          filename: processed.filename,
          originalName: file.originalname,
          mimeType: processed.mimeType,
          size: processed.size,
          width: processed.width,
          height: processed.height,
          displayOrder: order,
          caption: '',
        });
        created.push(doc);
        order += 1;
      } catch (err) {
        if (file.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch {
            /* ignore */
          }
        }
        console.error('Album image process failed:', err.message);
      }
    }

    if (!created.length) {
      return res.status(400).json({
        success: false,
        message: 'Could not process any images. Use JPG, PNG or WebP under 12 MB.',
      });
    }

    if (!album.coverImage) {
      album.coverImage = created[0].thumbnailUrl || created[0].url;
      await album.save();
    }
    await syncImageCount(album._id);

    res.status(201).json({
      success: true,
      data: created,
      message: `${created.length} image(s) uploaded and optimized`,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAlbumImage = async (req, res, next) => {
  try {
    const image = await AlbumImage.findById(req.params.imageId);
    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    if (req.body.caption != null) image.caption = String(req.body.caption).trim();
    if (req.body.displayOrder != null) image.displayOrder = Number(req.body.displayOrder) || 0;
    await image.save();
    res.json({ success: true, data: image });
  } catch (error) {
    next(error);
  }
};

export const reorderAlbumImages = async (req, res, next) => {
  try {
    const albumId = req.params.id;
    const order = Array.isArray(req.body.order) ? req.body.order : [];
    if (!order.length) {
      return res.status(400).json({ success: false, message: 'order array is required' });
    }
    await Promise.all(
      order.map((id, index) =>
        AlbumImage.updateOne({ _id: id, album: albumId }, { displayOrder: index })
      )
    );
    const images = await AlbumImage.find({ album: albumId })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, data: images });
  } catch (error) {
    next(error);
  }
};

export const setAlbumCover = async (req, res, next) => {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }
    let cover = String(req.body.coverImage || '').trim();
    if (req.body.imageId) {
      const image = await AlbumImage.findOne({ _id: req.body.imageId, album: album._id });
      if (!image) {
        return res.status(404).json({ success: false, message: 'Image not found in this album' });
      }
      cover = image.url || image.webpUrl || image.thumbnailUrl;
    }
    if (!cover) {
      return res.status(400).json({ success: false, message: 'coverImage or imageId is required' });
    }
    album.coverImage = cover;
    await album.save();
    res.json({ success: true, data: album });
  } catch (error) {
    next(error);
  }
};

export const deleteAlbumImage = async (req, res, next) => {
  try {
    const image = await AlbumImage.findById(req.params.imageId);
    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }
    const albumId = image.album;
    deleteAlbumImageFiles(image);
    await image.deleteOne();
    await syncImageCount(albumId);

    const album = await Album.findById(albumId);
    if (album?.coverImage) {
      const stillUsed =
        album.coverImage === image.url ||
        album.coverImage === image.webpUrl ||
        album.coverImage === image.thumbnailUrl;
      if (stillUsed) {
        const next = await AlbumImage.findOne({ album: albumId })
          .sort({ displayOrder: 1 })
          .lean();
        album.coverImage = next ? next.url || next.thumbnailUrl || '' : '';
        await album.save();
      }
    }

    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    next(error);
  }
};

/* ─── Categories ─────────────────────────────────────────── */

export const getAdminCategories = async (req, res, next) => {
  try {
    const categories = await AlbumCategory.find()
      .sort({ displayOrder: 1, name: 1 })
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
    let slug = slugify(name, { lower: true, strict: true, locale: 'ta' });
    if (!slug) slug = `album-cat-${Date.now()}`;
    const existing = await AlbumCategory.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const category = await AlbumCategory.create({
      name,
      slug,
      description: String(req.body.description || '').trim(),
      isActive: req.body.isActive !== false,
      displayOrder: Number(req.body.displayOrder) || 0,
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const category = await AlbumCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    if (req.body.name != null) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }
      category.name = name;
    }
    if (req.body.description != null) category.description = String(req.body.description).trim();
    if (req.body.isActive != null) category.isActive = Boolean(req.body.isActive);
    if (req.body.displayOrder != null) category.displayOrder = Number(req.body.displayOrder) || 0;
    await category.save();
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const category = await AlbumCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    const inUse = await Album.countDocuments({ category: category._id });
    if (inUse > 0) {
      return res.status(400).json({
        success: false,
        message: `Category is used by ${inUse} album(s). Reassign them first.`,
      });
    }
    await category.deleteOne();
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * Create / refresh albums from today's published news (featured images).
 * - Ensures "Today's News" category
 * - One combined gallery album for today
 * - One album per article that has a featured image (skip if already exists by slug)
 */
export const createFromTodayNews = async (req, res, next) => {
  try {
    const { startUtc, endUtc, labelDate } = getTodayRangeIST();
    const limit = Math.min(40, Math.max(5, parseInt(req.body?.limit, 10) || 20));

    let articles = await Article.find({
      status: ARTICLE_STATUS.PUBLISHED,
      featuredImage: { $exists: true, $nin: [null, ''] },
      $or: [
        { publishedAt: { $gte: startUtc, $lte: endUtc } },
        {
          publishedAt: { $in: [null] },
          createdAt: { $gte: startUtc, $lte: endUtc },
        },
      ],
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .select('title slug excerpt featuredImage imageAlt imageCaption publishedAt category')
      .populate('category', 'name slug')
      .lean();

    // Fallback: if nothing dated "today", use latest published with images
    let usedFallback = false;
    if (!articles.length) {
      usedFallback = true;
      articles = await Article.find({
        status: ARTICLE_STATUS.PUBLISHED,
        featuredImage: { $exists: true, $nin: [null, ''] },
      })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(limit)
        .select('title slug excerpt featuredImage imageAlt imageCaption publishedAt category')
        .populate('category', 'name slug')
        .lean();
    }

    if (!articles.length) {
      return res.status(404).json({
        success: false,
        message: 'No published news with images found to create albums',
      });
    }

    let category = await AlbumCategory.findOne({ slug: 'todays-news' });
    if (!category) {
      category = await AlbumCategory.create({
        name: "Today's News",
        slug: 'todays-news',
        description: 'Albums built from daily news photos',
        isActive: true,
        displayOrder: 0,
      });
    }

    const combinedTitle = usedFallback
      ? `Latest News Photos`
      : `Today's News — ${labelDate}`;
    const combinedSlugBase = usedFallback ? 'latest-news-photos' : `todays-news-${labelDate}`;
    let combined = await Album.findOne({ slug: combinedSlugBase });
    if (!combined) {
      combined = await Album.create({
        title: combinedTitle,
        slug: combinedSlugBase,
        description: usedFallback
          ? 'Photo gallery from the latest published news stories.'
          : `News photo gallery for ${labelDate}.`,
        category: category._id,
        coverImage: articles[0].featuredImage,
        albumDate: articles[0].publishedAt || new Date(),
        status: 'published',
        displayOrder: 0,
        createdBy: req.user?._id,
      });
    } else {
      combined.title = combinedTitle;
      combined.status = 'published';
      combined.category = category._id;
      if (!combined.coverImage) combined.coverImage = articles[0].featuredImage;
      await combined.save();
    }

    let combinedAdded = 0;
    let order = await AlbumImage.countDocuments({ album: combined._id });
    for (const article of articles) {
      const url = String(article.featuredImage || '').trim();
      if (!url) continue;
      const exists = await AlbumImage.findOne({ album: combined._id, url }).select('_id').lean();
      if (exists) continue;
      await AlbumImage.create({
        album: combined._id,
        url,
        webpUrl: url,
        thumbnailUrl: url,
        originalName: article.slug || 'news',
        caption: article.title,
        mimeType: 'image/jpeg',
        displayOrder: order,
      });
      order += 1;
      combinedAdded += 1;
    }
    await syncImageCount(combined._id);
    if (!combined.coverImage && articles[0]?.featuredImage) {
      combined.coverImage = articles[0].featuredImage;
      await combined.save();
    }

    const createdAlbums = [];
    let skipped = 0;
    for (const article of articles) {
      const url = String(article.featuredImage || '').trim();
      if (!url) continue;
      const slug = await generateAlbumSlug(`news-${article.slug}`);
      // Prefer stable slug from article
      const stableSlug = `news-${article.slug}`.slice(0, 120);
      let album = await Album.findOne({
        $or: [{ slug: stableSlug }, { slug: { $regex: `^news-${article.slug}` } }],
      });
      if (album) {
        skipped += 1;
        continue;
      }
      album = await Album.create({
        title: article.title,
        slug: stableSlug || slug,
        description: article.excerpt || `Photo album from news: ${article.title}`,
        category: category._id,
        coverImage: url,
        albumDate: article.publishedAt || new Date(),
        status: 'published',
        displayOrder: createdAlbums.length + 1,
        imageCount: 1,
        createdBy: req.user?._id,
      });
      await AlbumImage.create({
        album: album._id,
        url,
        webpUrl: url,
        thumbnailUrl: url,
        originalName: article.slug || 'news',
        caption: article.imageCaption || article.imageAlt || article.title,
        mimeType: 'image/jpeg',
        displayOrder: 0,
      });
      createdAlbums.push(album);
    }

    const populatedCombined = await populateAlbum(Album.findById(combined._id)).lean();

    res.status(201).json({
      success: true,
      message: usedFallback
        ? `Created albums from latest news (${articles.length} stories)`
        : `Created albums from today's news (${articles.length} stories)`,
      data: {
        usedFallback,
        articlesFound: articles.length,
        combinedAlbum: populatedCombined,
        combinedImagesAdded: combinedAdded,
        albumsCreated: createdAlbums.length,
        albumsSkipped: skipped,
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};
