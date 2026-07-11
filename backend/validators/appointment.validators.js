const { body } = require('express-validator');
const { getTodayDateStr } = require('../utils/dateUtils');

const appointmentValidator = [
  body('doctorId').isMongoId().withMessage('Valid Doctor ID (MongoId) is required'),
  body('date').isISO8601().withMessage('Valid date (YYYY-MM-DD) is required')
    .custom((value) => {
      const todayStr = getTodayDateStr();
      if (value.split('T')[0] < todayStr) {
        throw new Error('Appointment date cannot be in the past');
      }
      return true;
    }),
  body('slot').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Slot must be in HH:MM format'),
  body('purpose').notEmpty().withMessage('Purpose is required'),
  body('patientType').isIn(['existing', 'new']).withMessage('Patient type must be either existing or new'),

  // Conditionally validate patient fields
  body('patientId').custom((value, { req }) => {
    if (req.body.patientType === 'existing' && !value) {
      throw new Error('Patient ID is required for existing patients');
    }
    return true;
  }),
  body('patientName').custom((value, { req }) => {
    if (req.body.patientType === 'new' && !value) {
      throw new Error('Patient Name is required for new patients');
    }
    return true;
  }),
  body('patientMobile').custom((value, { req }) => {
    if (req.body.patientType === 'new' && !value) {
      throw new Error('Patient Mobile number is required for new patients');
    }
    return true;
  }),
  body('patientDob').custom((value, { req }) => {
    if (req.body.patientType === 'new' && !value) {
      throw new Error('Patient Date of Birth is required for new patients');
    }
    return true;
  }),
  body('patientGender').custom((value, { req }) => {
    if (req.body.patientType === 'new' && !value) {
      throw new Error('Patient Gender is required for new patients');
    }
    return true;
  })
];

module.exports = { appointmentValidator };
