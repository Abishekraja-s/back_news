/**
 * Repair Google News records: restore slugs, strip placeholder images, preserve full text.
 * Run: npm run repair-google-news
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import GoogleNewsItem from '../models/GoogleNewsItem.js';
import { generateGoogleNewsSlug } from '../utils/helpers.js';
import { htmlToPlainText, isValidImageUrl } from '../services/googleNewsService.js';
import { isGenericGoogleImage } from '../services/googleNewsContentFilter.js';

dotenv.config();

const extractImageFromHtml = (html = '') => {
  const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : '';
};

const isPlaceholderImage = (url = '') =>
  !url ||
  url.includes('picsum.photos') ||
  url.includes('great-india-news-default') ||
  isGenericGoogleImage(url);

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const items = await GoogleNewsItem.find().sort({ createdAt: 1 });
  let updated = 0;

  for (const item of items) {
    const patch = {};

    if (!item.slug) {
      patch.slug = await generateGoogleNewsSlug(item.title, item._id);
    }

    if (item.descriptionHtml && !item.description) {
      patch.description = htmlToPlainText(item.descriptionHtml);
    }

    const fullText = patch.description || item.description || htmlToPlainText(item.descriptionHtml);
    if (fullText && !item.content) patch.content = fullText;
    if (fullText && !item.excerpt) patch.excerpt = fullText;

    if (isPlaceholderImage(item.image)) {
      const fromHtml = extractImageFromHtml(item.descriptionHtml);
      patch.image = isValidImageUrl(fromHtml) ? fromHtml : '';
    } else if (item.image && !isValidImageUrl(item.image)) {
      patch.image = '';
    } else if (!item.image && item.descriptionHtml) {
      const fromHtml = extractImageFromHtml(item.descriptionHtml);
      if (isValidImageUrl(fromHtml)) patch.image = fromHtml;
    }

    if (Object.keys(patch).length) {
      await GoogleNewsItem.updateOne({ _id: item._id }, { $set: patch });
      updated += 1;
    }
  }

  console.log(`Processed ${items.length} items, repaired ${updated}.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
