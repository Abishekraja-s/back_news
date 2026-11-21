import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = path.join(__dirname, '../uploads');
const MIN_TARGET = 50 * 1024;
const MAX_TARGET = 100 * 1024;
const MAX_EDGE = 1600;
const THUMB_EDGE = 480;

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const uniqueBase = (originalName = 'image') => {
  const safe = String(originalName)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'image';
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`;
};

/**
 * Compress + resize album images into uploads/albums/{albumId}/.
 * Aims for ~50–100 KB WebP (quality permitting), plus a small thumbnail.
 */
export const processAlbumImage = async (inputPath, { albumId, originalName = 'image' } = {}) => {
  if (!albumId) throw new Error('albumId is required for album image storage');
  if (!fs.existsSync(inputPath)) throw new Error('Upload file missing');

  const albumDir = path.join(uploadsRoot, 'albums', String(albumId));
  ensureDir(albumDir);

  const base = uniqueBase(originalName);
  const webpName = `${base}.webp`;
  const thumbName = `${base}-thumb.webp`;
  const webpPath = path.join(albumDir, webpName);
  const thumbPath = path.join(albumDir, thumbName);

  const pipeline = sharp(inputPath).rotate();
  const metadata = await pipeline.metadata();

  let width = metadata.width || 0;
  let height = metadata.height || 0;
  const longest = Math.max(width, height);
  const resizeOpts =
    longest > MAX_EDGE
      ? {
          width: width >= height ? MAX_EDGE : undefined,
          height: height > width ? MAX_EDGE : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        }
      : null;

  // Iterate WebP quality to land near 50–100 KB
  let bestBuf = null;
  let bestQuality = 72;
  for (const quality of [78, 72, 66, 60, 54, 48, 42, 36]) {
    let img = sharp(inputPath).rotate();
    if (resizeOpts) img = img.resize(resizeOpts);
    const buf = await img.webp({ quality, effort: 4 }).toBuffer();
    bestBuf = buf;
    bestQuality = quality;
    if (buf.length <= MAX_TARGET) break;
  }

  // If still under 50 KB and quality was low, try bumping quality once
  if (bestBuf && bestBuf.length < MIN_TARGET && bestQuality < 72) {
    let img = sharp(inputPath).rotate();
    if (resizeOpts) img = img.resize(resizeOpts);
    const bump = await img.webp({ quality: Math.min(80, bestQuality + 12), effort: 4 }).toBuffer();
    if (bump.length <= MAX_TARGET * 1.15) bestBuf = bump;
  }

  if (!bestBuf) throw new Error('Failed to optimize image');

  fs.writeFileSync(webpPath, bestBuf);

  let thumb = sharp(inputPath).rotate();
  thumb = thumb.resize({
    width: THUMB_EDGE,
    height: THUMB_EDGE,
    fit: 'inside',
    withoutEnlargement: true,
  });
  await thumb.webp({ quality: 70, effort: 4 }).toFile(thumbPath);

  const outMeta = await sharp(webpPath).metadata();
  width = outMeta.width || width;
  height = outMeta.height || height;

  // Remove original temp upload if it lives outside the album folder
  try {
    if (path.resolve(inputPath) !== path.resolve(webpPath) && fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
  } catch {
    /* ignore */
  }

  const relBase = `/uploads/albums/${albumId}`;
  return {
    url: `${relBase}/${webpName}`,
    webpUrl: `${relBase}/${webpName}`,
    thumbnailUrl: `${relBase}/${thumbName}`,
    filename: webpName,
    mimeType: 'image/webp',
    size: bestBuf.length,
    width,
    height,
  };
};

export const deleteAlbumImageFiles = (image) => {
  if (!image) return;
  const rels = [image.url, image.webpUrl, image.thumbnailUrl].filter(Boolean);
  for (const rel of rels) {
    const clean = String(rel).replace(/^\/uploads\//, '');
    const full = path.join(uploadsRoot, clean);
    if (fs.existsSync(full)) {
      try {
        fs.unlinkSync(full);
      } catch {
        /* ignore */
      }
    }
  }
};

export const deleteAlbumFolder = (albumId) => {
  if (!albumId) return;
  const dir = path.join(uploadsRoot, 'albums', String(albumId));
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
};
