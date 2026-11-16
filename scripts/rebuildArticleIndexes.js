/**
 * Drop & recreate articles indexes so WiredTiger reclaims unused index space.
 * Safe: keeps unique slug + query indexes used by the app.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const mb = (n) => `${(n / (1024 * 1024)).toFixed(2)} MB`;

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const articles = db.collection('articles');

const before = await db.command({ dbStats: 1 });
console.log('Before total:', mb(before.dataSize + before.indexSize), '| index:', mb(before.indexSize));

const existing = await articles.indexes();
console.log(
  'Current indexes:',
  existing.map((i) => i.name).join(', ')
);

const droppable = existing.map((i) => i.name).filter((n) => n !== '_id_');
for (const name of droppable) {
  try {
    await articles.dropIndex(name);
    console.log('Dropped', name);
  } catch (e) {
    console.log('Skip', name, e.message);
  }
}

console.log('Recreating indexes…');
await articles.createIndexes([
  { key: { slug: 1 }, name: 'slug_1', unique: true },
  { key: { status: 1, publishedAt: -1 }, name: 'status_1_publishedAt_-1' },
  { key: { category: 1, status: 1, publishedAt: -1 }, name: 'category_1_status_1_publishedAt_-1' },
  { key: { author: 1 }, name: 'author_1' },
  { key: { tags: 1 }, name: 'tags_1' },
  { key: { views: -1 }, name: 'views_-1' },
  { key: { isFeatured: 1, status: 1 }, name: 'isFeatured_1_status_1' },
  { key: { isMustWatch: 1, status: 1, publishedAt: -1 }, name: 'isMustWatch_1_status_1_publishedAt_-1' },
  { key: { importSource: 1, importGuid: 1 }, name: 'importSource_1_importGuid_1' },
  {
    key: { title: 'text', excerpt: 'text', content: 'text', tags: 'text' },
    name: 'title_text_excerpt_text_content_text_tags_text',
    weights: { title: 10, excerpt: 5, tags: 3, content: 1 },
    default_language: 'none',
  },
]);

const after = await db.command({ dbStats: 1 });
const coll = await db.command({ collStats: 'articles' });
console.log('After total:', mb(after.dataSize + after.indexSize), '| index:', mb(after.indexSize));
console.log('articles count:', coll.count, '| article index:', mb(coll.totalIndexSize));
console.log('Done');

await mongoose.disconnect();
