const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/emr_appointment', {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`✓ Database connected successfully — ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error(`✗ Database connection failed — ${error.message}`);
    console.error('  The server will keep running, but any feature that needs the database will not work until this is fixed. Check that MONGO_URI in .env is correct and the database is reachable.');
  }
};

module.exports = connectDB;