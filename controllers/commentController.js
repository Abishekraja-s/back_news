import Comment from '../models/Comment.js';
import { COMMENT_STATUS } from '../config/constants.js';
import { paginate } from '../utils/helpers.js';

export const getComments = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.article) query.article = req.query.article;

    const [comments, total] = await Promise.all([
      Comment.find(query).populate('article', 'title slug').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Comment.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: comments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const createComment = async (req, res, next) => {
  try {
    const comment = await Comment.create(req.body);
    res.status(201).json({ success: true, data: comment, message: 'Comment submitted for review' });
  } catch (error) {
    next(error);
  }
};

export const updateCommentStatus = async (req, res, next) => {
  try {
    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json({ success: true, data: comment });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
};

export const getArticleComments = async (req, res, next) => {
  try {
    const comments = await Comment.find({
      article: req.params.articleId,
      status: COMMENT_STATUS.APPROVED,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: comments });
  } catch (error) {
    next(error);
  }
};
