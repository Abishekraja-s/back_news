import AdSensePlacement from '../models/AdSensePlacement.js';
import { ADSENSE_LOCATIONS, ADSENSE_FORMATS, ADSENSE_PAGES } from '../config/constants.js';

const PUBLISHER_RE = /^ca-pub-\d{10,20}$/i;
const SLOT_RE = /^\d{5,20}$/;

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => String(v).trim().toLowerCase()).filter(Boolean))];
  }
  if (typeof value === 'string') {
    return [
      ...new Set(
        value
          .split(/[\n,]+/)
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
  }
  return [];
};

const placementKey = (location, customLocation = '') =>
  location === 'custom' ? `custom:${(customLocation || '').toLowerCase()}` : location;

export const validatePlacementPayload = (body, { isUpdate = false } = {}) => {
  const errors = [];
  const data = {};

  if (!isUpdate || body.name !== undefined) {
    data.name = String(body.name || '').trim();
    if (!data.name) errors.push('Name is required');
  }

  if (!isUpdate || body.location !== undefined) {
    data.location = String(body.location || '').trim();
    if (!ADSENSE_LOCATIONS.includes(data.location)) {
      errors.push('Invalid placement location');
    }
  }

  if (!isUpdate || body.customLocation !== undefined || body.location === 'custom') {
    data.customLocation =
      (body.location || data.location) === 'custom'
        ? String(body.customLocation || '').trim().toLowerCase()
        : '';
    if ((body.location || data.location) === 'custom' && !data.customLocation) {
      errors.push('Custom location key is required when location is custom');
    }
  }

  if (!isUpdate || body.publisherId !== undefined) {
    data.publisherId = String(body.publisherId || '').trim();
    if (!PUBLISHER_RE.test(data.publisherId)) {
      errors.push('Publisher ID must look like ca-pub-xxxxxxxxxxxxxxxx');
    }
  }

  if (!isUpdate || body.adSlotId !== undefined) {
    data.adSlotId = String(body.adSlotId || '').trim();
    if (!SLOT_RE.test(data.adSlotId)) {
      errors.push('Ad Slot ID must be a numeric AdSense slot ID');
    }
  }

  if (!isUpdate || body.adFormat !== undefined) {
    data.adFormat = String(body.adFormat || 'auto').trim();
    if (!ADSENSE_FORMATS.includes(data.adFormat)) {
      errors.push('Invalid ad format');
    }
  }

  if (!isUpdate || body.sizeMode !== undefined) {
    data.sizeMode = body.sizeMode === 'fixed' ? 'fixed' : 'responsive';
  }

  if (!isUpdate || body.width !== undefined) {
    data.width = Number(body.width) || 336;
  }
  if (!isUpdate || body.height !== undefined) {
    data.height = Number(body.height) || 280;
  }

  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.priority !== undefined) data.priority = Number(body.priority) || 0;
  if (body.notes !== undefined) data.notes = String(body.notes || '');

  if (!isUpdate || body.pages !== undefined) {
    data.pages = normalizeList(body.pages);
    if (!data.pages.length) data.pages = ['all'];
    const invalid = data.pages.filter((p) => p !== 'all' && !ADSENSE_PAGES.includes(p));
    if (invalid.length) errors.push(`Invalid page keys: ${invalid.join(', ')}`);
  }

  if (!isUpdate || body.categories !== undefined) {
    data.categories = normalizeList(body.categories);
  }

  return { errors, data };
};

export const getMeta = async (req, res) => {
  res.json({
    success: true,
    data: {
      locations: ADSENSE_LOCATIONS,
      formats: ADSENSE_FORMATS,
      pages: ADSENSE_PAGES,
    },
  });
};

export const getAllPlacements = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.location) filter.location = req.query.location;
    if (req.query.isActive === 'true') filter.isActive = true;
    if (req.query.isActive === 'false') filter.isActive = false;

    const placements = await AdSensePlacement.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    res.json({ success: true, data: placements });
  } catch (error) {
    next(error);
  }
};

export const getPlacementById = async (req, res, next) => {
  try {
    const placement = await AdSensePlacement.findById(req.params.id).lean();
    if (!placement) {
      return res.status(404).json({ success: false, message: 'Placement not found' });
    }
    res.json({ success: true, data: placement });
  } catch (error) {
    next(error);
  }
};

export const createPlacement = async (req, res, next) => {
  try {
    const { errors, data } = validatePlacementPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    const duplicate = await AdSensePlacement.findOne({
      location: data.location,
      customLocation: data.customLocation || '',
      adSlotId: data.adSlotId,
    });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'An AdSense placement with this location and Ad Slot ID already exists',
      });
    }

    // Also prevent two active ads with same location key (different slots still allowed but warn via unique slot)
    const placement = await AdSensePlacement.create(data);
    res.status(201).json({ success: true, data: placement, message: 'AdSense placement created' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate AdSense placement for this location and slot',
      });
    }
    next(error);
  }
};

export const updatePlacement = async (req, res, next) => {
  try {
    const placement = await AdSensePlacement.findById(req.params.id);
    if (!placement) {
      return res.status(404).json({ success: false, message: 'Placement not found' });
    }

    const { errors, data } = validatePlacementPayload(
      { ...placement.toObject(), ...req.body },
      { isUpdate: true }
    );
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    const nextLocation = data.location ?? placement.location;
    const nextCustom = data.customLocation ?? placement.customLocation;
    const nextSlot = data.adSlotId ?? placement.adSlotId;

    const duplicate = await AdSensePlacement.findOne({
      _id: { $ne: placement._id },
      location: nextLocation,
      customLocation: nextCustom || '',
      adSlotId: nextSlot,
    });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'Another placement already uses this location and Ad Slot ID',
      });
    }

    Object.assign(placement, data);
    await placement.save();
    res.json({ success: true, data: placement, message: 'Placement updated' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Duplicate AdSense placement' });
    }
    next(error);
  }
};

export const deletePlacement = async (req, res, next) => {
  try {
    const placement = await AdSensePlacement.findByIdAndDelete(req.params.id);
    if (!placement) {
      return res.status(404).json({ success: false, message: 'Placement not found' });
    }
    res.json({ success: true, message: 'Placement deleted' });
  } catch (error) {
    next(error);
  }
};

export const togglePlacement = async (req, res, next) => {
  try {
    const placement = await AdSensePlacement.findById(req.params.id);
    if (!placement) {
      return res.status(404).json({ success: false, message: 'Placement not found' });
    }
    placement.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !placement.isActive;
    await placement.save();
    res.json({
      success: true,
      data: placement,
      message: placement.isActive ? 'Placement enabled' : 'Placement disabled',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: active placements for a location, filtered by page/category.
 * Query: location (or customLocation), page, category
 */
export const getPublicPlacements = async (req, res, next) => {
  try {
    const location = String(req.query.location || '').trim().toLowerCase();
    const customLocation = String(req.query.customLocation || '').trim().toLowerCase();
    const page = String(req.query.page || 'all').trim().toLowerCase();
    const category = String(req.query.category || '').trim().toLowerCase();

    if (!location && !customLocation) {
      return res.status(400).json({ success: false, message: 'location is required' });
    }

    const filter = { isActive: true };
    if (location === 'custom' || customLocation) {
      filter.location = 'custom';
      filter.customLocation = customLocation || location;
    } else {
      filter.location = location;
    }

    let placements = await AdSensePlacement.find(filter).sort({ priority: -1 }).lean();

    placements = placements.filter((p) => {
      const pages = p.pages?.length ? p.pages : ['all'];
      const pageOk = pages.includes('all') || pages.includes(page);
      if (!pageOk) return false;
      if (!p.categories?.length) return true;
      if (!category) return true;
      return p.categories.includes(category);
    });

    res.json({ success: true, data: placements });
  } catch (error) {
    next(error);
  }
};

export { placementKey };
