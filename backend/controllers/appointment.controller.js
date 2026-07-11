const appointmentService = require('../services/appointment.service');
const { notifyAppointmentChange } = require('../services/socket.service');
const asyncHandler = require('../utils/asyncHandler');
const Patient = require('../models/Patient');

// @desc    Book a new appointment
// @route   POST /api/v1/appointments
// @access  Private (Receptionist or Super Admin)
const bookAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await appointmentService.bookAppointment(req.body, req.user);
  
  // Real-time broadcast
  notifyAppointmentChange('created', appointment);

  res.status(201).json({
    success: true,
    message: 'Appointment booked successfully',
    data: appointment,
    meta: {}
  });
});

// @desc    Get appointments list (with pagination, filtering, search)
// @route   GET /api/v1/appointments
// @access  Private (Authenticated)
const getAppointments = asyncHandler(async (req, res, next) => {
  const filters = {
    patientSearch: req.query.patientSearch,
    doctorSearch: req.query.doctorSearch,
    department: req.query.department,
    status: req.query.status,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  // Doctors can only view their own appointments
  if (req.user.role === 'doctor') {
    filters.doctorId = req.user._id;
  } else if (req.query.doctorId) {
    filters.doctorId = req.query.doctorId;
  }

  const queryParams = {
    page: req.query.page,
    limit: req.query.limit,
    sortBy: req.query.sortBy,
    sortOrder: req.query.sortOrder
  };

  const results = await appointmentService.getAppointmentsList(filters, queryParams);

  res.status(200).json({
    success: true,
    message: 'Appointments retrieved successfully',
    data: results.appointments,
    meta: {
      total: results.total,
      page: results.page,
      limit: results.limit,
      totalPages: results.totalPages
    }
  });
});

// @desc    Update appointment details (purpose/notes)
// @route   PUT /api/v1/appointments/:id
// @access  Private (Authenticated)
const updateAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await appointmentService.updateAppointmentDetails(req.params.id, req.body, req.user);

  // Real-time broadcast
  notifyAppointmentChange('updated', appointment);

  res.status(200).json({
    success: true,
    message: 'Appointment updated successfully',
    data: appointment,
    meta: {}
  });
});

// @desc    Cancel an appointment
// @route   DELETE /api/v1/appointments/:id
// @access  Private (Authenticated)
const cancelAppointment = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  const appointment = await appointmentService.cancelAppointment(req.params.id, reason, req.user);

  // Real-time broadcast
  notifyAppointmentChange('cancelled', appointment);

  res.status(200).json({
    success: true,
    message: 'Appointment cancelled successfully',
    data: appointment,
    meta: {}
  });
});

// @desc    Mark patient as arrived
// @route   POST /api/v1/appointments/:id/arrive
// @access  Private (Receptionist or Super Admin)
const markPatientArrived = asyncHandler(async (req, res, next) => {
  const appointment = await appointmentService.markPatientAsArrived(req.params.id, req.user);

  // Real-time broadcast
  notifyAppointmentChange('arrived', appointment);

  res.status(200).json({
    success: true,
    message: 'Patient marked as arrived',
    data: appointment,
    meta: {}
  });
});

// @desc    Mark appointment as completed
// @route   POST /api/v1/appointments/:id/complete
// @access  Private (Doctor only)
const completeAppointment = asyncHandler(async (req, res, next) => {
  const { notes } = req.body;
  const appointment = await appointmentService.markAppointmentCompleted(req.params.id, notes, req.user);

  // Real-time broadcast
  notifyAppointmentChange('completed', appointment);

  res.status(200).json({
    success: true,
    message: 'Appointment completed successfully',
    data: appointment,
    meta: {}
  });
});

// @desc    Search patients by query
// @route   GET /api/v1/appointments/patients/search
// @access  Private (Receptionist or Super Admin)
const searchPatients = asyncHandler(async (req, res, next) => {
  const { q, date, department } = req.query;

  const matchStage = {};
  if (q) {
    const searchRegex = new RegExp(q, 'i');
    matchStage.$or = [
      { name: searchRegex },
      { patientId: searchRegex },
      { mobileNumber: searchRegex }
    ];
  }

  // Optional appointment-level filters (date and/or department) narrow the
  // result to patients who have a matching appointment, without affecting
  // the totalVisits/completedVisits counts below, which stay whole-history.
  const appointmentFilter = {};
  if (date) {
    const startOfDay = new Date(date + 'T00:00:00Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');
    appointmentFilter.date = { $gte: startOfDay, $lte: endOfDay };
  }
  if (department) {
    appointmentFilter.department = department;
  }
  const hasAppointmentFilter = Object.keys(appointmentFilter).length > 0;

  const pipeline = [
    { $match: matchStage },
    { $limit: 50 },
    {
      $lookup: {
        from: 'appointments',
        localField: '_id',
        foreignField: 'patient',
        as: 'appointments'
      }
    }
  ];

  if (hasAppointmentFilter) {
    pipeline.push({
      $addFields: {
        matchingAppointments: {
          $filter: {
            input: '$appointments',
            as: 'a',
            cond: {
              $and: [
                ...(appointmentFilter.date
                  ? [
                      { $gte: ['$$a.date', appointmentFilter.date.$gte] },
                      { $lte: ['$$a.date', appointmentFilter.date.$lte] }
                    ]
                  : []),
                ...(appointmentFilter.department
                  ? [{ $eq: ['$$a.department', appointmentFilter.department] }]
                  : [])
              ]
            }
          }
        }
      }
    });
    pipeline.push({ $match: { $expr: { $gt: [{ $size: '$matchingAppointments' }, 0] } } });
  }

  pipeline.push(
    {
      $addFields: {
        totalVisits: { $size: '$appointments' },
        completedVisits: {
          $size: {
            $filter: {
              input: '$appointments',
              as: 'a',
              cond: { $eq: ['$$a.status', 'completed'] }
            }
          }
        }
      }
    },
    { $project: { appointments: 0, matchingAppointments: 0 } }
  );

  // Single aggregation pipeline: match patients then join appointment counts
  const patientsWithVisits = await Patient.aggregate(pipeline);

  res.status(200).json({
    success: true,
    message: 'Patients retrieved successfully',
    data: patientsWithVisits,
    meta: {}
  });
});

// @desc    Get system audit logs
// @route   GET /api/v1/appointments/audit/logs
// @access  Private (Super Admin only)
const getAuditLogs = asyncHandler(async (req, res, next) => {
  const AuditLog = require('../models/AuditLog');

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find()
      .populate('user', 'name email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments()
  ]);

  res.status(200).json({
    success: true,
    message: 'Audit logs retrieved successfully',
    data: logs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// @desc    Delete appointment permanently
// @route   DELETE /api/v1/appointments/:id/remove
// @access  Private (Super Admin only)
const deleteAppointmentPermanently = asyncHandler(async (req, res, next) => {
  const deletedApp = await appointmentService.deleteAppointmentPermanently(req.params.id, req.user);

  // Real-time broadcast
  notifyAppointmentChange('deleted', { _id: deletedApp._id, slot: deletedApp.slot, status: 'deleted' });

  res.status(200).json({
    success: true,
    message: 'Appointment deleted permanently'
  });
});

module.exports = {
  bookAppointment,
  getAppointments,
  updateAppointment,
  cancelAppointment,
  markPatientArrived,
  completeAppointment,
  searchPatients,
  getAuditLogs,
  deleteAppointmentPermanently
};
