import dotenv from 'dotenv';
import mongoose from 'mongoose';
import GoogleNewsItem from '../models/GoogleNewsItem.js';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const item = await GoogleNewsItem.findOne({ title: /Nepal Tragedy.*NDTV/i }).lean();
console.log('NDTV article:');
console.log('  image:', item?.image?.slice(0, 100));
console.log('  contentLen:', item?.content?.length);
console.log('  desc:', item?.description?.slice(0, 120));

const generic = await GoogleNewsItem.countDocuments({
  description: /Comprehensive, up-to-date news coverage/i,
});
const gimg = await GoogleNewsItem.countDocuments({ image: /googleusercontent/i });
const realImg = await GoogleNewsItem.countDocuments({
  image: { $regex: /^https/, $not: /googleusercontent/ },
});

console.log('\nStats:');
console.log('  generic descriptions:', generic);
console.log('  google placeholder images:', gimg);
console.log('  real publisher images:', realImg);

await mongoose.disconnect();
