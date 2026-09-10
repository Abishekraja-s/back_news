import BreakingNews from '../models/BreakingNews.js';

const stripManualViews = (body = {}) => {
  const data = { ...body };
  delete data.views;
  return data;
};

export const getActiveBreakingNews = async (req, res, next) => {
  try {
    const now = new Date();
    const news = await BreakingNews.find({
      isActive: true,
      startTime: { $lte: now },
      $or: [{ endTime: null }, { endTime: { $gte: now } }],
    })
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    // Automatic website view count: +1 each time ticker is loaded on the site
    if (news.length) {
      const ids = news.map((n) => n._id);
      BreakingNews.updateMany({ _id: { $in: ids } }, { $inc: { views: 1 } }).catch(() => {});
    }

    res.json({ success: true, data: news });
  } catch (error) {
    next(error);
  }
};

export const getAllBreakingNews = async (req, res, next) => {
  try {
    const news = await BreakingNews.find().sort({ priority: -1, createdAt: -1 });
    res.json({ success: true, data: news });
  } catch (error) {
    next(error);
  }
};

export const createBreakingNews = async (req, res, next) => {
  try {
    const data = { ...stripManualViews(req.body), createdBy: req.user._id, views: 0 };
    const news = await BreakingNews.create(data);
    res.status(201).json({ success: true, data: news });
  } catch (error) {
    next(error);
  }
};

export const updateBreakingNews = async (req, res, next) => {
  try {
    const news = await BreakingNews.findByIdAndUpdate(
      req.params.id,
      stripManualViews(req.body),
      { new: true }
    );
    if (!news) {
      return res.status(404).json({ success: false, message: 'Breaking news not found' });
    }
    res.json({ success: true, data: news });
  } catch (error) {
    next(error);
  }
};

export const deleteBreakingNews = async (req, res, next) => {
  try {
    await BreakingNews.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Breaking news deleted' });
  } catch (error) {
    next(error);
  }
};
