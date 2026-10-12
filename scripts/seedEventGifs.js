/**
 * Create Pongal & Diwali animated GIF files and upsert EventGif records.
 * Run: node scripts/seedEventGifs.js
 */
import sharp from 'sharp';
import GIFEncoder from 'gif-encoder-2';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../uploads/event-gifs');
fs.mkdirSync(outDir, { recursive: true });

const ASSETS = path.join(process.env.USERPROFILE || '', '.cursor/projects/d-news/assets');

const sources = [
  {
    key: 'pongal',
    src: path.join(ASSETS, 'pongal-event.jpg'),
    title: 'Pongal',
    eventUrl: '/explore',
    startDate: '2026-01-14',
    endDate: '2026-01-17',
    displayOrder: 1,
  },
  {
    key: 'diwali',
    src: path.join(ASSETS, 'diwali-event.jpg'),
    title: 'Diwali',
    eventUrl: '/explore',
    startDate: '2026-11-06',
    endDate: '2026-11-10',
    displayOrder: 2,
  },
];

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

async function makeAnimatedGif(srcPath, outPath) {
  const size = 320;
  const mods = [1.0, 1.08, 1.14, 1.2, 1.14, 1.08, 1.0, 0.94];
  const encoder = new GIFEncoder(size, size, 'neuquant', true);
  encoder.setDelay(120);
  encoder.setRepeat(0);
  encoder.start();

  for (const brightness of mods) {
    const { data } = await sharp(srcPath)
      .resize(size, size, { fit: 'cover' })
      .modulate({ brightness, saturation: brightness > 1 ? 1.15 : 1.05 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    encoder.addFrame(data);
  }

  encoder.finish();
  fs.writeFileSync(outPath, Buffer.from(encoder.out.getData()));
}

async function main() {
  for (const item of sources) {
    if (!fs.existsSync(item.src)) throw new Error(`Missing source image: ${item.src}`);
    const out = path.join(outDir, `${item.key}.gif`);
    await makeAnimatedGif(item.src, out);
    console.log('GIF written', out, fs.statSync(out).size, 'bytes');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('eventgifs');

  for (const item of sources) {
    const gifUrl = `/uploads/event-gifs/${item.key}.gif`;
    await col.updateOne(
      { title: item.title },
      {
        $set: {
          title: item.title,
          gifUrl,
          eventUrl: item.eventUrl,
          startDate: dayStart(item.startDate),
          endDate: dayEnd(item.endDate),
          isActive: true,
          displayOrder: item.displayOrder,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    console.log('DB upserted', item.title, gifUrl);
  }

  console.log('total eventgifs', await col.countDocuments());
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
