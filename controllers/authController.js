import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { sendTokenResponse, generateAccessToken } from '../utils/generateToken.js';
import { ROLES } from '../config/constants.js';
import { formatSmtpError, getClientBaseUrl, sendMail } from '../utils/mail.js';

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

const ADMIN_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.EDITOR,
  ROLES.REPORTER,
  ROLES.AUTHOR,
  ROLES.AD_MANAGER,
];

const RESET_AUDIENCE = {
  seller: {
    roles: [ROLES.SELLER],
    label: 'seller',
    path: '/seller/reset-password',
    subject: 'Reset your seller password — The Great India News',
  },
  matrimony: {
    roles: [ROLES.MATRIMONY],
    label: 'matrimony',
    path: '/matrimony/reset-password',
    subject: 'Reset your matrimony password — The Great India News',
  },
  admin: {
    roles: ADMIN_ROLES,
    label: 'admin',
    path: '/admin/reset-password',
    subject: 'Reset your admin password — The Great India News',
  },
};

const resolveResetAudience = (raw) => {
  const key = String(raw || 'seller').trim().toLowerCase();
  return RESET_AUDIENCE[key] || RESET_AUDIENCE.seller;
};

/** Forgot password — seller, matrimony, or admin (body.audience). Emails reset link via SMTP. */
export const forgotPassword = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const audience = resolveResetAudience(req.body.audience);
    const user = await User.findOne({
      email,
      role: { $in: audience.roles },
      status: 'active',
    });

    if (!user) {
      return res.json({
        success: true,
        message: `If a ${audience.label} account exists for this email, a reset link has been sent.`,
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const baseUrl = getClientBaseUrl(req);
    const resetUrl = `${baseUrl}${audience.path}?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(user.email)}`;

    try {
      await sendMail({
        to: user.email,
        subject: audience.subject,
        text: `Reset your ${audience.label} password using this link (valid 30 minutes):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
            <h2 style="margin:0 0 12px">Reset your ${audience.label} password</h2>
            <p>We received a request to reset the password for <strong>${user.email}</strong>.</p>
            <p style="margin:24px 0">
              <a href="${resetUrl}" style="background:#0f766e;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600">
                Set new password
              </a>
            </p>
            <p style="font-size:13px;color:#64748b">This link expires in 30 minutes.</p>
            <p style="font-size:13px;color:#64748b">If the button does not work, copy this URL:<br/>${resetUrl}</p>
          </div>
        `,
      });
    } catch (mailErr) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      const message = formatSmtpError(mailErr);
      if (mailErr.code === 'SMTP_NOT_CONFIGURED') {
        return res.status(503).json({ success: false, message });
      }
      return res.status(502).json({ success: false, message });
    }

    res.json({
      success: true,
      message: 'Password reset link sent to your email. Check your inbox (and spam).',
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const audience = resolveResetAudience(req.body.audience);
    const hashed = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
      role: { $in: audience.roles },
      status: 'active',
    }).select('+passwordResetToken +passwordResetExpires +password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid or has expired. Request a new one.',
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password updated. You can sign in now.' });
  } catch (error) {
    next(error);
  }
};
