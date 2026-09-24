/**
 * Split 3×4 black-background Rasi chart into circle-only icons (no text).
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../../client/public/astrology/rasi-chart-source.jpg');
const OUT = path.resolve(__dirname, '../../client/public/astrology');

const SLUGS = [
  'mesham', 'rishabam', 'mithunam', 'kadagam',
  'simmam', 'kanni', 'thulam', 'viruchigam',
  'dhanusu', 'magaram', 'kumbam', 'meenam',
];

const COLS = 4;
const ROWS = 3;
const OUT_SIZE = 512;
const PAD = 20;
const CELL_INSET = 3;

const BLACK = { r: 0, g: 0, b: 0 };

const meta = await sharp(SRC).metadata();
console.log(`Source: ${meta.width}×${meta.height}`);

const cellW = Math.floor(meta.width / COLS);
const cellH = Math.floor(meta.height / ROWS);

for (let i = 0; i < SLUGS.length; i += 1) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const cropSize = Math.min(cellW, cellH) - CELL_INSET * 2;
  const left = col * cellW + Math.floor((cellW - cropSize) / 2);
  const top = row * cellH + Math.floor((cellH - cropSize) / 2);
  const width = Math.min(cropSize, meta.width - left);
  const height = Math.min(cropSize, meta.height - top);

  const extract = { left, top, width, height };

  const cropped = await sharp(SRC).extract(extract).png().toBuffer();

  const inner = OUT_SIZE - PAD * 2;
  const resized = await sharp(cropped)
    .resize(inner, inner, {
      fit: 'contain',
      background: { ...BLACK, alpha: 1 },
    })
    .png()
    .toBuffer();

  const finalBuf = await sharp({
    create: {
      width: OUT_SIZE,
      height: OUT_SIZE,
      channels: 3,
      background: BLACK,
    },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png()
    .toBuffer();

  await sharp(finalBuf).webp({ quality: 97 }).toFile(path.join(OUT, `${SLUGS[i]}.webp`));
  await sharp(finalBuf).toFile(path.join(OUT, `${SLUGS[i]}.png`));
  console.log('wrote', SLUGS[i], extract);
}

console.log('Done — 12 circle icons (black bg)');
