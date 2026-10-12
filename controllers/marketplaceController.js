import MarketplaceProduct from '../models/MarketplaceProduct.js';
import MarketplaceEnquiry from '../models/MarketplaceEnquiry.js';
import User from '../models/User.js';
import SellerRegistrationOtp from '../models/SellerRegistrationOtp.js';
import crypto from 'crypto';
import {
  ROLES,
  MARKETPLACE_PRODUCT_STATUS,
  MARKETPLACE_ENQUIRY_STATUS,
} from '../config/constants.js';
import { sendTokenResponse } from '../utils/generateToken.js';
import { sendMail } from '../utils/mail.js';

const formatPrice = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN')}`;

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

const validateSellerRegistrationBody = (body = {}) => {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const phone = String(body.phone || '').trim();
  const businessName = String(body.businessName || '').trim();
  const city = String(body.city || '').trim();

  if (!name || !email || !password) {
    return { error: 'Name, email and password are required' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address' };
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }
  return { name, email, password, phone, businessName, city };
};

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
    if (req.query.category) {
      filter.category = String(req.query.category).trim();
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

/** Step 1: validate registration details and email a 6-digit OTP */
export const sendSellerRegisterOtp = async (req, res, next) => {
  try {
    const parsed = validateSellerRegistrationBody(req.body);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }
    const { name, email, password, phone, businessName, city } = parsed;

    const exists = await User.findOne({ email }).select('_id').lean();
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered. Please sign in.' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await SellerRegistrationOtp.deleteMany({ email });
    await SellerRegistrationOtp.create({
      email,
      name,
      password,
      phone,
      businessName,
      city,
      otpHash: hashOtp(otp),
      attempts: 0,
      expiresAt,
    });

    try {
      await sendMail({
        to: email,
        subject: 'Your seller registration OTP — The Great India News',
        text: `Your OTP for seller registration is ${otp}. It is valid for 10 minutes.\n\nIf you did not request this, ignore this email.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
            <h2 style="margin:0 0 12px">Confirm your seller registration</h2>
            <p>Use this one-time password to finish creating your marketplace seller account for <strong>${email}</strong>.</p>
            <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:24px 0;color:#0f766e">${otp}</p>
            <p style="font-size:13px;color:#64748b">Valid for 10 minutes. Do not share this code.</p>
          </div>
        `,
      });
    } catch (mailErr) {
      await SellerRegistrationOtp.deleteMany({ email });
      if (mailErr.code === 'SMTP_NOT_CONFIGURED') {
        return res.status(503).json({
          success: false,
          message: 'Email is not set up yet. Ask the site admin to configure SMTP in Admin → Settings.',
        });
      }
      return res.status(502).json({
        success: false,
        message: mailErr.message || 'Could not send OTP email. Check SMTP settings.',
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SellerOTP] ${email} → ${otp}`);
    }

    res.json({
      success: true,
      message: 'OTP sent to your email. Enter the code to complete registration.',
      data: { email, expiresInMinutes: 10 },
    });
  } catch (error) {
    next(error);
  }
};

/** Step 2: verify OTP, create seller account, return login tokens */
export const verifySellerRegisterOtp = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').replace(/\D/g, '');
    if (!email || otp.length !== 6) {
      return res.status(400).json({ success: false, message: 'Email and 6-digit OTP are required' });
    }

    const pending = await SellerRegistrationOtp.findOne({ email }).select('+password +otpHash');
    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found. Please request a new code.',
      });
    }

    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      await SellerRegistrationOtp.deleteMany({ email });
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Request a new OTP.',
      });
    }

    if (pending.otpHash !== hashOtp(otp)) {
      pending.attempts += 1;
      await pending.save();
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${OTP_MAX_ATTEMPTS - pending.attempts} attempt(s) left.`,
      });
    }

    const exists = await User.findOne({ email }).select('_id').lean();
    if (exists) {
      await SellerRegistrationOtp.deleteMany({ email });
      return res.status(400).json({ success: false, message: 'Email already registered. Please sign in.' });
    }

    const user = await User.create({
      name: pending.name,
      email: pending.email,
      password: pending.password,
      role: ROLES.SELLER,
      phone: pending.phone || '',
      businessName: pending.businessName || '',
      city: pending.city || '',
      status: 'active',
    });

    await SellerRegistrationOtp.deleteMany({ email });

    try {
      await sendMail({
        to: email,
        subject: 'Seller account created — The Great India News',
        text: `Welcome ${user.name}! Your seller account is ready. Sign in at the marketplace seller login.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
            <h2 style="margin:0 0 12px">Welcome, ${user.name}!</h2>
            <p>Your marketplace seller account is verified and ready.</p>
            <p>You can sign in anytime with <strong>${email}</strong> and start listing products.</p>
          </div>
        `,
      });
    } catch {
      /* non-fatal welcome mail */
    }

    sendTokenResponse(user, 201, res, {
      message: 'Email verified. Seller account created successfully.',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    next(error);
  }
};

/** Direct register is disabled — use OTP flow */
export const registerSeller = async (req, res) => {
  res.status(400).json({
    success: false,
    message: 'Please verify your email OTP to complete seller registration.',
    code: 'OTP_REQUIRED',
  });
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
      category: category?.trim() || 'Electronics',
      condition: condition || 'used',
      status: MARKETPLACE_PRODUCT_STATUS.APPROVED,
      approvedAt: new Date(),
    });

    res.status(201).json({ success: true, data: product, message: 'Product listed on marketplace' });
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

    // Keep listing live after edits; only force offline when seller/admin sets sold/inactive
    if (req.body.status === MARKETPLACE_PRODUCT_STATUS.SOLD || req.body.status === MARKETPLACE_PRODUCT_STATUS.INACTIVE) {
      product.status = req.body.status;
    } else if (
      product.status === MARKETPLACE_PRODUCT_STATUS.PENDING ||
      product.status === MARKETPLACE_PRODUCT_STATUS.REJECTED
    ) {
      product.status = MARKETPLACE_PRODUCT_STATUS.APPROVED;
      product.approvedAt = product.approvedAt || new Date();
      product.rejectionReason = '';
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

export const deleteEnquiry = async (req, res, next) => {
  try {
    const enquiry = await MarketplaceEnquiry.findOne({ _id: req.params.id, seller: req.user._id });
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }
    await enquiry.deleteOne();
    res.json({ success: true, message: 'Enquiry deleted' });
  } catch (error) {
    next(error);
  }
};

/** Public enquiry to seller */
export const createEnquiry = async (req, res, next) => {
  try {
    const { buyerName, buyerEmail, buyerPhone, message } = req.body;
    const name = buyerName?.trim();
    const email = buyerEmail?.trim()?.toLowerCase();
    const phone = String(buyerPhone || '').replace(/\D/g, '');
    const msg = message?.trim();

    if (!name || !email || !phone || !msg) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone and message are required',
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email' });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid 10-digit phone number',
      });
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
      buyerName: name,
      buyerEmail: email,
      buyerPhone: phone,
      message: msg,
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

export const deleteAdminProduct = async (req, res, next) => {
  try {
    const product = await MarketplaceProduct.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    await MarketplaceEnquiry.deleteMany({ product: product._id });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    next(error);
  }
};

const buildCreatedAtFilter = (from, to) => {
  const createdAt = {};
  if (from) {
    const start = new Date(`${String(from).slice(0, 10)}T00:00:00.000`);
    if (!Number.isNaN(start.getTime())) createdAt.$gte = start;
  }
  if (to) {
    const end = new Date(`${String(to).slice(0, 10)}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) createdAt.$lte = end;
  }
  return Object.keys(createdAt).length ? { createdAt } : null;
};

/** Admin: delete products created within a date range (optional status filter) */
export const deleteAdminProductsByDate = async (req, res, next) => {
  try {
    const { from, to, status, dryRun } = req.body || {};
    if (!from && !to) {
      return res.status(400).json({
        success: false,
        message: 'Provide from and/or to date (YYYY-MM-DD)',
      });
    }

    const dateFilter = buildCreatedAtFilter(from, to);
    if (!dateFilter) {
      return res.status(400).json({ success: false, message: 'Invalid date range' });
    }

    const filter = { ...dateFilter };
    if (status && Object.values(MARKETPLACE_PRODUCT_STATUS).includes(status)) {
      filter.status = status;
    }

    const count = await MarketplaceProduct.countDocuments(filter);
    if (dryRun) {
      return res.json({
        success: true,
        data: { count, filter: { from: from || null, to: to || null, status: status || null } },
      });
    }

    if (!count) {
      return res.json({
        success: true,
        message: 'No products matched that date range',
        data: { deleted: 0 },
      });
    }

    const ids = await MarketplaceProduct.find(filter).select('_id').lean();
    const productIds = ids.map((p) => p._id);
    await MarketplaceEnquiry.deleteMany({ product: { $in: productIds } });
    const result = await MarketplaceProduct.deleteMany({ _id: { $in: productIds } });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} product(s)`,
      data: { deleted: result.deletedCount },
    });
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
