/**
 * Backfill published articles with sample audio reader + YouTube links.
 * Run: npm run update-article-media
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Article from '../models/Article.js';
import { ARTICLE_STATUS } from '../config/constants.js';

dotenv.config();

const SAMPLE_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
const SAMPLE_YOUTUBE = 'https://www.youtube.com/watch?v=21X5lGlDOfg';

const connect = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
};

const run = async () => {
  await connect();
  console.log('Updating articles with audio reader and YouTube links…');

  const published = await Article.find({
    status: ARTICLE_STATUS.PUBLISHED,
  }).sort({ publishedAt: -1 });

  let updated = 0;
  for (let i = 0; i < published.length; i++) {
    const article = published[i];
    const patch = {
      audioReader: article.audioReader?.trim() ? article.audioReader : SAMPLE_AUDIO,
      youtubeVideoLink: article.youtubeVideoLink?.trim() ? article.youtubeVideoLink : SAMPLE_YOUTUBE,
      isMustWatch: i < 6 ? true : Boolean(article.isMustWatch),
    };
    await Article.updateOne({ _id: article._id }, { $set: patch });
    updated += 1;
  }

  const mustWatchCount = await Article.countDocuments({
    status: ARTICLE_STATUS.PUBLISHED,
    isMustWatch: true,
  });

  console.log(`Updated ${updated} published article(s).`);
  console.log(`Must Watch articles: ${mustWatchCount}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
