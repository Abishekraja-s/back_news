import MarketplaceProduct from '../models/MarketplaceProduct.js';
import MarketplaceEnquiry from '../models/MarketplaceEnquiry.js';
import User from '../models/User.js';
import {
  ROLES,
  MARKETPLACE_PRODUCT_STATUS,
  MARKETPLACE_ENQUIRY_STATUS,
} from '../config/constants.js';
import { sendTokenResponse } from '../utils/generateToken.js';

const formatPrice = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** Public: approved listings */
export const getPublicProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 12);
    const filter = { status: MARKETPLACE_PRODUCT_STATUS.APPROVED };
    if (req.query.q) {
      filter.$text = { $search: String(req.query.q) };
    }
    if (req.query.location) {
      filter.location = new RegExp(String(req.query.location), 'i');
    }

    const total = await MarketplaceProduct.countDocuments(filter);
    const products = await MarketplaceProduct.find(filter)
      .populate('seller', 'name businessName city phone')
      .sort({ approvedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicProduct = async (req, res, next) => {
  try {
    const product = await MarketplaceProduct.findOne({
      _id: req.params.id,
      status: MARKETPLACE_PRODUCT_STATUS.APPROVED,
    })
      .populate('seller', 'name businessName city phone')
      .lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

/** For Explore widget — latest approved */
export const getHubProducts = async (req, res, next) => {
  try {
    const limit = Math.min(10, parseInt(req.query.limit, 10) || 3);
    const products = await MarketplaceProduct.find({
      status: MARKETPLACE_PRODUCT_STATUS.APPROVED,
    })
      .sort({ approvedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: products.map((p) => ({
        _id: p._id,
        title: p.title,
        image: p.image,
        meta: { price: formatPrice(p.price), location: p.location },
        link: `/marketplace/${p._id}`,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const registerSeller = async (req, res, next) => {
  try {
    const { name, email, password, phone, businessName, city } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const exists = await User.findOne({ email: email.trim().toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: ROLES.SELLER,
      phone: phone?.trim() || '',
      businessName: businessName?.trim() || '',
      city: city?.trim() || '',
      status: 'active',
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    next(error);
  }
};

/** Seller: my products */
export const getMyProducts = async (req, res, next) => {
  try {
    const products = await MarketplaceProduct.find({ seller: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const { title, description, price, location, image, images, category, condition } = req.body;
    if (!title?.trim() || price == null || Number.isNaN(Number(price))) {
      return res.status(400).json({ success: false, message: 'Title and valid price are required' });
    }

    const product = await MarketplaceProduct.create({
      seller: req.user._id,
      title: title.trim(),
      description: description?.trim() || '',
      price: Number(price),
      location: location?.trim() || req.user.city || '',
      image: image || '',
      images: images || [],
      category: category?.trim() || 'General',
      condition: condition || 'used',
      status: MARKETPLACE_PRODUCT_STATUS.PENDING,
    });

    res.status(201).json({ success: true, data: product, message: 'Submitted for admin review' });
  } catch (error) {
    next(error);
  }
};

export const updateMyProduct = async (req, res, next) => {
  try {
    const product = await MarketplaceProduct.findOne({ _id: req.params.id, seller: req.user._id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const fields = ['title', 'description', 'price', 'location', 'image', 'images', 'category', 'condition'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) product[f] = f === 'price' ? Number(req.body[f]) : req.body[f];
    });

    // Edits go back to pending unless marking sold/inactive from approved
    if (req.body.status === MARKETPLACE_PRODUCT_STATUS.SOLD || req.body.status === MARKETPLACE_PRODUCT_STATUS.INACTIVE) {
      if (product.status === MARKETPLACE_PRODUCT_STATUS.APPROVED) {
        product.status = req.body.status;
      }
    } else if (['title', 'description', 'price', 'location', 'image', 'images', 'category', 'condition'].some((f) => req.body[f] !== undefined)) {
      if (product.status !== MARKETPLACE_PRODUCT_STATUS.PENDING) {
        product.status = MARKETPLACE_PRODUCT_STATUS.PENDING;
        product.rejectionReason = '';
        product.approvedAt = undefined;
        product.approvedBy = undefined;
      }
    }

    await product.save();
    res.json({ success: true, data: product, message: 'Product updated' });
  } catch (error) {
    next(error);
  }
};

export const deleteMyProduct = async (req, res, next) => {
  try {
    const product = await MarketplaceProduct.findOneAndDelete({ _id: req.params.id, seller: req.user._id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    await MarketplaceEnquiry.deleteMany({ product: product._id });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
};

/** Seller enquiries */
export const getMyEnquiries = async (req, res, next) => {
  try {
    const enquiries = await MarketplaceEnquiry.find({ seller: req.user._id })
      .populate('product', 'title image price status')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: enquiries });
  } catch (error) {
    next(error);
  }
};

export const updateEnquiry = async (req, res, next) => {
  try {
    const enquiry = await MarketplaceEnquiry.findOne({ _id: req.params.id, seller: req.user._id });
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }
    if (req.body.status && Object.values(MARKETPLACE_ENQUIRY_STATUS).includes(req.body.status)) {
      enquiry.status = req.body.status;
    }
    if (req.body.sellerNotes !== undefined) enquiry.sellerNotes = req.body.sellerNotes;
    await enquiry.save();
    res.json({ success: true, data: enquiry });
  } catch (error) {
    next(error);
  }
};

/** Public enquiry to seller */
export const createEnquiry = async (req, res, next) => {
  try {
    const { buyerName, buyerEmail, buyerPhone, message } = req.body;
    if (!buyerName?.trim() || !buyerEmail?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'Name, email and message are required' });
    }

    const product = await MarketplaceProduct.findOne({
      _id: req.params.id,
      status: MARKETPLACE_PRODUCT_STATUS.APPROVED,
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not available' });
    }

    const enquiry = await MarketplaceEnquiry.create({
      product: product._id,
      seller: product.seller,
      buyerName: buyerName.trim(),
      buyerEmail: buyerEmail.trim().toLowerCase(),
      buyerPhone: buyerPhone?.trim() || '',
      message: message.trim(),
    });

    res.status(201).json({ success: true, data: enquiry, message: 'Enquiry sent to seller' });
  } catch (error) {
    next(error);
  }
};

/** Admin */
export const getAdminProducts = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const products = await MarketplaceProduct.find(filter)
      .populate('seller', 'name email phone businessName city')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

export const reviewProduct = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    const allowed = [
      MARKETPLACE_PRODUCT_STATUS.APPROVED,
      MARKETPLACE_PRODUCT_STATUS.REJECTED,
      MARKETPLACE_PRODUCT_STATUS.INACTIVE,
    ];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid review status' });
    }

    const product = await MarketplaceProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.status = status;
    if (status === MARKETPLACE_PRODUCT_STATUS.APPROVED) {
      product.approvedAt = new Date();
      product.approvedBy = req.user._id;
      product.rejectionReason = '';
    }
    if (status === MARKETPLACE_PRODUCT_STATUS.REJECTED) {
      product.rejectionReason = rejectionReason || 'Rejected by admin';
      product.approvedAt = undefined;
      product.approvedBy = undefined;
    }

    await product.save();
    res.json({ success: true, data: product, message: `Product ${status.toLowerCase()}` });
  } catch (error) {
    next(error);
  }
};

export const getAdminEnquiries = async (req, res, next) => {
  try {
    const enquiries = await MarketplaceEnquiry.find()
      .populate('product', 'title')
      .populate('seller', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data: enquiries });
  } catch (error) {
    next(error);
  }
};

export const getSellerDashboardStats = async (req, res, next) => {
  try {
    const sellerId = req.user._id;
    const [total, pending, approved, sold, enquiries, newEnquiries] = await Promise.all([
      MarketplaceProduct.countDocuments({ seller: sellerId }),
      MarketplaceProduct.countDocuments({ seller: sellerId, status: MARKETPLACE_PRODUCT_STATUS.PENDING }),
      MarketplaceProduct.countDocuments({ seller: sellerId, status: MARKETPLACE_PRODUCT_STATUS.APPROVED }),
      MarketplaceProduct.countDocuments({ seller: sellerId, status: MARKETPLACE_PRODUCT_STATUS.SOLD }),
      MarketplaceEnquiry.countDocuments({ seller: sellerId }),
      MarketplaceEnquiry.countDocuments({ seller: sellerId, status: MARKETPLACE_ENQUIRY_STATUS.NEW }),
    ]);
    res.json({
      success: true,
      data: { total, pending, approved, sold, enquiries, newEnquiries },
    });
  } catch (error) {
    next(error);
  }
};
