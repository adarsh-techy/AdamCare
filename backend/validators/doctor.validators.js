const { body } = require('express-validator');

const scheduleValidator = [
  body('sessions').isArray({ min: 1 }).withMessage('Sessions must be an array with at least one session'),
  body('sessions.*.startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Session start time must be in HH:MM format'),
  body('sessions.*.endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Session end time must be in HH:MM format'),
  body('slotDuration').optional().isInt({ min: 5, max: 120 }).withMessage('slotDuration must be an integer between 5 and 120'),
  body('breakTimings').optional().isArray().withMessage('breakTimings must be an array'),
  body('breakTimings.*.startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Break start time must be in HH:MM format'),
  body('breakTimings.*.endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Break end time must be in HH:MM format'),
  body('workingDays').optional().isArray().withMessage('workingDays must be an array'),
  body('workingDays.*').isInt({ min: 0, max: 6 }).withMessage('workingDays elements must be integers between 0 and 6')
];

module.exports = { scheduleValidator };
