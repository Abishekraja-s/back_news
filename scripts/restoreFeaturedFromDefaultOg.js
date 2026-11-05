/**
 * Undo accidental featuredImage = default-og-image (listing cards all looked the same).
 * Restores unique picsum seeds for on-site display; keeps ogImage as site default
 * so WhatsApp previews stay crawler-safe (picsum returns 405 to WA bots).
 *
 * Usage: node scripts/restoreFeaturedFromDefaultOg.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const DEFAULT_OG = 'https://thegreatindianews.netlify.app/assets/images/default-og-image.jpg';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const col = mongoose.connection.collection('articles');

  const docs = await col
    .find(
      { featuredImage: /default-og-image\.jpg/i },
      { projection: { _id: 1, slug: 1, featuredImage: 1, ogImage: 1 } }
    )
    .toArray();

  console.log('to_restore=', docs.length);

  let modified = 0;
  for (const doc of docs) {
    const slug = doc.slug || String(doc._id);
    const featured = `https://picsum.photos/seed/${encodeURIComponent(slug)}/800/450`;
    const res = await col.updateOne(
      { _id: doc._id },
      {
        $set: {
          featuredImage: featured,
          // Social crawlers: keep site JPEG (WhatsApp cannot fetch picsum)
          ogImage: DEFAULT_OG,
          twitterImage: DEFAULT_OG,
        },
      }
    );
    if (res.modifiedCount) modified += 1;
  }

  console.log('modified=', modified);
  const sample = await col.findOne(
    { slug: 'article-5-5' },
    { projection: { slug: 1, featuredImage: 1, ogImage: 1 } }
  );
  console.log('sample=', JSON.stringify(sample));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
