const express = require('express');
const { getSlots } = require('../controllers/slot.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', protect, getSlots);

module.exports = router;
