const Department = require('../models/Department');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

// Fetches all active departments
const getDepartments = asyncHandler(async (req, res, next) => {
  const departments = await Department.find({ isActive: { $ne: false } }).sort({ name: 1 });
  res.status(200).json({ success: true, data: departments });
});

// Fetches all departments, including blocked ones, for admin management
const getAllDepartmentsAdmin = asyncHandler(async (req, res, next) => {
  const departments = await Department.find({}).sort({ name: 1 });
  res.status(200).json({ success: true, data: departments });
});

// Creates a new department
const createDepartment = asyncHandler(async (req, res, next) => {
  const { name, workingDays } = req.body;
  if (!name) return next(new AppError('Please provide department name', 400));

  const exists = await Department.findOne({ name: new RegExp('^' + name.trim() + '$', 'i') });
  if (exists) return next(new AppError('Department already exists', 400));

  const deptData = { name: name.trim() };
  if (Array.isArray(workingDays) && workingDays.length > 0) {
    deptData.workingDays = workingDays;
  }

  const department = await Department.create(deptData);
  res.status(201).json({ success: true, data: department });
});

// Updates a department
const updateDepartment = asyncHandler(async (req, res, next) => {
  const { name, workingDays, isActive } = req.body;
  const department = await Department.findById(req.params.id);
  if (!department) return next(new AppError('Department not found', 404));

  if (name !== undefined) department.name = name.trim();
  if (Array.isArray(workingDays)) department.workingDays = workingDays;
  if (typeof isActive === 'boolean') department.isActive = isActive;

  await department.save();
  res.status(200).json({ success: true, data: department });
});

// Deletes a department
const deleteDepartment = asyncHandler(async (req, res, next) => {
  const department = await Department.findById(req.params.id);
  if (!department) return next(new AppError('Department not found', 404));

  await Department.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Department deleted successfully' });
});

module.exports = { getDepartments, getAllDepartmentsAdmin, createDepartment, updateDepartment, deleteDepartment };
