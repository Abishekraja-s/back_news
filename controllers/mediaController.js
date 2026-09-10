import Media from '../models/Media.js';
import { processImage, deleteImageFiles } from '../utils/imageProcessor.js';
import { paginate } from '../utils/helpers.js';
import path from 'path';

export const getMedia = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const query = {};

    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    const [media, total] = await Promise.all([
      Media.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Media.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: media,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const processed = await processImage(req.file.path, req.file.filename);

    const media = await Media.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: processed.original,
      thumbnailUrl: processed.thumbnail,
      webpUrl: processed.webp,
      alt: req.body.alt || '',
      caption: req.body.caption || '',
      mimeType: req.file.mimetype,
      size: req.file.size,
      width: processed.width,
      height: processed.height,
      uploadedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: media });
  } catch (error) {
    next(error);
  }
};

export const uploadAudioMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file uploaded' });
    }

    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({
      success: true,
      data: {
        url,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
      message: 'Audio uploaded',
    });
  } catch (error) {
    next(error);
  }
};

export const updateMedia = async (req, res, next) => {
  try {
    const media = await Media.findByIdAndUpdate(
      req.params.id,
      { alt: req.body.alt, caption: req.body.caption },
      { new: true }
    );
    if (!media) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }
    res.json({ success: true, data: media });
  } catch (error) {
    next(error);
  }
};

export const deleteMedia = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    deleteImageFiles(media.filename);
    await media.deleteOne();

    res.json({ success: true, message: 'Media deleted' });
  } catch (error) {
    next(error);
  }
};
