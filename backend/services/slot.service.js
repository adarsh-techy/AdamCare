const Schedule = require('../models/Schedule');
const ScheduleOverride = require('../models/ScheduleOverride');
const Appointment = require('../models/Appointment');
const AppError = require('../utils/appError');
const User = require('../models/User');
const Department = require('../models/Department');
const { getTodayDateStr } = require('../utils/dateUtils');

const parseTimeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const formatMinutesToTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Builds the list of appointment slots for a doctor on a given date
const generateSlotsForDoctor = async (doctorId, dateStr) => {
  const doctor = await User.findById(doctorId);
  if (!doctor) {
    throw new AppError('Doctor not found', 404);
  }

  // Use noon so the date doesn't shift due to timezones
  const dateObj = new Date(dateStr + 'T12:00:00');
  if (isNaN(dateObj.getTime())) {
    throw new AppError('Invalid date format. Expected YYYY-MM-DD.', 400);
  }
  const dayOfWeek = dateObj.getDay();

  // A one-off override for this date beats the normal schedule if it exists
  const override = await ScheduleOverride.findOne({ doctor: doctorId, date: dateStr });

  // If the department is closed, no slots are available no matter what
  let dept = null;
  if (doctor.department) {
    dept = await Department.findOne({ name: doctor.department });
    if (dept && dept.isActive === false) {
      return {
        workingDay: false,
        reason: 'department_closed',
        slots: []
      };
    }
  }

  let schedule = override;
  if (!schedule) {
    schedule = await Schedule.findOne({ doctor: doctorId });
  }

  if (!override) {
    // Use the doctor's set working days, or the department's, or default to Mon-Fri
    const workingDays = (schedule?.workingDays && schedule.workingDays.length > 0)
      ? schedule.workingDays
      : (dept?.workingDays || [1, 2, 3, 4, 5]);
    if (!workingDays.includes(dayOfWeek)) {
      return {
        workingDay: false,
        reason: 'not_working_day',
        slots: []
      };
    }
  }

  if (!schedule) {
    schedule = {
      slotDuration: 15,
      sessions: [
        { startTime: '09:00', endTime: '12:00' },
        { startTime: '13:00', endTime: '17:00' }
      ],
      breakTimings: [{ startTime: '12:00', endTime: '13:00' }]
    };
  }

  const startDate = new Date(dateStr + 'T00:00:00Z');
  const endDate = new Date(dateStr + 'T23:59:59.999Z');
  
  const bookedAppointments = await Appointment.find({
    doctor: doctorId,
    date: { $gte: startDate, $lte: endDate },
    status: { $ne: 'cancelled' }
  }).select('slot');

  const bookedSlots = bookedAppointments.map(app => app.slot);
  const allSlots = [];
  const duration = schedule.slotDuration;
  
  const breaks = schedule.breakTimings.map(b => ({
    start: parseTimeToMinutes(b.startTime),
    end: parseTimeToMinutes(b.endTime)
  }));

  const overlapsWithBreak = (startMin, endMin) => {
    return breaks.some(b => startMin < b.end && endMin > b.start);
  };

  const now = new Date();
  const todayStr = getTodayDateStr();
  const isPastDay = dateStr < todayStr;
  const isToday = dateStr === todayStr;
  
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTimeMins = currentHour * 60 + currentMin;

  for (const session of schedule.sessions) {
    const sessionStart = parseTimeToMinutes(session.startTime);
    const sessionEnd = parseTimeToMinutes(session.endTime);

    let current = sessionStart;
    while (current + duration <= sessionEnd) {
      const slotStart = current;
      const slotEnd = current + duration;
      const slotTimeStr = formatMinutesToTime(slotStart);

      const inBreak = overlapsWithBreak(slotStart, slotEnd);
      if (inBreak) {
        current += duration;
        continue;
      }

      const isBooked = bookedSlots.includes(slotTimeStr);
      
      let isPast = isPastDay;
      if (isToday) {
        isPast = slotStart < currentTimeMins;
      }

      allSlots.push({
        time: slotTimeStr,
        isBooked,
        isPast,
        inBreak,
        isAvailable: !isBooked
      });

      current += duration;
    }
  }

  // Remove duplicate slot times caused by overlapping sessions
  const uniqueSlotsMap = new Map();
  for (const slot of allSlots) {
    if (!uniqueSlotsMap.has(slot.time)) {
      uniqueSlotsMap.set(slot.time, slot);
    } else {
      // Keep the available slot if there's a duplicate
      const existing = uniqueSlotsMap.get(slot.time);
      if (slot.isAvailable && !existing.isAvailable) {
        uniqueSlotsMap.set(slot.time, slot);
      }
    }
  }
  const uniqueSlots = Array.from(uniqueSlotsMap.values());

  uniqueSlots.sort((a, b) => a.time.localeCompare(b.time));

  return {
    workingDay: true,
    slots: uniqueSlots
  };
};

module.exports = {
  generateSlotsForDoctor
};
