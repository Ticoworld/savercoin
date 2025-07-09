const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
  blockNumber: {
    type: Number,
    required: true,
    unique: true, // Ensure only one record for the last processed block
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Block', BlockSchema);
