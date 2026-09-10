import FeatureItem from '../models/FeatureItem.js';

export const getItems = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.featureKey) filter.featureKey = String(req.query.featureKey).toLowerCase();
    if (req.query.itemType) filter.itemType = req.query.itemType;
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;

    const items = await FeatureItem.find(filter).sort({ priority: -1, createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

export const createItem = async (req, res, next) => {
  try {
    const item = await FeatureItem.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const updateItem = async (req, res, next) => {
  try {
    const item = await FeatureItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const deleteItem = async (req, res, next) => {
  try {
    const item = await FeatureItem.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    next(error);
  }
};
