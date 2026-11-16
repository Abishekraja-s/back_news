import Advertisement from '../models/Advertisement.js';

export const getAdsByPosition = async (req, res, next) => {
  try {
    const now = new Date();
    const ads = await Advertisement.find({
      position: req.params.position,
      isActive: true,
      $and: [
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: null },
            { startDate: { $lte: now } },
          ],
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: null },
            { endDate: { $gte: now } },
          ],
        },
      ],
    })
      .sort({ priority: -1 })
      .lean();

    res.json({ success: true, data: ads });
  } catch (error) {
    next(error);
  }
};

export const getAllAds = async (req, res, next) => {
  try {
    const ads = await Advertisement.find().sort({ position: 1, priority: -1 });
    res.json({ success: true, data: ads });
  } catch (error) {
    next(error);
  }
};

export const createAd = async (req, res, next) => {
  try {
    const { title, position, type = 'image', image, link, code, isActive, priority } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (type === 'image' && !image?.trim()) {
      return res.status(400).json({ success: false, message: 'Image URL is required for image ads' });
    }
    if (type === 'code' && !code?.trim()) {
      return res.status(400).json({ success: false, message: 'HTML code is required for code ads' });
    }

    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();
    const endDate =
      req.body.endDate === null || req.body.endDate === ''
        ? null
        : req.body.endDate
          ? new Date(req.body.endDate)
          : undefined;

    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid from date' });
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid to date' });
    }
    if (endDate && endDate < startDate) {
      return res.status(400).json({ success: false, message: 'To date must be on or after from date' });
    }

    const ad = await Advertisement.create({
      title: title.trim(),
      position,
      type,
      image: type === 'image' ? image.trim() : '',
      link: link?.trim() || '',
      code: type === 'code' ? code : '',
      isActive: isActive !== false,
      priority: Number(priority) || 0,
      startDate,
      endDate: endDate === undefined ? undefined : endDate,
    });
    res.status(201).json({ success: true, data: ad, message: 'Advertisement created' });
  } catch (error) {
    next(error);
  }
};

export const updateAd = async (req, res, next) => {
  try {
    const allowed = ['title', 'position', 'type', 'image', 'link', 'code', 'startDate', 'endDate', 'isActive', 'priority'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.startDate !== undefined) {
      if (updates.startDate === null || updates.startDate === '') {
        return res.status(400).json({ success: false, message: 'From date is required' });
      }
      updates.startDate = new Date(updates.startDate);
      if (Number.isNaN(updates.startDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid from date' });
      }
    }
    if (updates.endDate !== undefined) {
      if (updates.endDate === null || updates.endDate === '') {
        updates.endDate = null;
      } else {
        updates.endDate = new Date(updates.endDate);
        if (Number.isNaN(updates.endDate.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid to date' });
        }
      }
    }
    if (updates.startDate && updates.endDate && updates.endDate < updates.startDate) {
      return res.status(400).json({ success: false, message: 'To date must be on or after from date' });
    }

    if (updates.type === 'image' && !updates.image && req.body.image === '') {
      return res.status(400).json({ success: false, message: 'Image URL is required for image ads' });
    }

    const ad = await Advertisement.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }
    res.json({ success: true, data: ad, message: 'Advertisement updated' });
  } catch (error) {
    next(error);
  }
};

export const deleteAd = async (req, res, next) => {
  try {
    await Advertisement.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Advertisement deleted' });
  } catch (error) {
    next(error);
  }
};
