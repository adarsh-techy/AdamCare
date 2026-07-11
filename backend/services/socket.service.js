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

// Tells all connected clients about an appointment change
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

// Tells all connected clients about a schedule change
const notifyScheduleChange = (type, doctorId) => {
  if (io) {
    io.emit('schedule_change', { type, doctorId });
    console.log(`Socket broadcast: schedule_change of type [${type}] for doctor: ${doctorId}`);
  } else {
    console.warn('Socket.IO not initialized. Cannot broadcast schedule notification.');
  }
};

// Tells all connected clients about a staff or qualification change
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