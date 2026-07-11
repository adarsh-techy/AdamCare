const appointmentService = require('../services/appointment.service');
const { notifyAppointmentChange } = require('../services/socket.service');
const asyncHandler = require('../utils/asyncHandler');
const Patient = require('../models/Patient');

// Creates a new appointment booking
const bookAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await appointmentService.bookAppointment(req.body, req.user);
  
  // Let connected clients know about this change right away
  notifyAppointmentChange('created', appointment);

  res.status(201).json({
    success: true,
    message: 'Appointment booked successfully',
    data: appointment,
    meta: {}
  });
});

// Fetches appointments, with optional filters, search, and paging
const getAppointments = asyncHandler(async (req, res, next) => {
  const filters = {
    patientSearch: req.query.patientSearch,
    doctorSearch: req.query.doctorSearch,
    department: req.query.department,
    status: req.query.status,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  // Doctors can only see their own appointments
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

// Updates an appointment's details
const updateAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await appointmentService.updateAppointmentDetails(req.params.id, req.body, req.user);

  // Let connected clients know about this change right away
  notifyAppointmentChange('updated', appointment);

  res.status(200).json({
    success: true,
    message: 'Appointment updated successfully',
    data: appointment,
    meta: {}
  });
});

// Cancels an appointment
const cancelAppointment = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  const appointment = await appointmentService.cancelAppointment(req.params.id, reason, req.user);

  // Let connected clients know about this change right away
  notifyAppointmentChange('cancelled', appointment);

  res.status(200).json({
    success: true,
    message: 'Appointment cancelled successfully',
    data: appointment,
    meta: {}
  });
});

// Marks a patient as having arrived for their appointment
const markPatientArrived = asyncHandler(async (req, res, next) => {
  const appointment = await appointmentService.markPatientAsArrived(req.params.id, req.user);

  // Let connected clients know about this change right away
  notifyAppointmentChange('arrived', appointment);

  res.status(200).json({
    success: true,
    message: 'Patient marked as arrived',
    data: appointment,
    meta: {}
  });
});

// Marks an appointment as completed
const completeAppointment = asyncHandler(async (req, res, next) => {
  const { notes } = req.body;
  const appointment = await appointmentService.markAppointmentCompleted(req.params.id, notes, req.user);

  // Let connected clients know about this change right away
  notifyAppointmentChange('completed', appointment);

  res.status(200).json({
    success: true,
    message: 'Appointment completed successfully',
    data: appointment,
    meta: {}
  });
});

// Searches for patients matching a query
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

  const patientsWithVisits = await Patient.aggregate(pipeline);

  res.status(200).json({
    success: true,
    message: 'Patients retrieved successfully',
    data: patientsWithVisits,
    meta: {}
  });
});

// Fetches the system's audit log history
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

// Permanently deletes an appointment
const deleteAppointmentPermanently = asyncHandler(async (req, res, next) => {
  const deletedApp = await appointmentService.deleteAppointmentPermanently(req.params.id, req.user);

  // Let connected clients know about this change right away
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
