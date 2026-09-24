/**
 * Process individual ChatGPT Rasi circle JPGs → 512×512 PNG + WebP (white bg, ~16px pad).
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = 'C:\\Users\\abi\\.cursor\\projects\\d-news\\assets';
const OUT = path.resolve(__dirname, '../../client/public/astrology');

const OUT_SIZE = 512;
const PAD = 16;
const WHITE = { r: 255, g: 255, b: 255 };

/** ChatGPT timestamp fragment in filename → slug */
const ENTRIES = [
  ['12_45_55_PM-4ac4eb3a', 'thulam'],
  ['12_48_18_PM-d641d43e', 'meenam'],
  ['12_45_15_PM-57dfd503', 'mithunam'],
  ['12_45_36_PM-8805e109', 'simmam'],
  ['12_45_45_PM-66ff64ce', 'kanni'],
  ['12_46_49_PM-29df7896', 'kumbam'],
  ['12_45_25_PM-9650276a', 'kadagam'],
  ['12_46_05_PM-b0f1de7f', 'viruchigam'],
  ['12_46_16_PM-636f2252', 'dhanusu'],
  ['12_46_29_PM-210fbf1b', 'magaram'],
  ['12_45_01_PM-a98930be', 'rishabam'],
];

function findSource(token) {
  const files = fs.readdirSync(ASSETS);
  const match = files.find((f) => f.includes(token) && /\.jpe?g$/i.test(f));
  if (!match) throw new Error(`No source for token ${token}`);
  const full = path.join(ASSETS, match);
  return fs.readFileSync(full);
}

const inner = OUT_SIZE - PAD * 2;
const written = [];

for (const [token, slug] of ENTRIES) {
  const srcBuf = findSource(token);
  const resized = await sharp(srcBuf)
    .resize(inner, inner, {
      fit: 'contain',
      background: { ...WHITE, alpha: 1 },
    })
    .png()
    .toBuffer();

  const finalBuf = await sharp({
    create: {
      width: OUT_SIZE,
      height: OUT_SIZE,
      channels: 3,
      background: WHITE,
    },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png()
    .toBuffer();

  const pngPath = path.join(OUT, `${slug}.png`);
  const webpPath = path.join(OUT, `${slug}.webp`);
  await sharp(finalBuf).toFile(pngPath);
  await sharp(finalBuf).webp({ quality: 97 }).toFile(webpPath);

  const pngStat = fs.statSync(pngPath);
  const webpStat = fs.statSync(webpPath);
  written.push({ slug, png: pngStat.size, webp: webpStat.size });
  console.log(`wrote ${slug}`);
}

console.log('\n--- sizes (bytes) ---');
for (const w of written) {
  console.log(`${w.slug}.png\t${w.png}\t${w.slug}.webp\t${w.webp}`);
}
