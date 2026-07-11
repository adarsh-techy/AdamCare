const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/appError');

const protect = async (req, res, next) => {
  let token;

  // Look for the token in the Authorization header
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
    // Check that the token is valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load the user this token belongs to
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User belonging to this token no longer exists', 401));
    }

    // Block every route except change-password/logout/refresh until the temp password is changed
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
