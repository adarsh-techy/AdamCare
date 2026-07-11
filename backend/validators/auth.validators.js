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

// All fields are optional here; only check the ones that were sent
const updateMeValidator = [
  body('newPassword').optional().isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('name').optional().notEmpty().withMessage('Name cannot be empty')
];

// Only checks the email format looks valid, not whether it's registered
const forgotPasswordValidator = [
  body('email').isEmail().withMessage('Please provide a valid email')
];

// The reset token comes from the URL, so it's checked elsewhere, not here
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
