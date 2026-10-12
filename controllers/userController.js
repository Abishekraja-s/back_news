import User from '../models/User.js';
import MatrimonyProfile from '../models/MatrimonyProfile.js';
import MatrimonyEnquiry from '../models/MatrimonyEnquiry.js';
import MarketplaceProduct from '../models/MarketplaceProduct.js';
import MarketplaceEnquiry from '../models/MarketplaceEnquiry.js';
import { ROLES } from '../config/constants.js';

export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password -refreshToken').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);
    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json({ success: true, data: userObj });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.password) delete data.password;

    const user = await User.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (String(req.user._id) === String(id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === ROLES.SUPER_ADMIN) {
      const others = await User.countDocuments({
        _id: { $ne: user._id },
        role: ROLES.SUPER_ADMIN,
        status: 'active',
      });
      if (others === 0) {
        return res.status(400).json({ success: false, message: 'Cannot delete the last super admin' });
      }
    }

    const profiles = await MatrimonyProfile.find({ createdBy: user._id }).select('_id').lean();
    const profileIds = profiles.map((p) => p._id);
    if (profileIds.length) {
      await MatrimonyEnquiry.deleteMany({
        $or: [
          { profile: { $in: profileIds } },
          { profileOwner: user._id },
          { submittedBy: user._id },
        ],
      });
      await MatrimonyProfile.deleteMany({ createdBy: user._id });
    } else {
      await MatrimonyEnquiry.deleteMany({
        $or: [{ profileOwner: user._id }, { submittedBy: user._id }],
      });
    }

    await MarketplaceEnquiry.deleteMany({ seller: user._id });
    await MarketplaceProduct.deleteMany({ seller: user._id });
    await User.findByIdAndDelete(user._id);

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};

export const getRoles = (req, res) => {
  res.json({ success: true, data: Object.values(ROLES) });
};
