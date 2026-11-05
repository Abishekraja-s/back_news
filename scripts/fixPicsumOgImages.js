/**
 * Replace picsum.photos article images with the site default OG JPEG.
 * WhatsApp crawlers get HTTP 405 from picsum and drop the link preview image.
 *
 * Usage: node scripts/fixPicsumOgImages.js
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

  const filter = {
    $or: [
      { featuredImage: /picsum\.photos/i },
      { ogImage: /picsum\.photos/i },
      { twitterImage: /picsum\.photos/i },
    ],
  };

  const before = await col.countDocuments(filter);
  console.log('articles_with_picsum=', before);

  const result = await col.updateMany(filter, [
    {
      $set: {
        featuredImage: {
          $cond: [
            {
              $regexMatch: {
                input: { $ifNull: ['$featuredImage', ''] },
                regex: 'picsum\\.photos',
                options: 'i',
              },
            },
            DEFAULT_OG,
            '$featuredImage',
          ],
        },
        ogImage: {
          $cond: [
            {
              $regexMatch: {
                input: { $ifNull: ['$ogImage', ''] },
                regex: 'picsum\\.photos',
                options: 'i',
              },
            },
            DEFAULT_OG,
            '$ogImage',
          ],
        },
        twitterImage: {
          $cond: [
            {
              $regexMatch: {
                input: { $ifNull: ['$twitterImage', ''] },
                regex: 'picsum\\.photos',
                options: 'i',
              },
            },
            DEFAULT_OG,
            '$twitterImage',
          ],
        },
      },
    },
  ]);

  console.log('matched=', result.matchedCount, 'modified=', result.modifiedCount);

  const sample = await col.findOne(
    { slug: 'article-5-5' },
    { projection: { slug: 1, featuredImage: 1, ogImage: 1, title: 1 } }
  );
  console.log('sample=', JSON.stringify(sample));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
