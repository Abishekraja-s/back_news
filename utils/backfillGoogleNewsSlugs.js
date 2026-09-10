/**
 * Backfill slugs and full text for Google News items (no truncation, no placeholder images).
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import GoogleNewsItem from '../models/GoogleNewsItem.js';
import { generateGoogleNewsSlug } from '../utils/helpers.js';
import { htmlToPlainText } from '../services/googleNewsService.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const items = await GoogleNewsItem.find().sort({ createdAt: 1 });
  let updated = 0;

  for (const item of items) {
    const patch = {};
    if (!item.slug) patch.slug = await generateGoogleNewsSlug(item.title, item._id);

    const fullText = item.description || htmlToPlainText(item.descriptionHtml) || item.title;
    if (fullText && !item.content) patch.content = fullText;
    if (fullText && !item.excerpt) patch.excerpt = fullText;
    if (item.descriptionHtml && !item.description) patch.description = htmlToPlainText(item.descriptionHtml);

    if (item.image?.includes('picsum.photos')) patch.image = '';

    if (Object.keys(patch).length) {
      await GoogleNewsItem.updateOne({ _id: item._id }, { $set: patch });
      updated += 1;
    }
  }

  console.log(`Processed ${items.length}, updated ${updated}.`);
  await mongoose.disconnect();
};

run().catch((e) => { console.error(e); process.exit(1); });
