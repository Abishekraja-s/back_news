import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dayStart = (s) => {
  const d = new Date(s);
  d.setHours(0, 0, 0, 0);
  return d;
};
const dayEnd = (s) => {
  const d = new Date(s);
  d.setHours(23, 59, 59, 999);
  return d;
};

const events = [
  {
    title: 'Pongal',
    gifUrl: '/uploads/event-gifs/pongal.gif',
    eventUrl: '/explore',
    startDate: dayStart('2026-01-14'),
    endDate: dayEnd('2026-01-17'),
    isActive: true,
    displayOrder: 1,
  },
  {
    title: 'Diwali',
    gifUrl: '/uploads/event-gifs/diwali.gif',
    eventUrl: '/explore',
    startDate: dayStart('2026-11-06'),
    endDate: dayEnd('2026-11-10'),
    isActive: true,
    displayOrder: 2,
  },
];

async function main() {
  for (const e of events) {
    const file = path.join(__dirname, '..', e.gifUrl.replace(/^\//, ''));
    if (!fs.existsSync(file)) throw new Error(`Missing file ${file}`);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('eventgifs');

  await col.deleteMany({});

  const now = new Date();
  await col.insertMany(
    events.map((e) => ({
      ...e,
      createdAt: now,
      updatedAt: now,
    }))
  );

  const rows = await col.find({}).sort({ displayOrder: 1 }).toArray();
  console.log(
    'created',
    rows.length,
    rows.map((r) => ({ title: r.title, gifUrl: r.gifUrl, active: r.isActive }))
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
