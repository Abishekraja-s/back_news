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

  const items = await GoogleNewsItem.find({
    adminEdited: { $ne: true },
    $or: [
      { image: { $in: ['', null] } },
      { image: /picsum\.photos/i },
      { image: /googleusercontent\.com/i },
      { description: /Comprehensive, up-to-date news coverage/i },
      { $expr: { $lt: [{ $strLenCP: { $ifNull: ['$content', ''] } }, 120] } },
    ],
  })
    .sort({ publishedAt: -1 })
    .limit(limit);

  console.log(`Enriching up to ${items.length} items…`);

  let updated = 0;
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
    });

    const patch = {};
    if (meta.image && isValidImageUrl(meta.image) && !isGenericGoogleImage(meta.image)) {
      patch.image = meta.image;
    } else if (isGenericGoogleImage(item.image)) {
      patch.image = '';
    }
    if (meta.content && !isGenericGoogleDescription(meta.content) && meta.content.length > (item.content?.length || 0)) {
      patch.content = meta.content;
      patch.excerpt = meta.content;
    }
    if (meta.description && !isGenericGoogleDescription(meta.description) && meta.description.length > (item.description?.length || 0)) {
      patch.description = meta.description;
    }
    if (meta.sourceUrl && !item.sourceUrl) patch.sourceUrl = meta.sourceUrl;

    if (Object.keys(patch).length) {
      await GoogleNewsItem.updateOne({ _id: item._id }, { $set: patch });
      updated += 1;
      console.log('updated');
    } else {
      console.log('skipped');
    }
  }

  console.log(`Done. Updated ${updated} of ${items.length} items.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
