import User from '../models/User.js';
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
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};

export const getRoles = (req, res) => {
  res.json({ success: true, data: Object.values(ROLES) });
};
