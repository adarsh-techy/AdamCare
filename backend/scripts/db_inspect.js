const mongoose = require('mongoose');
require('dotenv').config();
const Schedule = require('../models/Schedule');
const ScheduleOverride = require('../models/ScheduleOverride');
const Department = require('../models/Department');
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const doctors = await User.find({ role: 'doctor' }).select('name department email');
    console.log('\n=== Doctors ===');
    console.log(JSON.stringify(doctors, null, 2));

    const schedules = await Schedule.find({});
    console.log('\n=== Schedules ===');
    console.log(JSON.stringify(schedules, null, 2));

    const overrides = await ScheduleOverride.find({});
    console.log('\n=== Schedule Overrides ===');
    console.log(JSON.stringify(overrides, null, 2));

    const departments = await Department.find({});
    console.log('\n=== Departments ===');
    console.log(JSON.stringify(departments, null, 2));

  } catch (error) {
    console.error('Error connecting or querying:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
