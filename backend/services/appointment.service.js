const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const User = require('../models/User');
const AppError = require('../utils/appError');
const { generateSlotsForDoctor } = require('./slot.service');
const { createAuditLog } = require('./audit.service');
const { getTodayDateStr } = require('../utils/dateUtils');

/**
 * Book an appointment
 */
const bookAppointment = async (data, requestUser) => {
  const {
    doctorId,
    date, // YYYY-MM-DD
    slot,
    purpose,
    patientType,
    patientId,
    patientName,
    patientMobile,
    patientDob,
    patientGender
  } = data;

  const todayStr = getTodayDateStr();
  if (date < todayStr) {
    throw new AppError('Cannot book appointments for past dates.', 400);
  }

  const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
  if (!doctor) {
    throw new AppError('Doctor not found.', 404);
  }

  const slotData = await generateSlotsForDoctor(doctorId, date);
  const matchedSlot = slotData.slots.find(s => s.time === slot);
  
  if (!matchedSlot) {
    throw new AppError('The requested slot does not exist in the doctor\'s schedule.', 400);
  }
  if (!matchedSlot.isAvailable) {
    if (matchedSlot.isBooked) {
      throw new AppError('This slot is already booked.', 409);
    }
    if (matchedSlot.isPast) {
      throw new AppError('Cannot book a slot in the past.', 400);
    }
    if (matchedSlot.inBreak) {
      throw new AppError('Cannot book during a break period.', 400);
    }
    throw new AppError('The requested slot is not available.', 400);
  }

  let patient;
  if (patientType === 'existing') {
    patient = await Patient.findOne({ patientId });
    if (!patient) {
      throw new AppError(`Patient with ID ${patientId} not found.`, 404);
    }
  } else {
    // Avoid creating duplicate profiles for same name/mobile
    patient = await Patient.findOne({ name: patientName, mobileNumber: patientMobile });
    if (!patient) {
      patient = new Patient({
        name: patientName,
        mobileNumber: patientMobile,
        email: data.patientEmail || '',
        dob: new Date(patientDob),
        gender: patientGender
      });
      await patient.save();
    }
  }

  // Normalize date to UTC midnight
  const appointmentDate = new Date(date + 'T00:00:00Z');
  const appointment = new Appointment({
    patient: patient._id,
    doctor: doctor._id,
    department: doctor.department,
    date: appointmentDate,
    slot,
    status: 'scheduled',
    purpose,
    notes: data.notes || ''
  });

  await appointment.save();

  const populatedAppointment = await Appointment.findById(appointment._id)
    .populate('patient')
    .populate('doctor', 'name email department');
  await createAuditLog({
    userId: requestUser._id,
    role: requestUser.role,
    action: 'APPOINTMENT_CREATED',
    entity: 'Appointment',
    entityId: appointment._id,
    details: {
      patientName: patient.name,
      patientId: patient.patientId,
      doctorName: doctor.name,
      date,
      slot
    }
  });

  return populatedAppointment;
};

/**
 * Fetch appointments with search, filtering, and server-side pagination & sorting
 */
const getAppointmentsList = async (filters = {}, queryParams = {}) => {
  const query = {};

  if (filters.patientSearch) {
    const searchRegex = new RegExp(filters.patientSearch, 'i');
    const matchingPatients = await Patient.find({
      $or: [
        { name: searchRegex },
        { patientId: searchRegex },
        { mobileNumber: searchRegex }
      ]
    }).select('_id');
    
    const patientIds = matchingPatients.map(p => p._id);
    query.patient = { $in: patientIds };
  }

  if (filters.doctorSearch) {
    const searchRegex = new RegExp(filters.doctorSearch, 'i');
    const matchingDoctors = await User.find({
      role: 'doctor',
      name: searchRegex
    }).select('_id');
    
    const doctorIds = matchingDoctors.map(d => d._id);
    query.doctor = { $in: doctorIds };
  }

  if (filters.doctorId) {
    query.doctor = filters.doctorId;
  }

  if (filters.department) {
    query.department = filters.department;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    query.date = {};
    if (filters.startDate) {
      query.date.$gte = new Date(filters.startDate + 'T00:00:00Z');
    }
    if (filters.endDate) {
      query.date.$lte = new Date(filters.endDate + 'T23:59:59.999Z');
    }
  }

  const page = parseInt(queryParams.page, 10) || 1;
  const limit = parseInt(queryParams.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const sortBy = queryParams.sortBy || 'date';
  const sortOrder = queryParams.sortOrder === 'desc' ? -1 : 1;
  const sort = { [sortBy]: sortOrder };

  const total = await Appointment.countDocuments(query);
  const appointments = await Appointment.find(query)
    .populate('patient')
    .populate('doctor', 'name email department')
    .sort(sort)
    .skip(skip)
    .limit(limit);

  return {
    appointments,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Update general details (purpose, notes)
 */
const updateAppointmentDetails = async (id, updateData, requestUser) => {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  // Doctors can only update consultation notes for their own appointments
  if (requestUser.role === 'doctor' && appointment.doctor.toString() !== requestUser._id.toString()) {
    throw new AppError('Not authorized to modify this appointment', 403);
  }

  const oldNotes = appointment.notes;
  const oldPurpose = appointment.purpose;

  if (updateData.notes !== undefined) {
    appointment.notes = updateData.notes;
  }
  if (updateData.purpose !== undefined && requestUser.role !== 'doctor') {
    appointment.purpose = updateData.purpose;
  }

  await appointment.save();

  const populated = await Appointment.findById(id)
    .populate('patient')
    .populate('doctor', 'name email department');

  // Record Audit Log
  await createAuditLog({
    userId: requestUser._id,
    role: requestUser.role,
    action: 'APPOINTMENT_UPDATED',
    entity: 'Appointment',
    entityId: id,
    details: {
      notesChanged: oldNotes !== appointment.notes,
      purposeChanged: oldPurpose !== appointment.purpose
    }
  });

  return populated;
};

/**
 * Cancel an appointment
 */
const cancelAppointment = async (id, reason, requestUser) => {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  // Doctor can cancel only their own
  if (requestUser.role === 'doctor' && appointment.doctor.toString() !== requestUser._id.toString()) {
    throw new AppError('Not authorized to cancel this appointment', 403);
  }

  appointment.status = 'cancelled';
  appointment.cancelledReason = reason || 'No reason provided';
  await appointment.save();

  const populated = await Appointment.findById(id)
    .populate('patient')
    .populate('doctor', 'name email department');

  // Record Audit Log
  await createAuditLog({
    userId: requestUser._id,
    role: requestUser.role,
    action: 'APPOINTMENT_CANCELLED',
    entity: 'Appointment',
    entityId: id,
    details: { reason }
  });

  return populated;
};

/**
 * Mark patient as arrived
 */
const markPatientAsArrived = async (id, requestUser) => {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  if (appointment.status !== 'scheduled') {
    throw new AppError(`Cannot mark as arrived. Current status: ${appointment.status}`, 400);
  }

  appointment.status = 'arrived';
  await appointment.save();

  const populated = await Appointment.findById(id)
    .populate('patient')
    .populate('doctor', 'name email department');

  // Record Audit Log
  await createAuditLog({
    userId: requestUser._id,
    role: requestUser.role,
    action: 'APPOINTMENT_ARRIVED',
    entity: 'Appointment',
    entityId: id
  });

  return populated;
};

/**
 * Mark appointment as completed
 */
const markAppointmentCompleted = async (id, notes, requestUser) => {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  // Only doctors can complete, and only their own appointments
  if (requestUser.role !== 'doctor') {
    throw new AppError('Only doctors can complete appointments', 403);
  }
  if (!appointment.doctor || appointment.doctor.toString() !== requestUser._id.toString()) {
    throw new AppError('Not authorized to complete this appointment', 403);
  }
  if (appointment.status !== 'arrived' && appointment.status !== 'scheduled') {
    throw new AppError(`Cannot complete appointment with status: ${appointment.status}`, 400);
  }

  appointment.status = 'completed';
  if (notes) {
    appointment.notes = notes;
  }
  await appointment.save();

  const populated = await Appointment.findById(id)
    .populate('patient')
    .populate('doctor', 'name email department');

  await createAuditLog({
    userId: requestUser._id,
    role: requestUser.role,
    action: 'APPOINTMENT_COMPLETED',
    entity: 'Appointment',
    entityId: id
  });

  return populated;
};

const deleteAppointmentPermanently = async (id, requestUser) => {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  await Appointment.findByIdAndDelete(id);

  // Record Audit Log
  await createAuditLog({
    userId: requestUser._id,
    role: requestUser.role,
    action: 'APPOINTMENT_DELETED',
    entity: 'Appointment',
    entityId: id,
    details: { slot: appointment.slot, date: appointment.date }
  });

  return appointment;
};

module.exports = {
  bookAppointment,
  getAppointmentsList,
  updateAppointmentDetails,
  cancelAppointment,
  markPatientAsArrived,
  markAppointmentCompleted,
  deleteAppointmentPermanently
};
