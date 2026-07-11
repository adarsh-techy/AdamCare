const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a department name'],
    unique: true,
    trim: true
  },
  workingDays: {
    type: [Number],
    default: [1, 2, 3, 4, 5] // Default: Monday through Friday
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Department', DepartmentSchema);
