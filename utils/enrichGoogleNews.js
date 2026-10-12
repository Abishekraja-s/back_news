/**
 * Fetch real publisher images and fuller article text for existing Google News rows.
 * Run: npm run enrich-google-news
 * Optional batch size: npm run enrich-google-news -- 50
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import GoogleNewsItem from '../models/GoogleNewsItem.js';
import { enrichRssItem } from '../services/articleEnrichmentService.js';
import { isValidImageUrl } from '../services/googleNewsService.js';
import { isGenericGoogleImage, isGenericGoogleDescription } from '../services/googleNewsContentFilter.js';

dotenv.config();

const limit = Math.min(parseInt(process.argv[2], 10) || 999, 500);

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // Prefer missing images first (admin "No img" rows)
  const missingImageQuery = {
    adminEdited: { $ne: true },
    $or: [
      { image: { $in: ['', null] } },
      { image: /picsum\.photos/i },
      { image: /googleusercontent\.com/i },
    ],
  };

  let items = await GoogleNewsItem.find(missingImageQuery)
    .sort({ publishedAt: -1 })
    .limit(limit);

  if (items.length < limit) {
    const extra = await GoogleNewsItem.find({
      adminEdited: { $ne: true },
      _id: { $nin: items.map((i) => i._id) },
      $or: [
        { description: /Comprehensive, up-to-date news coverage/i },
        { $expr: { $lt: [{ $strLenCP: { $ifNull: ['$content', ''] } }, 120] } },
      ],
    })
      .sort({ publishedAt: -1 })
      .limit(limit - items.length);
    items = [...items, ...extra];
  }

  console.log(`Enriching up to ${items.length} items…`);

  let updated = 0;
  let imagesFixed = 0;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    process.stdout.write(`[${i + 1}/${items.length}] ${item.title.slice(0, 55).replace(/\s+/g, ' ')}… `);

    const meta = await enrichRssItem({
      link: item.link,
      image: isGenericGoogleImage(item.image) ? '' : item.image,
      description: item.description,
      descriptionHtml: item.descriptionHtml,
      content: item.content,
      excerpt: item.excerpt,
      sourceUrl: item.sourceUrl,
    });

    const patch = {};
    if (meta.image && isValidImageUrl(meta.image) && !isGenericGoogleImage(meta.image)) {
      patch.image = meta.image;
      imagesFixed += 1;
    } else if (isGenericGoogleImage(item.image) && item.image) {
      patch.image = '';
    }
    if (meta.content && !isGenericGoogleDescription(meta.content) && meta.content.length > (item.content?.length || 0)) {
      patch.content = meta.content;
      patch.excerpt = meta.content;
    }
    if (meta.description && !isGenericGoogleDescription(meta.description) && meta.description.length > (item.description?.length || 0)) {
      patch.description = meta.description;
    }
    if (meta.sourceUrl) {
      let weak = true;
      try {
        const u = new URL(String(item.sourceUrl || ''));
        weak = !u.pathname || u.pathname === '/';
      } catch {
        weak = true;
      }
      if (!item.sourceUrl || weak) patch.sourceUrl = meta.sourceUrl;
    }

    if (Object.keys(patch).length) {
      await GoogleNewsItem.updateOne({ _id: item._id }, { $set: patch });
      updated += 1;
      console.log(patch.image ? 'image+updated' : 'updated');
    } else {
      console.log('skipped');
    }
  }

  console.log(`Done. Updated ${updated} of ${items.length} items (${imagesFixed} images).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
