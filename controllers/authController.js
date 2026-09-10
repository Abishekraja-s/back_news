import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { sendTokenResponse, generateAccessToken } from '../utils/generateToken.js';

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Account is inactive' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    await AuditLog.create({
      user: user._id,
      action: 'LOGIN',
      resource: 'User',
      resourceId: user._id.toString(),
      ip: req.ip,
    });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res) => {
  res.cookie('token', '', { expires: new Date(0), httpOnly: true });
  res.cookie('refreshToken', '', { expires: new Date(0), httpOnly: true });
  res.json({ success: true, message: 'Logged out' });
};

export const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const accessToken = generateAccessToken(user._id);
    res.json({ success: true, token: accessToken });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, email, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name?.trim()) user.name = name.trim();
    if (email?.trim()) user.email = email.trim().toLowerCase();
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.refreshToken;

    res.json({ success: true, user: userObj, message: 'Profile updated' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};
