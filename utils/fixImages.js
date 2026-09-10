import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Article from '../models/Article.js';
import Author from '../models/Author.js';
import Advertisement from '../models/Advertisement.js';

dotenv.config();

const fixImages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected — fixing image URLs...\n');

    const articles = await Article.find({}, 'slug featuredImage ogImage twitterImage');
    for (const article of articles) {
      const image = `https://picsum.photos/seed/${encodeURIComponent(article.slug)}/800/450`;
      await Article.updateOne(
        { _id: article._id },
        {
          featuredImage: image,
          ogImage: image,
          twitterImage: image,
        }
      );
    }
    console.log(`✓ Fixed ${articles.length} article images`);

    const authors = await Author.find({}, 'slug profileImage');
    for (const author of authors) {
      const image = `https://picsum.photos/seed/author-${encodeURIComponent(author.slug)}/200/200`;
      await Author.updateOne({ _id: author._id }, { profileImage: image });
    }
    console.log(`✓ Fixed ${authors.length} author images`);

    const ads = await Advertisement.find({}, 'position');
    for (const ad of ads) {
      const image = `https://picsum.photos/seed/ad-${encodeURIComponent(ad.position)}/728/90`;
      await Advertisement.updateOne({ _id: ad._id }, { image });
    }
    console.log(`✓ Fixed ${ads.length} advertisement images`);

    console.log('\n✅ All images updated successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Fix failed:', error.message);
    process.exit(1);
  }
};

fixImages();
