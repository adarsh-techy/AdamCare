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
  // Used for the "forgot password" flow; stores only a hashed token, never the raw one
  resetPasswordToken: {
    type: String,
    select: false,
    default: undefined
  },
  // When the reset link expires (30 minutes after it was requested)
  resetPasswordExpires: {
    type: Date,
    select: false,
    default: undefined
  }
}, {
  timestamps: true
});

// Hashes the password before saving, but only if it was actually changed
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Checks a plain-text password against this user's stored hashed password
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
