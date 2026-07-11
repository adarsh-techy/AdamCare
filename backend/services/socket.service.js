let io;

const init = (socketIoInstance) => {
  io = socketIoInstance;

  io.on('connection', (socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });
};

/**
 * Emit real-time appointment updates to all connected clients
 * @param {string} type - 'created', 'updated', 'cancelled', 'arrived', 'completed'
 * @param {object} appointmentData - The updated appointment document
 */
const notifyAppointmentChange = (type, appointmentData) => {
  if (io) {
    io.emit('appointment_change', {
      type,
      data: appointmentData
    });
    console.log(`Socket broadcast: appointment_change of type [${type}] for appointment ID: ${appointmentData._id}`);
  } else {
    console.warn('Socket.IO not initialized. Cannot broadcast notification.');
  }
};

/**
 * Emit real-time schedule updates to all connected clients
 * @param {string} type - 'default_updated', 'override_set', 'override_deleted'
 * @param {string} doctorId - The doctor whose schedule changed
 */
const notifyScheduleChange = (type, doctorId) => {
  if (io) {
    io.emit('schedule_change', { type, doctorId });
    console.log(`Socket broadcast: schedule_change of type [${type}] for doctor: ${doctorId}`);
  } else {
    console.warn('Socket.IO not initialized. Cannot broadcast schedule notification.');
  }
};

/**
 * Emit real-time staff/qualification updates — powers the super admin's
 * notification bell so a fresh request (or an approve/reject elsewhere)
 * shows up without waiting for the next poll.
 * @param {string} type - 'qualification_requested', 'qualification_approved', 'qualification_rejected'
 * @param {string} staffId - The affected staff member's ID
 */
const notifyStaffChange = (type, staffId) => {
  if (io) {
    io.emit('staff_change', { type, staffId });
    console.log(`Socket broadcast: staff_change of type [${type}] for staff: ${staffId}`);
  } else {
    console.warn('Socket.IO not initialized. Cannot broadcast staff notification.');
  }
};

module.exports = {
  init,
  notifyAppointmentChange,
  notifyScheduleChange,
  notifyStaffChange
};