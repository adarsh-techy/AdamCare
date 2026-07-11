const express = require('express');
const {
  login, logout, refresh, registerStaff, getStaff, deleteStaff, updateStaff, revealPassword, changeTempPassword,
  getMe, updateMe, approveQualification, rejectQualification, getPendingQualifications,
  forgotPassword, resetPassword
} = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const {
  loginValidator, registerUserValidator, changeTempPasswordValidator, updateMeValidator,
  forgotPasswordValidator, resetPasswordValidator
} = require('../validators/auth.validators');
const { validate } = require('../middlewares/validation.middleware');

const router = express.Router();

router.post('/login', loginValidator, validate, login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/change-temp-password', protect, changeTempPasswordValidator, validate, changeTempPassword);

// "Forgot Password" flow — deliberately NOT behind `protect`, since a user
// requesting this has by definition lost access to their account and can't
// present a valid JWT. Security instead comes from the emailed, single-use,
// time-limited token (see auth.controller.js forgotPassword/resetPassword).
router.post('/forgot-password', forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password/:token', resetPasswordValidator, validate, resetPassword);

// Self-service profile — any authenticated role, own account only
router.get('/me', protect, getMe);
router.put('/me', protect, updateMeValidator, validate, updateMe);

// Registration & Management of staff — Super Admin only
router.post('/register', protect, authorize('super_admin'), registerUserValidator, validate, registerStaff);
router.get('/staff', protect, authorize('super_admin'), getStaff);
router.get('/staff/pending-qualifications', protect, authorize('super_admin'), getPendingQualifications);
router.delete('/staff/:id', protect, authorize('super_admin'), deleteStaff);
router.put('/staff/:id', protect, authorize('super_admin'), updateStaff);
router.post('/staff/:id/reveal-password', protect, authorize('super_admin'), revealPassword);
router.post('/staff/:id/approve-qualification', protect, authorize('super_admin'), approveQualification);
router.post('/staff/:id/reject-qualification', protect, authorize('super_admin'), rejectQualification);

module.exports = router;
