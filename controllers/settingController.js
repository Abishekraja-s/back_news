import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Setting from '../models/Setting.js';
import { optimizeBrandMp4 } from '../utils/brandVideoOptimizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads');

export const BRAND_SETTING_KEYS = ['headerLogo', 'footerLogo', 'favicon'];

const DEFAULT_SETTINGS = {
  siteName: 'The Great India News',
  siteNameTamil: 'தி கிரேட் இந்தியா நியூஸ்',
  headerLogo: '',
  footerLogo: '',
  favicon: '',
  logo: '',
  contactEmail: 'contact@thegreatindianews.com',
  contactPhone: '+91 9876543210',
  address: 'Chennai, Tamil Nadu, India',
  socialFacebook: '',
  socialTwitter: '',
  socialInstagram: '',
  socialYoutube: '',
  socialTelegram: '',
  whatsapp_group_link: '',
  footerText: '© 2026 The Great India News. All rights reserved.',
  defaultSeoTitle: 'The Great India News - Latest Tamil News',
  defaultMetaDescription: 'Latest Tamil news from Tamil Nadu, India and World. Breaking news, politics, sports, cinema and more.',
  googleAnalyticsId: '',
  googleAnalyticsPropertyId: '',
  googleTagManagerId: '',
  analyticsEnabled: true,
  searchConsoleVerification: '',
  commentsEnabled: true,
};

export const normalizeBrandAsset = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const url = value.trim();
    return url ? { url, version: null, mimeType: null } : null;
  }
  if (typeof value === 'object' && value.url) {
    return {
      url: value.url,
      posterUrl: value.posterUrl || null,
      version: value.version || null,
      mimeType: value.mimeType || null,
      optimized: Boolean(value.optimized),
    };
  }
  return null;
};

const resolveHeaderLogo = (settingsMap) =>
  normalizeBrandAsset(settingsMap.headerLogo) || normalizeBrandAsset(settingsMap.logo);

const buildSettingsResult = (stored = []) => {
  const result = { ...DEFAULT_SETTINGS };
  const map = {};

  stored.forEach((s) => {
    map[s.key] = s.value;
    result[s.key] = s.value;
  });

  result.headerLogo = resolveHeaderLogo(map);
  result.footerLogo = normalizeBrandAsset(map.footerLogo);
  result.favicon = normalizeBrandAsset(map.favicon);

  // Coerce analytics flag (Mixed type may be string/boolean)
  if (result.analyticsEnabled === 'false' || result.analyticsEnabled === false) {
    result.analyticsEnabled = false;
  } else if (
    result.analyticsEnabled === true ||
    result.analyticsEnabled === 'true' ||
    result.analyticsEnabled == null ||
    result.analyticsEnabled === ''
  ) {
    result.analyticsEnabled = true;
  } else {
    result.analyticsEnabled = Boolean(result.analyticsEnabled);
  }

  return result;
};

const deleteBrandFile = (asset) => {
  const parsed = normalizeBrandAsset(asset);
  if (!parsed?.url?.startsWith('/uploads/')) return;
  const filePath = path.join(uploadDir, path.basename(parsed.url));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  if (parsed.posterUrl?.startsWith('/uploads/')) {
    const posterPath = path.join(uploadDir, path.basename(parsed.posterUrl));
    if (fs.existsSync(posterPath)) fs.unlinkSync(posterPath);
  }
};

export const getSettings = async (req, res, next) => {
  try {
    const settings = await Setting.find();
    res.json({ success: true, data: buildSettingsResult(settings) });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const updates = { ...(req.body || {}) };

    if (Object.prototype.hasOwnProperty.call(updates, 'analyticsEnabled')) {
      updates.analyticsEnabled = Boolean(updates.analyticsEnabled);
    }

    for (const [key, value] of Object.entries(updates)) {
      if (BRAND_SETTING_KEYS.includes(key)) continue;
      await Setting.findOneAndUpdate(
        { key },
        { key, value, group: key.startsWith('google') || key === 'analyticsEnabled' ? 'analytics' : 'general' },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    next(error);
  }
};

export const getPublicSettings = async (req, res, next) => {
  try {
    const settings = await Setting.find({
      key: {
        $in: [
          'siteName',
          'siteNameTamil',
          'headerLogo',
          'footerLogo',
          'favicon',
          'logo',
          'contactEmail',
          'contactPhone',
          'socialFacebook',
          'socialTwitter',
          'socialInstagram',
          'socialYoutube',
          'socialTelegram',
          'whatsapp_group_link',
          'footerText',
          'commentsEnabled',
          'googleAnalyticsId',
          'googleAnalyticsPropertyId',
          'googleTagManagerId',
          'analyticsEnabled',
        ],
      },
    });

    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
    res.json({ success: true, data: buildSettingsResult(settings) });
  } catch (error) {
    next(error);
  }
};

export const uploadBrandSetting = async (req, res, next) => {
  try {
    const type = req.body?.type || req.query?.type;

    if (!BRAND_SETTING_KEYS.includes(type)) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Invalid brand asset type' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const existing = await Setting.findOne({ key: type });
    deleteBrandFile(existing?.value);

    let finalPath = req.file.path;
    let posterPath = null;
    let optimized = false;

    if (req.file.mimetype === 'video/mp4') {
      const result = await optimizeBrandMp4(req.file.path);
      finalPath = result.videoPath;
      posterPath = result.posterPath;
      optimized = result.optimized;
    }

    const asset = {
      url: `/uploads/${path.basename(finalPath)}`,
      version: Date.now(),
      mimeType: req.file.mimetype,
      optimized,
    };

    if (posterPath) {
      asset.posterUrl = `/uploads/${path.basename(posterPath)}`;
    }

    const setting = await Setting.findOneAndUpdate(
      { key: type },
      { key: type, value: asset, group: 'branding' },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `${type} updated`,
      data: {
        key: type,
        asset: normalizeBrandAsset(setting.value),
      },
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

export { DEFAULT_SETTINGS };
