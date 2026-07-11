const AppError = require('../utils/appError');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.status = err.status || 'error';

  // Log for development
  if (process.env.NODE_ENV === 'development') {
    console.error(err);
  }

  // Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new AppError(message, 404);
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    let message = 'Duplicate field value entered';
    
    // Check if duplicate key is for the unique doctor-date-slot index
    if (err.keyPattern && err.keyPattern.doctor && err.keyPattern.date && err.keyPattern.slot) {
      message = 'This slot has already been booked. Please select another slot.';
    } else {
      const keys = Object.keys(err.keyValue);
      message = `Duplicate field: ${keys.join(', ')}. Please use another value.`;
    }
    
    error = new AppError(message, 409); // 409 Conflict
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400);
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please log in again.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Your token has expired. Please log in again.', 401);
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    data: null,
    meta: {
      status: error.status,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorHandler;
