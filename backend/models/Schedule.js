const mongoose = require('mongoose');

const TimeWindowSchema = new mongoose.Schema({
  startTime: {
    type: String,
    required: true,
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Please use HH:MM format (24h) for start time']
  },
  endTime: {
    type: String,
    required: true,
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Please use HH:MM format (24h) for end time']
  }
}, { _id: false });

const ScheduleSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  sessions: {
    type: [TimeWindowSchema],
    required: true,
    validate: {
      validator: function(val) {
        return val.length > 0;
      },
      message: 'Please define at least one working session'
    }
  },
  slotDuration: {
    type: Number,
    required: true,
    default: 15,
    min: [5, 'Slot duration must be at least 5 minutes'],
    max: [120, 'Slot duration cannot exceed 120 minutes']
  },
  // Which days this doctor works; falls back to the department's working days if not set
  workingDays: {
    type: [Number],
    default: undefined
  },
  breakTimings: {
    type: [TimeWindowSchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Schedule', ScheduleSchema);
