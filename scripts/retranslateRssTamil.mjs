/**
 * Re-translate recent English RSS draft articles to Tamil (Gemini → MyMemory fallback).
 * Usage: node scripts/retranslateRssTamil.mjs [limit]
 */
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Article from '../models/Article.js';
import { translateNewsToTamil } from '../services/rssTranslateService.js';

const hasTamil = (s = '') => /[\u0B80-\u0BFF]/.test(String(s || ''));
const limit = Math.min(50, Math.max(1, parseInt(process.argv[2], 10) || 20));

await mongoose.connect(process.env.MONGODB_URI);

const items = await Article.find({
  importSource: 'rss',
  status: { $in: ['DRAFT', 'PENDING'] },
})
  .sort({ createdAt: -1 })
  .limit(limit)
  .select('title excerpt content tags')
  .lean();

let updated = 0;
let skipped = 0;
let failed = 0;

for (const row of items) {
  if (hasTamil(row.title)) {
    skipped += 1;
    continue;
  }
  try {
    const ta = await translateNewsToTamil({
      title: row.title,
      excerpt: row.excerpt || '',
      content: row.content || row.excerpt || '',
    });
    if (!ta?.title || !hasTamil(ta.title)) {
      failed += 1;
      console.log('fail', row._id, row.title.slice(0, 60));
      continue;
    }
    const tags = Array.isArray(row.tags) ? [...row.tags] : [];
    if (!tags.includes('தமிழ்')) tags.push('தமிழ்');
    if (!tags.includes('tamil')) tags.push('tamil');

    await Article.updateOne(
      { _id: row._id },
      {
        $set: {
          title: ta.title,
          excerpt: ta.excerpt || row.excerpt,
          content: ta.contentHtml || row.content,
          seoTitle: String(ta.title).slice(0, 70),
          metaDescription: String(ta.excerpt || row.excerpt || '').slice(0, 160),
          ogTitle: String(ta.title).slice(0, 70),
          ogDescription: String(ta.excerpt || row.excerpt || '').slice(0, 160),
          twitterTitle: String(ta.title).slice(0, 70),
          twitterDescription: String(ta.excerpt || row.excerpt || '').slice(0, 160),
          aiSummary: ta.excerpt || row.excerpt,
          directAnswer: ta.excerpt || row.excerpt,
          tags: tags.slice(0, 12),
        },
      }
    );
    updated += 1;
    console.log('ok', updated, ta.title.slice(0, 70));
  } catch (err) {
    failed += 1;
    console.warn('err', row._id, err.message);
  }
}

console.log(JSON.stringify({ total: items.length, updated, skipped, failed }, null, 2));
await mongoose.disconnect();
