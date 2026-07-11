const express = require('express');
const {
  bookAppointment,
  getAppointments,
  updateAppointment,
  cancelAppointment,
  markPatientArrived,
  completeAppointment,
  searchPatients,
  getAuditLogs,
  deleteAppointmentPermanently
} = require('../controllers/appointment.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { appointmentValidator } = require('../validators/appointment.validators');
const { validate } = require('../middlewares/validation.middleware');

const router = express.Router();

router.use(protect); // All routes require authentication

router.get('/', getAppointments);
router.get('/patients/search', authorize('super_admin', 'receptionist'), searchPatients);
router.get('/audit/logs', authorize('super_admin'), getAuditLogs);

router.post('/', authorize('super_admin', 'receptionist'), appointmentValidator, validate, bookAppointment);
router.put('/:id', updateAppointment);
router.delete('/:id', cancelAppointment);
router.delete('/:id/remove', authorize('super_admin'), deleteAppointmentPermanently);

router.post('/:id/arrive', authorize('super_admin', 'receptionist'), markPatientArrived);
router.post('/:id/complete', authorize('doctor'), completeAppointment);

module.exports = router;
