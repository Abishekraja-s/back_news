import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import mongoose from 'mongoose';
import { runGovernmentFetch } from '../controllers/governmentNotificationController.js';

await mongoose.connect(process.env.MONGODB_URI);
const result = await runGovernmentFetch('test');
console.log(JSON.stringify(result, null, 2));
await mongoose.disconnect();
