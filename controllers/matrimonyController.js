import crypto from 'crypto';
import MatrimonyProfile from '../models/MatrimonyProfile.js';
import MatrimonyCategory from '../models/MatrimonyCategory.js';
import MatrimonyConfig from '../models/MatrimonyConfig.js';
import MatrimonyEnquiry from '../models/MatrimonyEnquiry.js';
import User from '../models/User.js';
import {
  MATRIMONY_PROFILE_STATUS,
  MATRIMONY_GENDERS,
  MARKETPLACE_ENQUIRY_STATUS,
  ROLES,
} from '../config/constants.js';
import { sendTokenResponse } from '../utils/generateToken.js';

export const getOrCreateMatrimonyConfig = async () => {
  let config = await MatrimonyConfig.findOne({ key: 'default' });
  if (!config) {
    config = await MatrimonyConfig.create({ key: 'default' });
  }
  return config;
};

const calcAge = (dob) => {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
};

const pushHistory = (doc, action, note, userId) => {
  doc.history = doc.history || [];
  doc.history.unshift({
    action,
    note: note || '',
    by: userId || undefined,
    at: new Date(),
  });
  if (doc.history.length > 50) doc.history = doc.history.slice(0, 50);
};

const sanitizePublic = (profile, config) => {
  if (!profile) return null;
  const obj = typeof profile.toObject === 'function' ? profile.toObject() : { ...profile };

  // Full public payload (contact fields gated by settings)
  const data = {
    _id: obj._id,
    profileId: obj.profileId,
    fullName: obj.fullName,
    profilePhoto: obj.profilePhoto || '',
    photos: Array.isArray(obj.photos) ? obj.photos : [],
    gender: obj.gender,
    dateOfBirth: obj.dateOfBirth,
    age: obj.age,
    birthTime: obj.birthTime || '',
    birthPlace: obj.birthPlace || '',
    nativePlace: obj.nativePlace || '',
    currentLocation: obj.currentLocation || '',
    maritalStatus: obj.maritalStatus || '',
    motherTongue: obj.motherTongue || '',
    religion: obj.religion || '',
    caste: obj.caste || '',
    subCaste: obj.subCaste || '',
    rasi: obj.rasi || '',
    nakshatra: obj.nakshatra || '',
    lagnam: obj.lagnam || '',
    gothram: obj.gothram || '',
    birthStar: obj.birthStar || '',
    dosham: obj.dosham || '',
    height: obj.height || '',
    weight: obj.weight || '',
    bodyType: obj.bodyType || '',
    complexion: obj.complexion || '',
    physicalStatus: obj.physicalStatus || '',
    bloodGroup: obj.bloodGroup || '',
    education: obj.education || '',
    college: obj.college || '',
    profession: obj.profession || '',
    company: obj.company || '',
    jobLocation: obj.jobLocation || '',
    annualIncome: obj.annualIncome || '',
    workExperience: obj.workExperience || '',
    fatherName: obj.fatherName || '',
    fatherOccupation: obj.fatherOccupation || '',
    motherName: obj.motherName || '',
    motherOccupation: obj.motherOccupation || '',
    brotherName: obj.brotherName || '',
    brotherMaritalStatus: obj.brotherMaritalStatus || '',
    sisterName: obj.sisterName || '',
    sisterMaritalStatus: obj.sisterMaritalStatus || '',
    numberOfBrothers: obj.numberOfBrothers ?? 0,
    numberOfSisters: obj.numberOfSisters ?? 0,
    familyType: obj.familyType || '',
    familyStatus: obj.familyStatus || '',
    familyLocation: obj.familyLocation || '',
    city: obj.city || '',
    district: obj.district || '',
    state: obj.state || '',
    country: obj.country || '',
    preferredContactMethod: obj.preferredContactMethod || '',
    prefAgeMin: obj.prefAgeMin,
    prefAgeMax: obj.prefAgeMax,
    prefHeightMin: obj.prefHeightMin || '',
    prefHeightMax: obj.prefHeightMax || '',
    prefReligion: obj.prefReligion || '',
    prefCaste: obj.prefCaste || '',
    prefEducation: obj.prefEducation || '',
    prefProfession: obj.prefProfession || '',
    prefLocation: obj.prefLocation || '',
    prefMaritalStatus: obj.prefMaritalStatus || '',
    otherExpectations: obj.otherExpectations || '',
    aboutMe: obj.aboutMe || '',
    hobbies: obj.hobbies || '',
    interests: obj.interests || '',
    foodHabits: obj.foodHabits || '',
    smoking: obj.smoking || '',
    drinking: obj.drinking || '',
    languagesKnown: obj.languagesKnown || '',
    categoryName: obj.categoryName || '',
    isVerified: Boolean(obj.isVerified),
    isFeatured: Boolean(obj.isFeatured),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };

  if (config?.showMobilePublic) data.mobile = obj.mobile || '';
  if (config?.showAlternateMobilePublic) data.alternateMobile = obj.alternateMobile || '';
  if (config?.showEmailPublic) data.email = obj.email || '';
  if (config?.showAddressPublic) data.address = obj.address || '';
  if (config?.allowHoroscopeDownload) data.horoscopeUrl = obj.horoscopeUrl || '';

  return data;
};

const publicCard = (p) => ({
  _id: p._id,
  profileId: p.profileId,
  fullName: p.fullName,
  profilePhoto: p.profilePhoto,
  gender: p.gender,
  age: p.age,
  education: p.education,
  profession: p.profession,
  currentLocation: p.currentLocation || p.city,
  city: p.city,
  religion: p.religion,
  caste: p.caste,
  rasi: p.rasi,
  nakshatra: p.nakshatra,
  height: p.height,
  isVerified: p.isVerified,
  isFeatured: p.isFeatured,
  createdAt: p.createdAt,
});

const nextProfileId = async (config) => {
  const prefix = (config.profileIdPrefix || 'GIN-M').toUpperCase();
  const year = new Date().getFullYear();
  const count = await MatrimonyProfile.countDocuments();
  let candidate;
  let tries = 0;
  do {
    const n = String(count + 1 + tries).padStart(4, '0');
    candidate = `${prefix}-${year}-${n}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await MatrimonyProfile.exists({ profileId: candidate });
    if (!exists) return candidate;
    tries += 1;
  } while (tries < 50);
  return `${prefix}-${year}-${Date.now().toString(36).toUpperCase()}`;
};

const submissionFingerprint = (body) => {
  const raw = [
    String(body.fullName || '').trim().toLowerCase(),
    String(body.gender || ''),
    body.dateOfBirth ? new Date(body.dateOfBirth).toISOString().slice(0, 10) : '',
    String(body.mobile || '').replace(/\D/g, ''),
    String(body.email || '').trim().toLowerCase(),
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
};

const pickBody = (body = {}) => {
  const fields = [
    'fullName', 'profilePhoto', 'photos', 'gender', 'dateOfBirth', 'birthTime', 'birthPlace',
    'nativePlace', 'currentLocation', 'maritalStatus', 'motherTongue',
    'religion', 'caste', 'subCaste', 'rasi', 'nakshatra', 'lagnam', 'gothram', 'birthStar',
    'dosham', 'horoscopeUrl',
    'height', 'weight', 'bodyType', 'complexion', 'physicalStatus', 'bloodGroup',
    'education', 'college', 'profession', 'company', 'jobLocation', 'annualIncome', 'workExperience',
    'fatherName', 'fatherOccupation', 'motherName', 'motherOccupation',
    'brotherName', 'brotherMaritalStatus', 'sisterName', 'sisterMaritalStatus',
    'numberOfBrothers', 'numberOfSisters', 'familyType', 'familyStatus', 'familyLocation',
    'address', 'city', 'district', 'state', 'country', 'mobile', 'alternateMobile', 'email',
    'preferredContactMethod',
    'prefAgeMin', 'prefAgeMax', 'prefHeightMin', 'prefHeightMax', 'prefReligion', 'prefCaste',
    'prefEducation', 'prefProfession', 'prefLocation', 'prefMaritalStatus', 'otherExpectations',
    'aboutMe', 'hobbies', 'interests', 'foodHabits', 'smoking', 'drinking', 'languagesKnown',
    'adminNotes', 'categoryName', 'isVisible',
  ];
  const out = {};
  for (const f of fields) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  if (body.category !== undefined) {
    out.category = body.category || null;
  }
  if (body.dateOfBirth) {
    out.age = calcAge(body.dateOfBirth);
  }
  if (Array.isArray(body.photos)) {
    out.photos = body.photos.map(String).filter(Boolean);
  }
  return out;
};

const REQUIRED_PROFILE_FIELD_LABELS = {
  fullName: 'Full name',
  gender: 'Gender',
  profilePhoto: 'Profile photo',
  dateOfBirth: 'Date of birth',
  birthTime: 'Birth time',
  birthPlace: 'Birth place',
  nativePlace: 'Native place',
  currentLocation: 'Current location',
  maritalStatus: 'Marital status',
  motherTongue: 'Mother tongue',
  category: 'Category',
  categoryName: 'Category name',
  religion: 'Religion',
  caste: 'Caste',
  subCaste: 'Sub-caste',
  rasi: 'Rasi',
  nakshatra: 'Nakshatra',
  lagnam: 'Lagnam',
  gothram: 'Gothram',
  birthStar: 'Birth star',
  dosham: 'Dosham',
  horoscopeUrl: 'Horoscope',
  height: 'Height',
  weight: 'Weight',
  bodyType: 'Body type',
  complexion: 'Complexion',
  physicalStatus: 'Physical status',
  bloodGroup: 'Blood group',
  education: 'Education',
  college: 'College',
  profession: 'Profession',
  company: 'Company',
  jobLocation: 'Job location',
  annualIncome: 'Annual income',
  workExperience: 'Work experience',
  fatherName: "Father's name",
  fatherOccupation: "Father's occupation",
  motherName: "Mother's name",
  motherOccupation: "Mother's occupation",
  brotherName: "Brother's name",
  brotherMaritalStatus: "Brother's marital status",
  sisterName: "Sister's name",
  sisterMaritalStatus: "Sister's marital status",
  familyType: 'Family type',
  familyStatus: 'Family status',
  familyLocation: 'Family location',
  address: 'Address',
  city: 'City',
  district: 'District',
  state: 'State',
  country: 'Country',
  mobile: 'Mobile number',
  alternateMobile: 'Alternate mobile',
  email: 'Email',
  preferredContactMethod: 'Preferred contact method',
  prefAgeMin: 'Preferred age min',
  prefAgeMax: 'Preferred age max',
  prefHeightMin: 'Preferred height min',
  prefHeightMax: 'Preferred height max',
  prefReligion: 'Preferred religion',
  prefCaste: 'Preferred caste',
  prefEducation: 'Preferred education',
  prefProfession: 'Preferred profession',
  prefLocation: 'Preferred location',
  prefMaritalStatus: 'Preferred marital status',
  otherExpectations: 'Other expectations',
  aboutMe: 'About me',
  hobbies: 'Hobbies',
  interests: 'Interests',
  foodHabits: 'Food habits',
  smoking: 'Smoking',
  drinking: 'Drinking',
  languagesKnown: 'Languages known',
};

const validateRequiredProfileFields = (body) => {
  for (const [key, label] of Object.entries(REQUIRED_PROFILE_FIELD_LABELS)) {
    const val = body[key];
    if (val === undefined || val === null || String(val).trim() === '') {
      return `${label} is required`;
    }
  }
  if (!Array.isArray(body.photos) || body.photos.filter(Boolean).length === 0) {
    return 'At least one additional photo is required';
  }
  const phone = String(body.mobile || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(phone)) {
    return 'Enter a valid 10-digit mobile number';
  }
  const altPhone = String(body.alternateMobile || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(altPhone)) {
    return 'Enter a valid 10-digit alternate mobile number';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email || '').trim())) {
    return 'Enter a valid email address';
  }
  return null;
};

/* ─── Config ─── */
export const getConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateMatrimonyConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

export const updateConfig = async (req, res, next) => {
  try {
    const config = await getOrCreateMatrimonyConfig();
    const allowed = [
      'enabled', 'homepageTitle', 'homepageTitleTa', 'showOnExplore',
      'showMobilePublic', 'showEmailPublic', 'showAddressPublic', 'showAlternateMobilePublic',
      'requireApproval', 'autoGenerateProfileId', 'profileIdPrefix',
      'allowHoroscopeDownload', 'maxProfilesPerPage',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) config[key] = req.body[key];
    }
    await config.save();
    res.json({ success: true, data: config, message: 'Settings saved' });
  } catch (error) {
    next(error);
  }
};

/* ─── Categories ─── */
export const listCategories = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.active === '1') filter.isActive = true;
    const data = await MatrimonyCategory.find(filter).sort({ order: 1, name: 1 }).lean();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const slug =
      String(req.body.slug || name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `cat-${Date.now()}`;
    const exists = await MatrimonyCategory.findOne({ slug });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Category slug already exists' });
    }
    const cat = await MatrimonyCategory.create({
      name,
      nameTamil: req.body.nameTamil || '',
      slug,
      description: req.body.description || '',
      order: Number(req.body.order) || 0,
      isActive: req.body.isActive !== false,
    });
    res.status(201).json({ success: true, data: cat });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const cat = await MatrimonyCategory.findById(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
    ['name', 'nameTamil', 'description', 'order', 'isActive'].forEach((k) => {
      if (req.body[k] !== undefined) cat[k] = req.body[k];
    });
    if (req.body.slug) {
      cat.slug = String(req.body.slug).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    await cat.save();
    res.json({ success: true, data: cat });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const cat = await MatrimonyCategory.findByIdAndDelete(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
    await MatrimonyProfile.updateMany({ category: cat._id }, { $set: { category: null } });
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
};

/* ─── Admin dashboard ─── */
export const getDashboard = async (req, res, next) => {
  try {
    const [total, pending, approved, rejected, featured, verified, inactive] = await Promise.all([
      MatrimonyProfile.countDocuments(),
      MatrimonyProfile.countDocuments({ status: MATRIMONY_PROFILE_STATUS.PENDING }),
      MatrimonyProfile.countDocuments({ status: MATRIMONY_PROFILE_STATUS.APPROVED }),
      MatrimonyProfile.countDocuments({ status: MATRIMONY_PROFILE_STATUS.REJECTED }),
      MatrimonyProfile.countDocuments({ isFeatured: true }),
      MatrimonyProfile.countDocuments({ isVerified: true }),
      MatrimonyProfile.countDocuments({
        $or: [{ isActive: false }, { status: MATRIMONY_PROFILE_STATUS.INACTIVE }],
      }),
    ]);
    const recent = await MatrimonyProfile.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .select('profileId fullName status isVerified isFeatured profilePhoto createdAt gender age')
      .lean();
    res.json({
      success: true,
      data: {
        stats: { total, pending, approved, rejected, featured, verified, inactive },
        recent,
      },
    });
  } catch (error) {
    next(error);
  }
};

/* ─── Admin profiles CRUD ─── */
export const listAdminProfiles = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.query.status && Object.values(MATRIMONY_PROFILE_STATUS).includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.featured === '1') filter.isFeatured = true;
    if (req.query.verified === '1') filter.isVerified = true;
    if (req.query.active === '0') filter.isActive = false;
    if (req.query.active === '1') filter.isActive = true;
    if (req.query.gender && MATRIMONY_GENDERS.includes(req.query.gender)) {
      filter.gender = req.query.gender;
    }
    if (req.query.religion) filter.religion = new RegExp(String(req.query.religion).trim(), 'i');
    if (req.query.caste) filter.caste = new RegExp(String(req.query.caste).trim(), 'i');
    if (req.query.q) {
      const q = String(req.query.q).trim();
      filter.$or = [
        { fullName: new RegExp(q, 'i') },
        { profileId: new RegExp(q, 'i') },
        { mobile: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { city: new RegExp(q, 'i') },
        { profession: new RegExp(q, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      MatrimonyProfile.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('category', 'name slug')
        .lean(),
      MatrimonyProfile.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminProfile = async (req, res, next) => {
  try {
    const profile = await MatrimonyProfile.findById(req.params.id)
      .select('+memberLoginPasswordPlain')
      .populate('category', 'name slug')
      .populate('createdBy', 'name email phone city')
      .populate('updatedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('history.by', 'name email');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    const memberUser = await findMemberUserForProfile(profile);
    const data = profile.toObject();
    data.memberAccount = memberAccountPayload(memberUser, profile.memberLoginPasswordPlain || '');

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createProfile = async (req, res, next) => {
  try {
    const config = await getOrCreateMatrimonyConfig();
    const body = pickBody(req.body);

    if (!body.fullName?.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }
    if (!body.gender || !MATRIMONY_GENDERS.includes(body.gender)) {
      return res.status(400).json({ success: false, message: 'Valid gender is required' });
    }

    let profileId = String(req.body.profileId || '').trim().toUpperCase();
    if (!profileId) {
      if (config.autoGenerateProfileId) {
        profileId = await nextProfileId(config);
      } else {
        return res.status(400).json({ success: false, message: 'Profile ID is required' });
      }
    }

    const idExists = await MatrimonyProfile.exists({ profileId });
    if (idExists) {
      return res.status(400).json({ success: false, message: 'Profile ID already exists' });
    }

    const hash = submissionFingerprint({ ...body, mobile: body.mobile, email: body.email });
    const dup = await MatrimonyProfile.findOne({ submissionHash: hash });
    if (dup) {
      return res.status(400).json({
        success: false,
        message: `Duplicate profile detected (${dup.profileId}). Edit the existing profile instead.`,
      });
    }

    const status = config.requireApproval
      ? MATRIMONY_PROFILE_STATUS.PENDING
      : MATRIMONY_PROFILE_STATUS.APPROVED;

    const doc = new MatrimonyProfile({
      ...body,
      profileId,
      submissionHash: hash,
      status,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
      isActive: true,
      isVisible: body.isVisible !== false,
    });

    if (status === MATRIMONY_PROFILE_STATUS.APPROVED) {
      doc.approvedAt = new Date();
      doc.approvedBy = req.user?._id;
    }

    pushHistory(doc, 'created', 'Profile created', req.user?._id);

    try {
      const synced = await syncMemberLoginOnCreate({
        name: req.body.memberName,
        email: req.body.memberLoginEmail || body.email,
        password: req.body.memberPassword,
        phone: req.body.memberPhone || body.mobile,
        city: req.body.memberCity || body.city,
        profileBody: body,
      });
      if (synced?.user) {
        doc.createdBy = synced.user._id;
        if (synced.plainPassword) {
          doc.memberLoginPasswordPlain = synced.plainPassword;
        }
        if (!body.email && synced.user.email) doc.email = synced.user.email;
        if (!body.mobile && synced.user.phone) doc.mobile = synced.user.phone;
        if (!body.city && synced.user.city) doc.city = synced.user.city;
      }
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      throw err;
    }

    await doc.save();

    res.status(201).json({ success: true, data: doc, message: 'Profile created' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Duplicate profile ID' });
    }
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const doc = await MatrimonyProfile.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Profile not found' });

    if (req.body.profileId !== undefined) {
      const nextId = String(req.body.profileId).trim().toUpperCase();
      if (nextId && nextId !== doc.profileId) {
        const exists = await MatrimonyProfile.exists({ profileId: nextId, _id: { $ne: doc._id } });
        if (exists) {
          return res.status(400).json({ success: false, message: 'Profile ID already exists' });
        }
        doc.profileId = nextId;
      }
    }

    const body = pickBody(req.body);
    Object.assign(doc, body);
    doc.updatedBy = req.user?._id;
    doc.submissionHash = submissionFingerprint({
      fullName: doc.fullName,
      gender: doc.gender,
      dateOfBirth: doc.dateOfBirth,
      mobile: doc.mobile,
      email: doc.email,
    });

    try {
      const synced = await syncMemberLoginOnUpdate(doc, {
        name: req.body.memberName,
        email: req.body.memberLoginEmail || body.email,
        phone: req.body.memberPhone ?? body.mobile,
        city: req.body.memberCity ?? body.city,
        newPassword: req.body.newPassword || req.body.memberPassword,
        profileBody: body,
      });
      if (synced?.user) {
        doc.createdBy = synced.user._id;
        if (synced.plainPassword) {
          doc.memberLoginPasswordPlain = synced.plainPassword;
        }
      }
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      throw err;
    }

    pushHistory(doc, 'updated', 'Profile updated', req.user?._id);
    await doc.save();
    res.json({ success: true, data: doc, message: 'Profile updated' });
  } catch (error) {
    next(error);
  }
};

export const deleteProfile = async (req, res, next) => {
  try {
    const doc = await MatrimonyProfile.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, message: 'Profile deleted' });
  } catch (error) {
    next(error);
  }
};

export const reviewProfile = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    if (![MATRIMONY_PROFILE_STATUS.APPROVED, MATRIMONY_PROFILE_STATUS.REJECTED, MATRIMONY_PROFILE_STATUS.PENDING].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const doc = await MatrimonyProfile.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Profile not found' });

    doc.status = status;
    if (status === MATRIMONY_PROFILE_STATUS.APPROVED) {
      doc.approvedAt = new Date();
      doc.approvedBy = req.user?._id;
      doc.rejectionReason = '';
      doc.isActive = true;
      pushHistory(doc, 'approved', 'Profile approved', req.user?._id);
    } else if (status === MATRIMONY_PROFILE_STATUS.REJECTED) {
      doc.rejectedAt = new Date();
      doc.rejectionReason = rejectionReason || 'Does not meet guidelines';
      pushHistory(doc, 'rejected', doc.rejectionReason, req.user?._id);
    } else {
      pushHistory(doc, 'pending', 'Moved to pending', req.user?._id);
    }
    doc.updatedBy = req.user?._id;
    await doc.save();
    res.json({ success: true, data: doc, message: `Profile ${status.toLowerCase()}` });
  } catch (error) {
    next(error);
  }
};

export const toggleFlags = async (req, res, next) => {
  try {
    const doc = await MatrimonyProfile.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Profile not found' });

    const notes = [];
    if (req.body.isVerified !== undefined) {
      doc.isVerified = Boolean(req.body.isVerified);
      if (doc.isVerified) {
        doc.verifiedAt = new Date();
        doc.verifiedBy = req.user?._id;
      }
      notes.push(doc.isVerified ? 'verified' : 'unverified');
    }
    if (req.body.isFeatured !== undefined) {
      doc.isFeatured = Boolean(req.body.isFeatured);
      doc.featuredAt = doc.isFeatured ? new Date() : undefined;
      notes.push(doc.isFeatured ? 'featured' : 'unfeatured');
    }
    if (req.body.isActive !== undefined) {
      doc.isActive = Boolean(req.body.isActive);
      if (!doc.isActive) doc.status = MATRIMONY_PROFILE_STATUS.INACTIVE;
      notes.push(doc.isActive ? 'activated' : 'deactivated');
    }
    if (req.body.isVisible !== undefined) {
      doc.isVisible = Boolean(req.body.isVisible);
      notes.push(doc.isVisible ? 'visible' : 'hidden');
    }

    pushHistory(doc, 'flags', notes.join(', '), req.user?._id);
    doc.updatedBy = req.user?._id;
    await doc.save();
    res.json({ success: true, data: doc, message: 'Profile updated' });
  } catch (error) {
    next(error);
  }
};

/* ─── Public APIs (privacy-safe) ─── */
const publicFilter = () => ({
  status: MATRIMONY_PROFILE_STATUS.APPROVED,
  isActive: true,
  isVisible: true,
});

const findPublicProfileByParam = async (id) => {
  const or = [{ profileId: String(id).toUpperCase() }];
  if (/^[a-f\d]{24}$/i.test(id)) or.unshift({ _id: id });
  return MatrimonyProfile.findOne({ ...publicFilter(), $or: or });
};

export const createEnquiry = async (req, res, next) => {
  try {
    const { enquirerName, enquirerPhone, comment } = req.body;
    if (!enquirerName?.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (!enquirerPhone?.trim()) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }
    if (!comment?.trim()) {
      return res.status(400).json({ success: false, message: 'Comment is required' });
    }

    const profile = await findPublicProfileByParam(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const ownerUser = await findMemberUserForProfile(profile);
    const profileOwnerId = ownerUser?._id || profile.createdBy || undefined;

    if (req.user?._id) {
      const uid = req.user._id;
      const isOwnProfile =
        (profile.createdBy && profile.createdBy.equals(uid))
        || (ownerUser?._id && ownerUser._id.equals(uid));
      if (isOwnProfile) {
        return res.status(400).json({ success: false, message: 'You cannot send an enquiry on your own profile' });
      }
    }

    const enquiry = await MatrimonyEnquiry.create({
      profile: profile._id,
      profileOwner: profileOwnerId,
      submittedBy: req.user?._id || undefined,
      enquirerName: enquirerName.trim(),
      enquirerPhone: enquirerPhone.trim(),
      comment: comment.trim(),
    });

    res.status(201).json({
      success: true,
      data: enquiry,
      message: 'Enquiry submitted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getMySubmittedEnquiries = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const myProfile = await MatrimonyProfile.findOne({ createdBy: userId }).select('_id').lean();

    const sentConditions = [{ submittedBy: userId }];
    const phone = String(req.user.phone || '').trim();
    if (phone) {
      sentConditions.push({
        enquirerPhone: phone,
        $or: [{ submittedBy: { $exists: false } }, { submittedBy: null }],
      });
    }

    const receivedConditions = [{ profileOwner: userId }];
    if (myProfile?._id) {
      receivedConditions.push({ profile: myProfile._id });
    }

    const [sentRows, receivedRows] = await Promise.all([
      MatrimonyEnquiry.find({ $or: sentConditions })
        .populate('profile', 'fullName profileId profilePhoto city age gender mobile')
        .sort({ createdAt: -1 })
        .lean(),
      MatrimonyEnquiry.find({ $or: receivedConditions })
        .populate('profile', 'fullName profileId profilePhoto city age gender mobile')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const byId = new Map();
    sentRows.forEach((row) => byId.set(String(row._id), { ...row, enquiryType: 'sent' }));
    receivedRows.forEach((row) => {
      const key = String(row._id);
      if (byId.has(key)) {
        byId.set(key, { ...byId.get(key), enquiryType: 'both' });
      } else {
        byId.set(key, { ...row, enquiryType: 'received' });
      }
    });

    let data = [...byId.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const submitterIds = [
      ...new Set(data.map((row) => (row.submittedBy ? String(row.submittedBy) : null)).filter(Boolean)),
    ];
    const phones = [
      ...new Set(
        data
          .filter((row) => !row.submittedBy && row.enquirerPhone)
          .map((row) => String(row.enquirerPhone).replace(/\D/g, ''))
          .filter((p) => p.length >= 10)
      ),
    ];

    const enquirerProfiles = [];
    if (submitterIds.length) {
      const byUser = await MatrimonyProfile.find({ createdBy: { $in: submitterIds } })
        .select('fullName profileId profilePhoto city age gender createdBy mobile')
        .lean();
      enquirerProfiles.push(...byUser);
    }
    if (phones.length) {
      const phoneUsers = await User.find({
        $or: phones.flatMap((p) => [{ phone: p }, { phone: p.slice(-10) }]),
      })
        .select('_id phone')
        .lean();
      const phoneUserIds = phoneUsers.map((u) => u._id);
      if (phoneUserIds.length) {
        const byPhoneUser = await MatrimonyProfile.find({ createdBy: { $in: phoneUserIds } })
          .select('fullName profileId profilePhoto city age gender createdBy mobile')
          .lean();
        enquirerProfiles.push(...byPhoneUser);
      }
      const byMobile = await MatrimonyProfile.find({
        $or: phones.flatMap((p) => [{ mobile: p }, { mobile: p.slice(-10) }]),
      })
        .select('fullName profileId profilePhoto city age gender createdBy mobile')
        .lean();
      enquirerProfiles.push(...byMobile);
    }

    const profileByUserId = new Map();
    const profileByPhone = new Map();
    for (const p of enquirerProfiles) {
      if (p.createdBy) profileByUserId.set(String(p.createdBy), p);
      const digits = String(p.mobile || '').replace(/\D/g, '');
      if (digits.length >= 10) profileByPhone.set(digits.slice(-10), p);
    }

    data = data.map((row) => {
      let enquirerProfile = null;
      if (row.submittedBy) {
        enquirerProfile = profileByUserId.get(String(row.submittedBy)) || null;
      }
      if (!enquirerProfile && row.enquirerPhone) {
        const digits = String(row.enquirerPhone).replace(/\D/g, '').slice(-10);
        enquirerProfile = profileByPhone.get(digits) || null;
      }
      return { ...row, enquirerProfile };
    });

    res.json({ success: true, data, sent: sentRows, received: receivedRows });
  } catch (error) {
    next(error);
  }
};

export const deleteMyEnquiry = async (req, res, next) => {
  try {
    const enquiry = await MatrimonyEnquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    const uid = req.user._id;
    const isOwner = enquiry.profileOwner && String(enquiry.profileOwner) === String(uid);
    const isSubmitter = enquiry.submittedBy && String(enquiry.submittedBy) === String(uid);
    const phone = String(req.user.phone || '').replace(/\D/g, '');
    const enquiryPhone = String(enquiry.enquirerPhone || '').replace(/\D/g, '');
    const isPhoneMatch =
      phone.length >= 10
      && enquiryPhone.length >= 10
      && phone.slice(-10) === enquiryPhone.slice(-10)
      && !enquiry.submittedBy;

    if (!isOwner && !isSubmitter && !isPhoneMatch) {
      return res.status(403).json({ success: false, message: 'Not allowed to delete this enquiry' });
    }

    await enquiry.deleteOne();
    res.json({ success: true, message: 'Enquiry deleted' });
  } catch (error) {
    next(error);
  }
};

export const getReceivedEnquiries = async (req, res, next) => {
  try {
    const enquiries = await MatrimonyEnquiry.find({ profileOwner: req.user._id })
      .populate('profile', 'fullName profileId profilePhoto city')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: enquiries });
  } catch (error) {
    next(error);
  }
};

export const updateReceivedEnquiry = async (req, res, next) => {
  try {
    const enquiry = await MatrimonyEnquiry.findOne({
      _id: req.params.id,
      profileOwner: req.user._id,
    });
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }
    if (req.body.status && Object.values(MARKETPLACE_ENQUIRY_STATUS).includes(req.body.status)) {
      enquiry.status = req.body.status;
    }
    await enquiry.save();
    res.json({ success: true, data: enquiry });
  } catch (error) {
    next(error);
  }
};

export const getAdminProfileEnquiries = async (req, res, next) => {
  try {
    const profile = await MatrimonyProfile.findById(req.params.id).select('fullName profileId');
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const enquiries = await MatrimonyEnquiry.find({ profile: profile._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: enquiries,
      profile: { _id: profile._id, fullName: profile.fullName, profileId: profile.profileId },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminEnquiry = async (req, res, next) => {
  try {
    const enquiry = await MatrimonyEnquiry.findById(req.params.enquiryId);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }
    if (req.body.status && Object.values(MARKETPLACE_ENQUIRY_STATUS).includes(req.body.status)) {
      enquiry.status = req.body.status;
    }
    await enquiry.save();
    res.json({ success: true, data: enquiry });
  } catch (error) {
    next(error);
  }
};

export const getPublicProfiles = async (req, res, next) => {
  try {
    const config = await getOrCreateMatrimonyConfig();
    if (!config.enabled) {
      return res.json({
        success: true,
        enabled: false,
        title: config.homepageTitle,
        titleTa: config.homepageTitleTa,
        data: [],
        pagination: { page: 1, pages: 1, total: 0 },
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || config.maxProfilesPerPage || 18, 1),
      48
    );
    const skip = (page - 1) * limit;
    const filter = publicFilter();

    if (req.query.gender && MATRIMONY_GENDERS.includes(req.query.gender)) {
      filter.gender = req.query.gender;
    }
    if (req.query.religion) filter.religion = new RegExp(String(req.query.religion).trim(), 'i');
    if (req.query.caste) filter.caste = new RegExp(String(req.query.caste).trim(), 'i');
    if (req.query.city) {
      const city = String(req.query.city).trim();
      filter.$or = [
        { city: new RegExp(city, 'i') },
        { currentLocation: new RegExp(city, 'i') },
        { district: new RegExp(city, 'i') },
      ];
    }
    if (req.query.maritalStatus) filter.maritalStatus = req.query.maritalStatus;
    if (req.query.featured === '1') filter.isFeatured = true;
    if (req.query.verified === '1') filter.isVerified = true;
    if (req.query.ageMin || req.query.ageMax) {
      filter.age = {};
      if (req.query.ageMin) filter.age.$gte = Number(req.query.ageMin);
      if (req.query.ageMax) filter.age.$lte = Number(req.query.ageMax);
    }
    if (req.query.q) {
      const q = String(req.query.q).trim();
      filter.$and = (filter.$and || []).concat([
        {
          $or: [
            { fullName: new RegExp(q, 'i') },
            { profileId: new RegExp(q, 'i') },
            { education: new RegExp(q, 'i') },
            { profession: new RegExp(q, 'i') },
            { religion: new RegExp(q, 'i') },
            { caste: new RegExp(q, 'i') },
            { city: new RegExp(q, 'i') },
          ],
        },
      ]);
    }

    let sort = { isFeatured: -1, createdAt: -1 };
    if (req.query.sort === 'latest') sort = { createdAt: -1 };
    if (req.query.sort === 'age_asc') sort = { age: 1 };
    if (req.query.sort === 'age_desc') sort = { age: -1 };
    if (req.query.sort === 'featured') sort = { isFeatured: -1, createdAt: -1 };

    const [items, total] = await Promise.all([
      MatrimonyProfile.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      MatrimonyProfile.countDocuments(filter),
    ]);

    res.json({
      success: true,
      enabled: true,
      title: config.homepageTitle,
      titleTa: config.homepageTitleTa,
      data: items.map(publicCard),
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (error) {
    next(error);
  }
};

export const getHubProfiles = async (req, res, next) => {
  try {
    const config = await getOrCreateMatrimonyConfig();
    if (!config.enabled || !config.showOnExplore) {
      return res.json({ success: true, enabled: false, data: [] });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 3, 12);
    const items = await MatrimonyProfile.find(publicFilter())
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({
      success: true,
      enabled: true,
      title: config.homepageTitle,
      titleTa: config.homepageTitleTa,
      data: items.map(publicCard),
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicProfile = async (req, res, next) => {
  try {
    const config = await getOrCreateMatrimonyConfig();
    const { id } = req.params;
    const or = [{ profileId: String(id).toUpperCase() }];
    if (/^[a-f\d]{24}$/i.test(id)) or.unshift({ _id: id });

    const profile = await MatrimonyProfile.findOne({
      ...publicFilter(),
      $or: or,
    }).lean();

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const related = await MatrimonyProfile.find({
      ...publicFilter(),
      _id: { $ne: profile._id },
      gender: profile.gender,
    })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

    res.json({
      success: true,
      data: sanitizePublic(profile, config),
      related: related.map(publicCard),
      contactVisibility: {
        showMobile: Boolean(config.showMobilePublic),
        showEmail: Boolean(config.showEmailPublic),
        showAddress: Boolean(config.showAddressPublic),
        showAlternateMobile: Boolean(config.showAlternateMobilePublic),
        allowHoroscopeDownload: Boolean(config.allowHoroscopeDownload),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicCategories = async (req, res, next) => {
  try {
    const data = await MatrimonyCategory.find({ isActive: true }).sort({ order: 1 }).lean();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const memberPickBody = (body = {}) => {
  const picked = pickBody(body);
  delete picked.adminNotes;
  return picked;
};

const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const findMemberUserForProfile = async (profile) => {
  const createdBy = profile.createdBy;
  if (createdBy) {
    const userId = createdBy._id || createdBy;
    const user = await User.findById(userId);
    if (user?.role === ROLES.MATRIMONY) return user;
  }
  const email = String(profile.email || '').trim().toLowerCase();
  if (email) {
    return User.findOne({ email, role: ROLES.MATRIMONY });
  }
  return null;
};

const memberAccountPayload = (user, storedPassword = '') =>
  user
    ? {
        _id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone || '',
        city: user.city || '',
        hasPassword: true,
        storedPassword: storedPassword || '',
      }
    : null;

const syncMemberLoginOnCreate = async ({
  name,
  email,
  password,
  phone,
  city,
  profileBody,
}) => {
  const loginEmail = String(email || profileBody.email || '').trim().toLowerCase();
  if (!loginEmail) return null;

  const pwd = String(password || '').trim();
  if (!pwd) throw httpError(400, 'Password is required for member login');
  if (pwd.length < 6) throw httpError(400, 'Password must be at least 6 characters');

  const exists = await User.findOne({ email: loginEmail });
  if (exists) {
    if (exists.role === ROLES.MATRIMONY) {
      exists.name = name?.trim() || profileBody.fullName?.trim() || exists.name;
      if (phone) exists.phone = String(phone).trim();
      if (city) exists.city = String(city).trim();
      exists.password = pwd;
      await exists.save();
      return { user: exists, plainPassword: pwd };
    }
    throw httpError(400, 'Email already registered with another account');
  }

  const displayName = name?.trim() || profileBody.fullName?.trim() || loginEmail.split('@')[0] || 'Member';

  const user = await User.create({
    name: displayName,
    email: loginEmail,
    password: pwd,
    role: ROLES.MATRIMONY,
    phone: String(phone || profileBody.mobile || '').trim(),
    city: String(city || profileBody.city || '').trim(),
    status: 'active',
  });

  return { user, plainPassword: pwd };
};

const syncMemberLoginOnUpdate = async (profile, {
  name,
  email,
  phone,
  city,
  newPassword,
  profileBody,
}) => {
  let user = await findMemberUserForProfile(profile);
  const loginEmail = String(email || profileBody.email || '').trim().toLowerCase();

  if (!user && !loginEmail) return null;

  if (!user && loginEmail) {
    const pwd = String(newPassword || '').trim();
    if (!pwd) throw httpError(400, 'New password is required to create member login');
    if (pwd.length < 6) throw httpError(400, 'Password must be at least 6 characters');
    const created = await syncMemberLoginOnCreate({
      name,
      email: loginEmail,
      password: pwd,
      phone,
      city,
      profileBody,
    });
    return created;
  }

  if (name?.trim()) user.name = name.trim();
  if (loginEmail && loginEmail !== user.email) {
    const taken = await User.findOne({ email: loginEmail, _id: { $ne: user._id } });
    if (taken) throw httpError(400, 'Email already registered');
    user.email = loginEmail;
  }
  if (phone !== undefined) user.phone = String(phone).trim();
  if (city !== undefined) user.city = String(city).trim();

  const pwd = String(newPassword || '').trim();
  if (pwd) {
    if (pwd.length < 6) throw httpError(400, 'Password must be at least 6 characters');
    user.password = pwd;
    await user.save();
    return { user, plainPassword: pwd };
  }

  await user.save();
  return { user, plainPassword: undefined };
};

/* ─── Member portal ─── */
export const registerMatrimonyMember = async (req, res, next) => {
  try {
    const { name, email, password, phone, city } = req.body;
    if (!name?.trim() || !email?.trim() || !password || !phone?.trim() || !city?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, phone and city are required',
      });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const phoneDigits = String(phone).replace(/\D/g, '');
    if (!/^\d{10}$/.test(phoneDigits)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
    }

    const exists = await User.findOne({ email: email.trim().toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: ROLES.MATRIMONY,
      phone: phoneDigits,
      city: city.trim(),
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

export const getMyProfile = async (req, res, next) => {
  try {
    const profile = await MatrimonyProfile.findOne({ createdBy: req.user._id })
      .populate('category', 'name slug')
      .lean();
    res.json({ success: true, data: profile || null });
  } catch (error) {
    next(error);
  }
};

export const createMyProfile = async (req, res, next) => {
  try {
    const existing = await MatrimonyProfile.findOne({ createdBy: req.user._id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have a profile. Edit your existing profile instead.',
      });
    }

    const config = await getOrCreateMatrimonyConfig();
    const body = memberPickBody(req.body);

    if (!body.fullName?.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }
    if (!body.gender || !MATRIMONY_GENDERS.includes(body.gender)) {
      return res.status(400).json({ success: false, message: 'Valid gender is required' });
    }

    const requiredErr = validateRequiredProfileFields(body);
    if (requiredErr) {
      return res.status(400).json({ success: false, message: requiredErr });
    }

    let profileId = await nextProfileId(config);

    const hash = submissionFingerprint({
      ...body,
      mobile: body.mobile || req.user.phone,
      email: body.email || req.user.email,
    });
    const dup = await MatrimonyProfile.findOne({ submissionHash: hash });
    if (dup) {
      return res.status(400).json({
        success: false,
        message: 'A profile with these details already exists. Contact support if this is an error.',
      });
    }

    const status = config.requireApproval
      ? MATRIMONY_PROFILE_STATUS.PENDING
      : MATRIMONY_PROFILE_STATUS.APPROVED;

    const doc = new MatrimonyProfile({
      ...body,
      profileId,
      mobile: body.mobile || req.user.phone || '',
      email: body.email || req.user.email || '',
      submissionHash: hash,
      status,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      isActive: true,
      isVisible: true,
    });

    if (status === MATRIMONY_PROFILE_STATUS.APPROVED) {
      doc.approvedAt = new Date();
    }

    pushHistory(doc, 'created', 'Profile submitted by member', req.user._id);
    await doc.save();

    res.status(201).json({
      success: true,
      data: doc,
      message: config.requireApproval
        ? 'Profile submitted for admin approval'
        : 'Profile created and published',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Duplicate profile ID' });
    }
    next(error);
  }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const doc = await MatrimonyProfile.findOne({ createdBy: req.user._id });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Profile not found. Create one first.' });
    }

    const config = await getOrCreateMatrimonyConfig();
    const body = memberPickBody(req.body);

    const requiredErr = validateRequiredProfileFields({
      ...doc.toObject(),
      ...body,
      photos: body.photos !== undefined ? body.photos : doc.photos,
    });
    if (requiredErr) {
      return res.status(400).json({ success: false, message: requiredErr });
    }

    Object.assign(doc, body);
    doc.updatedBy = req.user._id;
    doc.submissionHash = submissionFingerprint({
      fullName: doc.fullName,
      gender: doc.gender,
      dateOfBirth: doc.dateOfBirth,
      mobile: doc.mobile,
      email: doc.email,
    });

    if (config.requireApproval && doc.status === MATRIMONY_PROFILE_STATUS.APPROVED) {
      doc.status = MATRIMONY_PROFILE_STATUS.PENDING;
      doc.approvedAt = undefined;
      doc.approvedBy = undefined;
      pushHistory(doc, 'pending', 'Profile updated — awaiting re-approval', req.user._id);
    } else {
      pushHistory(doc, 'updated', 'Profile updated by member', req.user._id);
    }

    await doc.save();
    res.json({
      success: true,
      data: doc,
      message: config.requireApproval && doc.status === MATRIMONY_PROFILE_STATUS.PENDING
        ? 'Profile updated and sent for approval'
        : 'Profile updated',
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMyProfile = async (req, res, next) => {
  try {
    const doc = await MatrimonyProfile.findOneAndDelete({ createdBy: req.user._id });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'No profile to delete' });
    }
    res.json({ success: true, message: 'Profile deleted' });
  } catch (error) {
    next(error);
  }
};
