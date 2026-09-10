import Author from '../models/Author.js';
import Article from '../models/Article.js';
import { paginate } from '../utils/helpers.js';
import { ARTICLE_STATUS } from '../config/constants.js';

export const getAuthors = async (req, res, next) => {
  try {
    const authors = await Author.find({ status: 'active' }).sort({ name: 1 }).lean();
    res.json({ success: true, data: authors });
  } catch (error) {
    next(error);
  }
};

export const getAllAuthors = async (req, res, next) => {
  try {
    const authors = await Author.find().sort({ name: 1 });
    res.json({ success: true, data: authors });
  } catch (error) {
    next(error);
  }
};

export const getAuthorBySlug = async (req, res, next) => {
  try {
    const author = await Author.findOne({ slug: req.params.slug, status: 'active' });
    if (!author) {
      return res.status(404).json({ success: false, message: 'Author not found' });
    }

    const { page, limit, skip } = paginate(req.query.page, req.query.limit);
    const query = {
      author: author._id,
      status: ARTICLE_STATUS.PUBLISHED,
      publishedAt: { $lte: new Date() },
    };

    const [articles, total] = await Promise.all([
      Article.find(query)
        .populate('category', 'name nameTamil slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Article.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: { author, articles },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const createAuthor = async (req, res, next) => {
  try {
    const author = await Author.create(req.body);
    res.status(201).json({ success: true, data: author });
  } catch (error) {
    next(error);
  }
};

export const updateAuthor = async (req, res, next) => {
  try {
    const author = await Author.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!author) {
      return res.status(404).json({ success: false, message: 'Author not found' });
    }
    res.json({ success: true, data: author });
  } catch (error) {
    next(error);
  }
};

export const deleteAuthor = async (req, res, next) => {
  try {
    await Author.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Author deleted' });
  } catch (error) {
    next(error);
  }
};
