const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {

      serverSelectionTimeoutMS: 30000, // 30 seconds timeout
      socketTimeoutMS: 45000 // 45 seconds socket timeout
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    // Implement retry logic
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;