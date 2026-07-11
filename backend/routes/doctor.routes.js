const express = require('express');
const {
  getDoctors,
  configureSchedule,
  getScheduleByDoctor,
  getScheduleOverride,
  upsertScheduleOverride,
  deleteScheduleOverride
} = require('../controllers/doctor.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { scheduleValidator } = require('../validators/doctor.validators');
const { validate } = require('../middlewares/validation.middleware');

const router = express.Router();

router.use(protect);

router.get('/', getDoctors);

// Override routes must come before /:id/schedule to avoid ambiguity
router.get('/:id/schedule/override', getScheduleOverride);
router.put('/:id/schedule/override', authorize('super_admin'), upsertScheduleOverride);
router.delete('/:id/schedule/override', authorize('super_admin'), deleteScheduleOverride);

router.get('/:id/schedule', getScheduleByDoctor);
router.put('/:id/schedule', authorize('super_admin'), scheduleValidator, validate, configureSchedule);

module.exports = router;
