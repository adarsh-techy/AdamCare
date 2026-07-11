const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  department: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  slot: {
    type: String,
    required: true,
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Please use HH:MM format (24h) for slot time']
  },
  status: {
    type: String,
    enum: ['scheduled', 'arrived', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  purpose: {
    type: String,
    required: [true, 'Please state the purpose of the appointment']
  },
  notes: {
    type: String,
    default: ''
  },
  cancelledReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Compound partial unique index — prevents double booking while allowing re-booking of cancelled slots.
AppointmentSchema.index(
  { doctor: 1, date: 1, slot: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'cancelled' } } }
);

// Supporting indexes for common query patterns
AppointmentSchema.index({ date: 1 });
AppointmentSchema.index({ status: 1 });
AppointmentSchema.index({ department: 1 });
AppointmentSchema.index({ patient: 1 });

module.exports = mongoose.model('Appointment', AppointmentSchema);
