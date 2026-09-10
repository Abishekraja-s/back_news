import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URI);
const { getOrCreateGovConfig } = await import('../controllers/governmentNotificationController.js');
const GovernmentNotification = (await import('../models/GovernmentNotification.js')).default;

const config = await getOrCreateGovConfig();
const all = await GovernmentNotification.find({}).select('title status isActive').lean();
const hindi = all.filter((n) => /[\u0900-\u097F]/.test(n.title || '')).length;
const published = all.filter((n) => n.status === 'published' && n.isActive).length;
const disabledHindi = all.filter((n) => n.status === 'disabled' && /[\u0900-\u097F]/.test(n.title || '')).length;

console.log('preferredLanguage:', config.preferredLanguage);
const pib = config.sources.find((s) => /pib|press information bureau/i.test(`${s.name} ${s.feedUrl}`));
console.log('PIB feed:', pib?.feedUrl);
console.log('Hindi total:', hindi, '| Published active:', published, '| Disabled Hindi:', disabledHindi);

await mongoose.disconnect();
