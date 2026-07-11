const User = require('../models/User');
const Schedule = require('../models/Schedule');
const ScheduleOverride = require('../models/ScheduleOverride');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { createAuditLog } = require('../services/audit.service');
const { notifyScheduleChange } = require('../services/socket.service');

// @desc    Get all doctors list
// @route   GET /api/v1/doctors
// @access  Private (Authenticated)
const getDoctors = asyncHandler(async (req, res, next) => {
  const doctors = await User.find({ role: 'doctor' }).select('name email department avatar qualification readablePassword status');
  res.status(200).json({
    success: true,
    message: 'Doctors retrieved successfully',
    data: doctors,
    meta: {}
  });
});

// @desc    Configure doctor default schedule
// @route   PUT /api/v1/doctors/:id/schedule
// @access  Private (Super Admin only)
const configureSchedule = asyncHandler(async (req, res, next) => {
  const doctorId = req.params.id;
  const { sessions, slotDuration, breakTimings, workingDays } = req.body;

  const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
  if (!doctor) return next(new AppError('Doctor not found', 404));

  let schedule = await Schedule.findOne({ doctor: doctorId });
  if (schedule) {
    schedule.sessions = sessions;
    if (slotDuration) schedule.slotDuration = slotDuration;
    if (breakTimings) schedule.breakTimings = breakTimings;
    if (Array.isArray(workingDays)) schedule.workingDays = workingDays;
  } else {
    schedule = new Schedule({
      doctor: doctorId,
      sessions,
      slotDuration: slotDuration || 15,
      breakTimings: breakTimings || [],
      workingDays: Array.isArray(workingDays) ? workingDays : undefined
    });
  }

  await schedule.save();

  await createAuditLog({
    userId: req.user._id,
    role: req.user.role,
    action: 'SCHEDULE_CONFIGURED',
    entity: 'Schedule',
    entityId: schedule._id,
    details: { doctorName: doctor.name, doctorId }
  });

  notifyScheduleChange('default_updated', doctorId);
  res.status(200).json({ success: true, message: 'Default schedule configured successfully', data: schedule, meta: {} });
});

// @desc    Get default schedule for a specific doctor
// @route   GET /api/v1/doctors/:id/schedule
// @access  Private (Authenticated)
const getScheduleByDoctor = asyncHandler(async (req, res, next) => {
  const schedule = await Schedule.findOne({ doctor: req.params.id });
  if (!schedule) return next(new AppError('No schedule found for this doctor', 404));
  res.status(200).json({ success: true, message: 'Schedule retrieved successfully', data: schedule, meta: {} });
});

// @desc    Get date-specific schedule override
// @route   GET /api/v1/doctors/:id/schedule/override?date=YYYY-MM-DD
// @access  Private (Authenticated)
const getScheduleOverride = asyncHandler(async (req, res, next) => {
  const { date } = req.query;
  if (!date) return next(new AppError('date query param is required', 400));
  const override = await ScheduleOverride.findOne({ doctor: req.params.id, date });
  if (!override) return next(new AppError('No override for this date', 404));
  res.status(200).json({ success: true, data: override, meta: {} });
});

// @desc    Create or update date-specific schedule override
// @route   PUT /api/v1/doctors/:id/schedule/override
// @access  Private (Super Admin only)
const upsertScheduleOverride = asyncHandler(async (req, res, next) => {
  const doctorId = req.params.id;
  const { date, sessions, slotDuration, breakTimings } = req.body;
  if (!date) return next(new AppError('date is required', 400));

  const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
  if (!doctor) return next(new AppError('Doctor not found', 404));

  const override = await ScheduleOverride.findOneAndUpdate(
    { doctor: doctorId, date },
    { sessions, slotDuration: slotDuration || 15, breakTimings: breakTimings || [] },
    { upsert: true, new: true, runValidators: true }
  );

  await createAuditLog({
    userId: req.user._id,
    role: req.user.role,
    action: 'SCHEDULE_OVERRIDE_SET',
    entity: 'ScheduleOverride',
    entityId: override._id,
    details: { doctorName: doctor.name, doctorId, date }
  });

  notifyScheduleChange('override_set', doctorId);
  res.status(200).json({ success: true, message: `Schedule override set for ${date}`, data: override, meta: {} });
});

// @desc    Delete date-specific schedule override (revert to default)
// @route   DELETE /api/v1/doctors/:id/schedule/override?date=YYYY-MM-DD
// @access  Private (Super Admin only)
const deleteScheduleOverride = asyncHandler(async (req, res, next) => {
  const { date } = req.query;
  if (!date) return next(new AppError('date query param is required', 400));
  await ScheduleOverride.findOneAndDelete({ doctor: req.params.id, date });
  notifyScheduleChange('override_deleted', req.params.id);
  res.status(200).json({ success: true, message: 'Override removed, date will use default schedule', meta: {} });
});

module.exports = {
  getDoctors,
  configureSchedule,
  getScheduleByDoctor,
  getScheduleOverride,
  upsertScheduleOverride,
  deleteScheduleOverride
};
