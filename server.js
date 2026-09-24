import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import articleRoutes from './routes/articleRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import authorRoutes from './routes/authorRoutes.js';
import breakingNewsRoutes from './routes/breakingNewsRoutes.js';
import advertisementRoutes from './routes/advertisementRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import userRoutes from './routes/userRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import featureRoutes from './routes/featureRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import aeoRoutes from './routes/aeoRoutes.js';
import youtubeRoutes from './routes/youtubeRoutes.js';
import instagramPostRoutes from './routes/instagramPostRoutes.js';
import googleNewsRoutes from './routes/googleNewsRoutes.js';
import adSenseRoutes from './routes/adSenseRoutes.js';
import travelNotificationRoutes from './routes/travelNotificationRoutes.js';
import sportsRoutes from './routes/sportsRoutes.js';
import governmentNotificationRoutes from './routes/governmentNotificationRoutes.js';
import matrimonyRoutes from './routes/matrimonyRoutes.js';
import pageContentRoutes from './routes/pageContentRoutes.js';
import seoRoutes from './routes/seoRoutes.js';
import syncFeatures from './utils/syncFeatures.js';
import { startYoutubeFetchJob } from './jobs/youtubeFetchJob.js';
import { startGoogleNewsFetchJob } from './jobs/googleNewsFetchJob.js';
import { startTravelFetchJob } from './jobs/travelFetchJob.js';
import { startSportsFetchJob } from './jobs/sportsFetchJob.js';
import { startGovernmentFetchJob } from './jobs/governmentFetchJob.js';
import { startRssIngestJob } from './jobs/rssIngestJob.js';
import rssIngestRoutes from './routes/rssIngestRoutes.js';
import shareRoutes from './routes/shareRoutes.js';
import astrologyRoutes from './routes/astrologyRoutes.js';
import { startAstrologySyncJob } from './jobs/astrologySyncJob.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // SPA loads GA4/GTM from googletagmanager.com — do not emit a restrictive
    // script-src CSP on API responses (some proxies/browsers inherit confusingly).
    contentSecurityPolicy: false,
  })
);

const getAllowedOrigins = () => {  const urls = process.env.CLIENT_URL || 'http://localhost:5173';
  return urls.split(',').map((u) => u.trim()).filter(Boolean);
};

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = getAllowedOrigins();
      if (!origin || allowed.includes(origin) || allowed.includes('*')) {
        callback(null, true);
      } else {
        callback(null, allowed[0]);
      }
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts' },
});

if (process.env.NODE_ENV === 'production') {
  app.use('/api/', limiter);
  app.use('/api/auth/login', authLimiter);
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    } else if (/\.(png|jpe?g|gif|webp)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/authors', authorRoutes);
app.use('/api/breaking-news', breakingNewsRoutes);
app.use('/api/advertisements', advertisementRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/aeo', aeoRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/instagram-posts', instagramPostRoutes);
app.use('/api/google-news', googleNewsRoutes);
app.use('/api/adsense', adSenseRoutes);
app.use('/api/travel-notifications', travelNotificationRoutes);
app.use('/api/sports', sportsRoutes);
app.use('/api/government-notifications', governmentNotificationRoutes);
app.use('/api/rss-ingest', rssIngestRoutes);
app.use('/api/matrimony', matrimonyRoutes);
app.use('/api/astrology', astrologyRoutes);
app.use('/api/pages', pageContentRoutes);
app.use('/share', shareRoutes);
app.use('/api/share', shareRoutes);
app.use('/', seoRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'The Great India News API is running' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  if (process.env.NODE_ENV !== 'production') {
    const User = (await import('./models/User.js')).default;
    const count = await User.countDocuments();
    if (count === 0) {
      console.log('Empty database — seeding dummy records...');
      const seed = (await import('./utils/seed.js')).default;
      await seed();
    }
  }

  try {
    const featureSync = await syncFeatures({ seedDemo: true });
    console.log(
      `Features synced — created: ${featureSync.created}, updated: ${featureSync.updated}, demo items: ${featureSync.demoCreated}`
    );
  } catch (err) {
    console.warn('Feature sync skipped:', err.message);
  }

  try {
    const { seedMarketplaceCategories } = await import('./controllers/marketplaceCategoryController.js');
    const catSeed = await seedMarketplaceCategories();
    if (catSeed.created) {
      console.log(`Marketplace categories seeded — created: ${catSeed.created}`);
    }
  } catch (err) {
    console.warn('Marketplace category seed skipped:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/health`);
    startYoutubeFetchJob();
    startGoogleNewsFetchJob();
    startTravelFetchJob();
    startSportsFetchJob();
    startGovernmentFetchJob();
    startRssIngestJob();
    startAstrologySyncJob();
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Close the other process or change PORT in .env`);
    } else {
      console.error('Server error:', err.message);
    }
    process.exit(1);
  });};

startServer().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

export default app;
