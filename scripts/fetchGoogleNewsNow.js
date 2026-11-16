import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runGoogleNewsFetch } from '../controllers/googleNewsController.js';
import GoogleNewsItem from '../models/GoogleNewsItem.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
const before = await GoogleNewsItem.countDocuments();
console.log('googlenewsitems before:', before);

const result = await runGoogleNewsFetch('manual-cli');
console.log('fetch result:', result);

const after = await GoogleNewsItem.countDocuments();
const byStatus = await GoogleNewsItem.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
console.log('googlenewsitems after:', after);
console.log('by status:', Object.fromEntries(byStatus.map((r) => [r._id, r.n])));

await mongoose.disconnect();
