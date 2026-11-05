/**
 * For WhatsApp/Facebook: set ogImage/twitterImage away from picsum (crawler 405).
 * Does NOT change featuredImage (site listing cards keep unique photos).
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
    $or: [{ ogImage: /picsum\.photos/i }, { twitterImage: /picsum\.photos/i }],
  };

  const before = await col.countDocuments(filter);
  console.log('articles_with_picsum_og=', before);

  const result = await col.updateMany(filter, [
    {
      $set: {
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
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
