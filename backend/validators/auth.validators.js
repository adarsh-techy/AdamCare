const { body } = require('express-validator');

const loginValidator = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

const registerUserValidator = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['super_admin', 'doctor', 'receptionist']).withMessage('Invalid role'),
  body('department').custom((value, { req }) => {
    if (req.body.role === 'doctor' && !value) {
      throw new Error('Department is required for doctors');
    }
    return true;
  })
];

const changeTempPasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
];

// Every field is optional here — only validate the ones that were actually sent.
const updateMeValidator = [
  body('newPassword').optional().isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('name').optional().notEmpty().withMessage('Name cannot be empty')
];

// Just checks the email LOOKS valid (format only) — whether it's actually
// registered is deliberately not checked here or anywhere client-visible;
// see forgotPassword's genericResponse() in auth.controller.js.
const forgotPasswordValidator = [
  body('email').isEmail().withMessage('Please provide a valid email')
];

// The reset token itself comes from the URL (:token param), not the body,
// so it's not validated here — resetPassword in auth.controller.js checks
// it directly against the database instead (a malformed/unknown token just
// won't match any stored hash).
const resetPasswordValidator = [
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
];

module.exports = {
  loginValidator,
  registerUserValidator,
  changeTempPasswordValidator,
  updateMeValidator,
  forgotPasswordValidator,
  resetPasswordValidator
};
