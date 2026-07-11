const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  mobileNumber: {
    type: String,
    required: [true, 'Please add a mobile number'],
    index: true
  },
  email: {
    type: String,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ],
    lowercase: true
  },
  dob: {
    type: Date,
    required: [true, 'Please add a date of birth']
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: [true, 'Please select a gender']
  }
}, {
  timestamps: true
});

PatientSchema.pre('save', async function(next) {
  if (this.patientId) {
    return next();
  }

  let uniqueIdFound = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!uniqueIdFound && attempts < maxAttempts) {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const proposedId = `PAT-${randomNum}`;
    
    const exists = await mongoose.models.Patient.findOne({ patientId: proposedId });
    if (!exists) {
      this.patientId = proposedId;
      uniqueIdFound = true;
    }
    attempts++;
  }

  if (!uniqueIdFound) {
    return next(new Error('Failed to generate a unique patient ID'));
  }
  next();
});

module.exports = mongoose.model('Patient', PatientSchema);
