import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const processImage = async (filePath, filename) => {
  const uploadsDir = path.join(__dirname, '../uploads');
  const baseName = path.parse(filename).name;

  const sizes = [
    { suffix: '-thumb', width: 400 },
    { suffix: '-medium', width: 800 },
    { suffix: '-large', width: 1200 },
  ];

  const metadata = await sharp(filePath).metadata();
  const results = { original: `/uploads/${filename}`, webp: '', thumbnail: '' };

  for (const size of sizes) {
    const webpName = `${baseName}${size.suffix}.webp`;
    const webpPath = path.join(uploadsDir, webpName);
    await sharp(filePath)
      .resize(size.width, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(webpPath);

    if (size.suffix === '-thumb') results.thumbnail = `/uploads/${webpName}`;
    if (size.suffix === '-medium') results.webp = `/uploads/${webpName}`;
  }

  const largeWebp = `${baseName}-large.webp`;
  results.large = `/uploads/${largeWebp}`;

  return {
    ...results,
    width: metadata.width,
    height: metadata.height,
  };
};

export const deleteImageFiles = (filename) => {
  const uploadsDir = path.join(__dirname, '../uploads');
  const baseName = path.parse(filename).name;
  const extensions = ['', '-thumb.webp', '-medium.webp', '-large.webp'];

  extensions.forEach((ext) => {
    const file = ext ? `${baseName}${ext}` : filename;
    const filePath = path.join(uploadsDir, file);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
};
