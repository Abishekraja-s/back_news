/**
 * Create albums from today's (or latest) published news featured images.
 * Usage: node scripts/seedAlbumsFromTodayNews.js
 */
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Album from '../models/Album.js';
import AlbumImage from '../models/AlbumImage.js';
import AlbumCategory from '../models/AlbumCategory.js';
import Article from '../models/Article.js';
import { ARTICLE_STATUS } from '../config/constants.js';
import slugify from 'slugify';

dotenv.config();

const getTodayRangeIST = () => {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();
  const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0) - istOffsetMs);
  const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - istOffsetMs);
  return {
    startUtc,
    endUtc,
    labelDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  };
};

const syncImageCount = async (albumId) => {
  const count = await AlbumImage.countDocuments({ album: albumId });
  await Album.findByIdAndUpdate(albumId, { imageCount: count });
};

async function main() {
  await connectDB();
  const { startUtc, endUtc, labelDate } = getTodayRangeIST();
  const limit = 20;

  let articles = await Article.find({
    status: ARTICLE_STATUS.PUBLISHED,
    featuredImage: { $exists: true, $nin: [null, ''] },
    $or: [
      { publishedAt: { $gte: startUtc, $lte: endUtc } },
      { publishedAt: null, createdAt: { $gte: startUtc, $lte: endUtc } },
    ],
  })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit)
    .select('title slug excerpt featuredImage imageAlt imageCaption publishedAt')
    .lean();

  let usedFallback = false;
  if (!articles.length) {
    usedFallback = true;
    articles = await Article.find({
      status: ARTICLE_STATUS.PUBLISHED,
      featuredImage: { $exists: true, $nin: [null, ''] },
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .select('title slug excerpt featuredImage imageAlt imageCaption publishedAt')
      .lean();
  }

  console.log(`Articles found: ${articles.length}${usedFallback ? ' (latest fallback)' : ' (today)'}`);
  if (!articles.length) {
    console.log('Nothing to seed.');
    process.exit(0);
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
    console.log('Created category: Today\'s News');
  }

  const combinedTitle = usedFallback ? 'Latest News Photos' : `Today's News — ${labelDate}`;
  const combinedSlug = usedFallback ? 'latest-news-photos' : `todays-news-${labelDate}`;
  let combined = await Album.findOne({ slug: combinedSlug });
  if (!combined) {
    combined = await Album.create({
      title: combinedTitle,
      slug: combinedSlug,
      description: usedFallback
        ? 'Photo gallery from the latest published news stories.'
        : `News photo gallery for ${labelDate}.`,
      category: category._id,
      coverImage: articles[0].featuredImage,
      albumDate: articles[0].publishedAt || new Date(),
      status: 'published',
      displayOrder: 0,
    });
    console.log('Created combined album:', combined.title);
  }

  let order = await AlbumImage.countDocuments({ album: combined._id });
  let combinedAdded = 0;
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
  console.log(`Combined album images added: ${combinedAdded}`);

  let created = 0;
  let skipped = 0;
  for (const article of articles) {
    const url = String(article.featuredImage || '').trim();
    if (!url) continue;
    const stableSlug = `news-${article.slug}`.slice(0, 120);
    const existing = await Album.findOne({ slug: stableSlug }).select('_id').lean();
    if (existing) {
      skipped += 1;
      continue;
    }
    let slug = stableSlug;
    if (!slugify(slug, { lower: true, strict: true })) {
      slug = `news-album-${Date.now()}-${created}`;
    }
    const album = await Album.create({
      title: article.title,
      slug,
      description: article.excerpt || `Photo album from news: ${article.title}`,
      category: category._id,
      coverImage: url,
      albumDate: article.publishedAt || new Date(),
      status: 'published',
      displayOrder: created + 1,
      imageCount: 1,
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
    created += 1;
    console.log(' +', album.title.slice(0, 70));
  }

  console.log(`Done. albumsCreated=${created} skipped=${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
