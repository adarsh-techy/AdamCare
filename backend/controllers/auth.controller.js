const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { generateAccessToken, generateRefreshToken } = require('../utils/token');
const { createAuditLog } = require('../services/audit.service');
const { notifyStaffChange } = require('../services/socket.service');
const { sendPasswordResetEmail } = require('../services/email.service');

// @desc    Authenticate user & get tokens
// @route   POST /api/v1/auth/login
// @access  Public
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return next(new AppError('Invalid email or password', 401));
  }

  if (user.status === 'blocked') {
    return next(new AppError('Your account has been blocked. Please contact the system administrator.', 403));
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshTokens.push(refreshToken);
  await user.save();

  await createAuditLog({
    userId: user._id,
    role: user.role,
    action: 'LOGIN',
    entity: 'User',
    entityId: user._id,
    details: { email }
  });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        mustChangePassword: user.mustChangePassword
      },
      accessToken,
      refreshToken
    },
    meta: {}
  });
});

// @desc    Refresh access token
// @route   POST /api/v1/auth/refresh
// @access  Public
const refresh = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Refresh token is required', 400));
  }

  const user = await User.findOne({ refreshTokens: refreshToken });
  if (!user) {
    return next(new AppError('Invalid refresh token', 403));
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.id !== user._id.toString()) {
      return next(new AppError('Invalid refresh token identity', 403));
    }

    const newAccessToken = generateAccessToken(user);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken
      },
      meta: {}
    });
  } catch (error) {
    user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
    await user.save();
    return next(new AppError('Refresh token expired or invalid', 403));
  }
});

// @desc    Logout user & invalidate refresh token
// @route   POST /api/v1/auth/logout
// @access  Public (or Protected, but public is safe if token is passed in body)
const logout = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Refresh token is required', 400));
  }

  const user = await User.findOne({ refreshTokens: refreshToken });
  if (user) {
    user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
    await user.save();
    
    await createAuditLog({
      userId: user._id,
      role: user.role,
      action: 'LOGOUT',
      entity: 'User',
      entityId: user._id
    });
  }

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
    data: null,
    meta: {}
  });
});

// @desc    Register a new staff member (Admin/Doctor/Receptionist)
// @route   POST /api/v1/auth/register
// @access  Private (Super Admin only)
const registerStaff = asyncHandler(async (req, res, next) => {
  const { name, email, password, role, department, avatar, qualification } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('User with this email already exists', 400));
  }

  const newUser = new User({
    name,
    email,
    password,
    role,
    department,
    avatar,
    qualification: role === 'doctor' ? qualification : undefined,
    readablePassword: password,
    mustChangePassword: true
  });
  await newUser.save();

  await createAuditLog({
    userId: req.user._id,
    role: req.user.role,
    action: `STAFF_CREATED`,
    entity: 'User',
    entityId: newUser._id,
    details: { name: newUser.name, email: newUser.email, role: newUser.role }
  });

  res.status(201).json({
    success: true,
    message: `${role.replace('_', ' ')} created successfully`,
    data: {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      department: newUser.department,
      avatar: newUser.avatar
    },
    meta: {}
  });
});

const getStaff = asyncHandler(async (req, res, next) => {
  const { role, excludeRole, department, page, limit } = req.query;

  const query = { _id: { $ne: req.user._id } };
  if (role) query.role = role;
  if (excludeRole) query.role = { $ne: excludeRole };
  if (department) query.department = department;

  // No page/limit requested (e.g. Manage Staff view) — keep the original,
  // unpaginated full-list behavior for backwards compatibility.
  if (!page && !limit) {
    const staff = await User.find(query).select('name email role department avatar qualification pendingQualification status mustChangePassword');
    return res.status(200).json({
      success: true,
      message: 'Staff retrieved successfully',
      data: staff
    });
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  const [staff, total] = await Promise.all([
    User.find(query)
      .select('name email role department avatar qualification pendingQualification status mustChangePassword')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum),
    User.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    message: 'Staff retrieved successfully',
    data: staff,
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  });
});

const deleteStaff = asyncHandler(async (req, res, next) => {
  const staffId = req.params.id;
  const { adminPassword } = req.body;

  if (!adminPassword) {
    return next(new AppError('Your password is required to delete a staff member.', 400));
  }

  const admin = await User.findById(req.user._id).select('+password');
  if (!admin || !(await admin.matchPassword(adminPassword))) {
    return next(new AppError('Incorrect password. Deletion denied.', 401));
  }

  const staff = await User.findById(staffId);
  if (!staff) {
    return next(new AppError('Staff member not found', 404));
  }

  await User.findByIdAndDelete(staffId);

  // Create Audit Log
  await createAuditLog({
    userId: req.user._id,
    role: req.user.role,
    action: 'STAFF_DELETED',
    entity: 'User',
    entityId: staffId,
    details: { name: staff.name, email: staff.email, role: staff.role }
  });

  res.status(200).json({
    success: true,
    message: 'Staff member deleted successfully'
  });
});

const updateStaff = asyncHandler(async (req, res, next) => {
  const staffId = req.params.id;
  const { name, email, password, currentPassword, department, avatar, status, qualification } = req.body;

  const staff = await User.findById(staffId);
  if (!staff) {
    return next(new AppError('Staff member not found', 404));
  }

  // Once a user has taken ownership of their password, an admin can no
  // longer edit their profile at all — name, email, department, avatar,
  // qualification, or password. Block/unblock (status) is the one action
  // that still needs to work through this same endpoint, so it's excluded.
  const isProfileEdit = [name, email, department, avatar, qualification, password].some((v) => v !== undefined);
  if (isProfileEdit && !staff.mustChangePassword) {
    return next(new AppError('This user has set their own password. Their profile can no longer be edited by an admin.', 403));
  }

  if (name) staff.name = name;
  if (email) staff.email = email;
  if (department) staff.department = department;
  if (avatar !== undefined) staff.avatar = avatar;
  if (status) staff.status = status;
  if (qualification !== undefined && staff.role === 'doctor') staff.qualification = qualification;
  if (password) {
    if (!currentPassword) {
      return next(new AppError('Current password is required to set a new password.', 400));
    }
    const staffWithPass = await User.findById(staffId).select('+password');
    if (!(await staffWithPass.matchPassword(currentPassword))) {
      return next(new AppError('Current password is incorrect.', 401));
    }
    staff.password = password;
    staff.readablePassword = password;
    staff.mustChangePassword = true;
  }

  await staff.save();

  // Create Audit Log
  await createAuditLog({
    userId: req.user._id,
    role: req.user.role,
    action: 'STAFF_UPDATED',
    entity: 'User',
    entityId: staffId,
    details: { name: staff.name, email: staff.email, role: staff.role, status: staff.status }
  });

  res.status(200).json({
    success: true,
    message: 'Staff member updated successfully',
    data: staff
  });
});

// Verify the requesting admin's own password then return the target staff member's readablePassword
const revealPassword = asyncHandler(async (req, res, next) => {
  const { adminPassword } = req.body;
  if (!adminPassword) {
    return next(new AppError('Your password is required to proceed.', 400));
  }

  const admin = await User.findById(req.user._id).select('+password');
  if (!admin || !(await admin.matchPassword(adminPassword))) {
    return next(new AppError('Incorrect password. Access denied.', 401));
  }

  const staff = await User.findById(req.params.id);
  if (!staff) {
    return next(new AppError('Staff member not found.', 404));
  }

  if (!staff.mustChangePassword) {
    return next(new AppError('This user has set their own password. It is private and can no longer be viewed.', 403));
  }

  res.status(200).json({
    success: true,
    message: 'Password revealed',
    data: { password: staff.readablePassword || '' }
  });
});

// @desc    Self-service: replace an admin-issued temporary password with one only the user knows
// @route   POST /api/v1/auth/change-temp-password
// @access  Private (any authenticated role)
const changeTempPassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword))) {
    return next(new AppError('Current password is incorrect.', 401));
  }

  user.password = newPassword;
  user.readablePassword = '';
  user.mustChangePassword = false;
  user.refreshTokens = []; // force every existing session to re-authenticate
  await user.save();

  await createAuditLog({
    userId: user._id,
    role: user.role,
    action: 'PASSWORD_CHANGED',
    entity: 'User',
    entityId: user._id
  });

  res.status(200).json({
    success: true,
    message: 'Password changed successfully. Please log in again with your new password.',
    data: null,
    meta: {}
  });
});

// @desc    Get the logged-in user's own profile
// @route   GET /api/v1/auth/me
// @access  Private (any authenticated role)
const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  res.status(200).json({
    success: true,
    message: 'Profile retrieved successfully',
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      avatar: user.avatar,
      qualification: user.qualification,
      pendingQualification: user.pendingQualification
    },
    meta: {}
  });
});

// @desc    List every staff member with a pending qualification change —
//          powers the super admin's notification bell.
// @route   GET /api/v1/auth/staff/pending-qualifications
// @access  Private (Super Admin only)
const getPendingQualifications = asyncHandler(async (req, res, next) => {
  const pending = await User.find({ pendingQualification: { $ne: null } })
    .select('name role department qualification pendingQualification');

  res.status(200).json({
    success: true,
    message: 'Pending qualification changes retrieved successfully',
    data: pending,
    meta: { total: pending.length }
  });
});

// @desc    Self-service profile update — name/avatar apply immediately,
//          qualification goes into a pending state awaiting admin approval,
//          password requires the current password and applies immediately.
// @route   PUT /api/v1/auth/me
// @access  Private (any authenticated role)
const updateMe = asyncHandler(async (req, res, next) => {
  const { name, avatar, qualification, currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  let qualificationPending = false;

  if (name) user.name = name;
  if (avatar !== undefined) user.avatar = avatar;

  if (qualification !== undefined && user.role !== 'doctor') {
    return next(new AppError('Only doctors can set a qualification.', 403));
  }

  if (qualification !== undefined && qualification !== user.qualification) {
    user.pendingQualification = qualification;
    qualificationPending = true;
    await createAuditLog({
      userId: user._id,
      role: user.role,
      action: 'QUALIFICATION_CHANGE_REQUESTED',
      entity: 'User',
      entityId: user._id,
      details: { requested: qualification }
    });
    notifyStaffChange('qualification_requested', user._id);
  }

  if (newPassword) {
    if (!currentPassword) {
      return next(new AppError('Current password is required to set a new password.', 400));
    }
    const userWithPass = await User.findById(req.user._id).select('+password');
    if (!(await userWithPass.matchPassword(currentPassword))) {
      return next(new AppError('Current password is incorrect.', 401));
    }
    user.password = newPassword;
  }

  await user.save();

  if (name || avatar !== undefined || newPassword) {
    await createAuditLog({
      userId: user._id,
      role: user.role,
      action: 'PROFILE_UPDATED',
      entity: 'User',
      entityId: user._id
    });
  }

  res.status(200).json({
    success: true,
    message: qualificationPending
      ? 'Profile updated. Your qualification change has been submitted for admin approval.'
      : 'Profile updated successfully.',
    data: {
      name: user.name,
      avatar: user.avatar,
      qualification: user.qualification,
      pendingQualification: user.pendingQualification
    },
    meta: { qualificationPending }
  });
});

// @desc    Approve a staff member's pending qualification change
// @route   POST /api/v1/auth/staff/:id/approve-qualification
// @access  Private (Super Admin only)
const approveQualification = asyncHandler(async (req, res, next) => {
  const staff = await User.findById(req.params.id);
  if (!staff) {
    return next(new AppError('Staff member not found', 404));
  }
  if (!staff.pendingQualification) {
    return next(new AppError('This user has no pending qualification change.', 400));
  }

  const approvedValue = staff.pendingQualification;
  staff.qualification = staff.pendingQualification;
  staff.pendingQualification = null;
  await staff.save();

  await createAuditLog({
    userId: req.user._id,
    role: req.user.role,
    action: 'QUALIFICATION_APPROVED',
    entity: 'User',
    entityId: staff._id,
    details: { approved: approvedValue }
  });
  notifyStaffChange('qualification_approved', staff._id);

  res.status(200).json({
    success: true,
    message: 'Qualification change approved.',
    data: staff
  });
});

// @desc    Reject a staff member's pending qualification change
// @route   POST /api/v1/auth/staff/:id/reject-qualification
// @access  Private (Super Admin only)
const rejectQualification = asyncHandler(async (req, res, next) => {
  const staff = await User.findById(req.params.id);
  if (!staff) {
    return next(new AppError('Staff member not found', 404));
  }
  if (!staff.pendingQualification) {
    return next(new AppError('This user has no pending qualification change.', 400));
  }

  const rejectedValue = staff.pendingQualification;
  staff.pendingQualification = null;
  await staff.save();

  await createAuditLog({
    userId: req.user._id,
    role: req.user.role,
    action: 'QUALIFICATION_REJECTED',
    entity: 'User',
    entityId: staff._id,
    details: { rejected: rejectedValue }
  });
  notifyStaffChange('qualification_rejected', staff._id);

  res.status(200).json({
    success: true,
    message: 'Qualification change rejected.',
    data: staff
  });
});

// @desc    Step 1 of the "Forgot Password" flow — user submits their email,
//          we email them a one-time link if an account exists for it.
// @route   POST /api/v1/auth/forgot-password
// @access  Public (this runs before the user is authenticated — that's the
//          whole point, they've lost access to their account)
const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  // SECURITY: always return this exact same response whether the email
  // exists or not, and at roughly the same speed either way. If we instead
  // returned "email not found" for unregistered addresses, this endpoint
  // could be used to silently check which emails have accounts (an
  // "account enumeration" attack) — every branch below funnels back to
  // this one response.
  const genericResponse = () => res.status(200).json({
    success: true,
    message: 'If that email is registered, a password reset link has been sent.',
    data: null,
    meta: {}
  });

  const user = await User.findOne({ email });
  if (!user) {
    return genericResponse();
  }

  // Generate a random, unguessable token. We email the RAW value to the
  // user but only ever save its hash to the database (see the
  // resetPasswordToken field comment in models/User.js for why). 32 random
  // bytes = 64 hex characters, way beyond brute-force range.
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // valid for 30 minutes
  await user.save();

  // Points at the frontend's ResetPassword.jsx page, which reads :token
  // from the URL and POSTs it back to /reset-password/:token below.
  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;

  try {
    await sendPasswordResetEmail(user.email, resetLink);
  } catch (err) {
    // If SMTP isn't configured yet (see EMAIL_USER/EMAIL_PASS in .env) or
    // the send otherwise fails, we deliberately do NOT tell the client —
    // that would leak the same "does this email exist" information the
    // genericResponse() above is designed to hide. Just log it so we (the
    // developers) can see it happened.
    console.error('Failed to send password reset email:', err.message);
  }

  await createAuditLog({
    userId: user._id,
    role: user.role,
    action: 'PASSWORD_RESET_REQUESTED',
    entity: 'User',
    entityId: user._id
  });

  return genericResponse();
});

// @desc    Step 2 of the "Forgot Password" flow — user clicked the emailed
//          link and is submitting a new password along with the token from
//          that link's URL.
// @route   POST /api/v1/auth/reset-password/:token
// @access  Public (same reasoning as forgotPassword above)
const resetPassword = asyncHandler(async (req, res, next) => {
  const { newPassword } = req.body;

  // Hash the token from the URL the same way it was hashed when stored, so
  // we can look it up by equality — we never stored (or could recover) the
  // raw token itself.
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  // Both conditions must hold: the hash must match AND the stored expiry
  // must still be in the future. A token that matches but has expired (or
  // was already used — see below) will simply find no user here.
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  }).select('+resetPasswordToken +resetPasswordExpires'); // excluded by default, must opt in

  if (!user) {
    return next(new AppError('This reset link is invalid or has expired.', 400));
  }

  user.password = newPassword; // re-hashed automatically by the pre('save') hook in models/User.js
  user.readablePassword = ''; // no admin-visible plaintext copy for a self-set password
  // Successfully resetting via a verified email link counts as "owning"
  // this password, same as the temp-password-change flow — from now on
  // only this user can view/change it (see revealPassword/updateStaff,
  // which both check this flag before letting an admin touch the account).
  user.mustChangePassword = false;
  // Clear the token immediately so it can't be redeemed a second time —
  // this is what makes the link single-use rather than reusable until expiry.
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  // Force every other device/tab currently logged into this account to
  // re-authenticate, in case the password was forgotten because someone
  // else had unwanted access.
  user.refreshTokens = [];
  await user.save();

  await createAuditLog({
    userId: user._id,
    role: user.role,
    action: 'PASSWORD_RESET_COMPLETED',
    entity: 'User',
    entityId: user._id
  });

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. Please log in with your new password.',
    data: null,
    meta: {}
  });
});

module.exports = {
  login,
  refresh,
  logout,
  registerStaff,
  getStaff,
  deleteStaff,
  updateStaff,
  revealPassword,
  changeTempPassword,
  getMe,
  updateMe,
  approveQualification,
  rejectQualification,
  getPendingQualifications,
  forgotPassword,
  resetPassword
};
