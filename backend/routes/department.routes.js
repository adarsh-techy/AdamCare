const express = require('express');
const { getDepartments, createDepartment, updateDepartment, deleteDepartment } = require('../controllers/department.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.get('/', getDepartments);
router.post('/', protect, authorize('super_admin'), createDepartment);
router.put('/:id', protect, authorize('super_admin'), updateDepartment);
router.delete('/:id', protect, authorize('super_admin'), deleteDepartment);

module.exports = router;
