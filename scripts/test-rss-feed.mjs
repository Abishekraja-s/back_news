import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);
await import('../models/Author.js');
await import('../models/Category.js');
await import('../models/Article.js');

const { generateRssXml, getRssSettings } = await import('../services/rssFeedService.js');

const tests = [
  ['main', () => generateRssXml({ feedPath: '/feed.xml' })],
  ['google-news', () => generateRssXml({ feedPath: '/feed/google-news.xml', googleNews: true })],
  ['politics', () => generateRssXml({ feedPath: '/feed/category/politics.xml', categorySlug: 'politics' })],
  ['invalid-cat', () => generateRssXml({ feedPath: '/feed/category/not-a-real-slug-xyz.xml', categorySlug: 'not-a-real-slug-xyz' })],
];

const xml = await tests[0][1]();
const itemLink = xml.match(/<item>[\s\S]*?<link>([^<]+)<\/link>/)?.[1];
console.log('sample item link:', itemLink);

for (const [name, fn] of tests) {
  const xml = await fn();
  const hasRss = xml.startsWith('<?xml') && xml.includes('<rss') && xml.includes('</rss>');
  const items = (xml.match(/<item>/g) || []).length;
  console.log(name, hasRss ? 'OK' : 'FAIL', 'items:', items, 'bytes:', xml.length);
}

const settings = await getRssSettings();
console.log('enabled:', settings.enabled, 'limit:', settings.feedLimit);

await mongoose.disconnect();
