/**
 * Force-update marketplace-disclaimer PageContent from latest defaults.
 * Usage: node scripts/syncMarketplaceDisclaimer.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import PageContent from '../models/PageContent.js';
import { STATIC_LEGAL_DEFAULTS } from '../config/staticLegalPages.js';

const SLUG = 'marketplace-disclaimer';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  const content = STATIC_LEGAL_DEFAULTS[SLUG];
  await mongoose.connect(uri);

  const page = await PageContent.findOneAndUpdate(
    { slug: SLUG },
    {
      slug: SLUG,
      title: content.pageTitle,
      content,
      isPublished: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('updated=', page.slug, page.title);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
