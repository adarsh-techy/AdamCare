const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/appError');

const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token and attach to request
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User belonging to this token no longer exists', 401));
    }

    // A user still on an admin-issued temporary password can only change it,
    // log out, or refresh their token — every other route is locked until
    // they set their own password.
    const allowedWhilePendingChange = [
      '/api/v1/auth/change-temp-password',
      '/api/v1/auth/logout',
      '/api/v1/auth/refresh'
    ];
    const fullPath = req.baseUrl + req.path;
    if (user.mustChangePassword && !allowedWhilePendingChange.includes(fullPath)) {
      return next(new AppError('You must set a new password before continuing.', 423));
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Authentication Protect Middleware Catch Error:', error.message);
    return next(new AppError('Not authorized to access this route', 401));
  }
};

module.exports = { protect };
