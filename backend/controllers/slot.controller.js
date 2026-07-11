const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { generateSlotsForDoctor } = require('../services/slot.service');

// @desc    Get dynamic slots and availability for a doctor on a specific date
// @route   GET /api/v1/slots
// @access  Private (Authenticated)
const getSlots = asyncHandler(async (req, res, next) => {
  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    return next(new AppError('Please provide both doctorId and date (YYYY-MM-DD) query parameters', 400));
  }

  const slotData = await generateSlotsForDoctor(doctorId, date);

  res.status(200).json({
    success: true,
    message: 'Slots retrieved successfully',
    data: slotData,
    meta: {}
  });
});

module.exports = {
  getSlots
};
