import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { syncAstrologyNow, getOrCreateAstrologyConfig } from '../services/astrologyService.js';

await mongoose.connect(process.env.MONGODB_URI);
const config = await getOrCreateAstrologyConfig();
config.syncInProgress = false;
config.apiProvider = 'free';
config.apiBaseUrl = 'https://ohmanda.com/api/horoscope';
await config.save();

console.log('Starting bilingual sync...');
const result = await syncAstrologyNow('manual');
console.log(JSON.stringify(result, null, 2));

const sample = await mongoose.connection.db.collection('dailyhoroscopes').findOne({
  date: result.date,
  rasi: 'mesham',
});
console.log('SAMPLE mesham TA:', (sample?.predictionTamil || '').slice(0, 160));
console.log('SAMPLE mesham EN:', (sample?.prediction || '').slice(0, 160));
const withTa = await mongoose.connection.db.collection('dailyhoroscopes').countDocuments({
  date: result.date,
  predictionTamil: { $nin: [null, ''] },
});
console.log('With Tamil prediction:', withTa);
await mongoose.disconnect();
