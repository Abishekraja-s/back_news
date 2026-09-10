import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|avif|svg/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype.split('/')[1]);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const documentFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExt = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.pdf'];
  const allowedMime = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ];
  if (allowedExt.includes(ext) && allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image or PDF files are allowed'), false);
  }
};

export const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const audioFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExt = ['.mp3', '.mpeg', '.wav', '.ogg', '.m4a', '.aac', '.webm'];
  const allowedMime = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
    'audio/mp4',
    'audio/x-m4a',
  ];
  if (allowedExt.includes(ext) || allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed (mp3, wav, ogg, m4a)'), false);
  }
};

export const uploadAudio = multer({
  storage,
  fileFilter: audioFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const BRAND_IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif'];
const BRAND_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/gif'];
const BRAND_VIDEO_EXT = ['.mp4'];
const BRAND_VIDEO_MIME = ['video/mp4'];

const brandAssetFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExt = [...BRAND_IMAGE_EXT, ...BRAND_VIDEO_EXT];
  const allowedMime = [...BRAND_IMAGE_MIME, ...BRAND_VIDEO_MIME];
  if (allowedExt.includes(ext) && allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG, JPG, JPEG, GIF, and MP4 files are allowed'), false);
  }
};

const brandStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const type = String(req.query?.type || req.body?.type || 'asset').replace(/[^a-z]/gi, '');
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `brand-${type}-${unique}${ext}`);
  },
});

export const uploadBrandAsset = multer({
  storage: brandStorage,
  fileFilter: brandAssetFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});
