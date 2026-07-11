const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ],
    lowercase: true
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['super_admin', 'doctor', 'receptionist'],
    required: [true, 'Please specify a user role']
  },
  department: {
    type: String,
    required: function() { return this.role === 'doctor'; },
    default: undefined
  },
  qualification: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active'
  },
  readablePassword: {
    type: String,
    default: ''
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  pendingQualification: {
    type: String,
    default: null
  },
  refreshTokens: {
    type: [String],
    default: []
  },
  // --- "Forgot Password" reset flow (see auth.controller.js forgotPassword
  // / resetPassword, and backend/services/email.service.js) ---
  // We never store the raw token a user clicks in their email — only its
  // SHA-256 hash. That way, even someone with direct database access can't
  // use a stolen resetPasswordToken value to reset the account (they'd need
  // the original unhashed token, which only ever existed in the email link).
  // select: false keeps these out of normal queries/API responses, same
  // pattern as `password` above — a controller must explicitly
  // .select('+resetPasswordToken +resetPasswordExpires') to read them.
  resetPasswordToken: {
    type: String,
    select: false,
    default: undefined
  },
  // Reset links expire 30 minutes after being requested (set in
  // auth.controller.js's forgotPassword). A token past this time is treated
  // as invalid even if it otherwise matches.
  resetPasswordExpires: {
    type: Date,
    select: false,
    default: undefined
  }
}, {
  timestamps: true
});

// Runs before every save — but only actually re-hashes the password when it
// was changed on this save (isModified check), so saving unrelated fields
// (e.g. just `name` or `status`) doesn't re-hash an already-hashed password.
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compares a plaintext password (e.g. from a login form) against this
// user's stored bcrypt hash. `this.password` must have been explicitly
// selected first (see the `select: false` above), since it's excluded from
// queries by default.
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
