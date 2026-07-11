const mongoose = require('mongoose');

const TimeWindowSchema = new mongoose.Schema({
  startTime: { type: String, required: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM format'] },
  endTime:   { type: String, required: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM format'] }
}, { _id: false });

const ScheduleOverrideSchema = new mongoose.Schema({
  doctor:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:         { type: String, required: true, match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'] },
  sessions:     { type: [TimeWindowSchema], required: true },
  slotDuration: { type: Number, required: true, default: 15, min: 5, max: 120 },
  breakTimings: { type: [TimeWindowSchema], default: [] }
}, { timestamps: true });

ScheduleOverrideSchema.index({ doctor: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ScheduleOverride', ScheduleOverrideSchema);
