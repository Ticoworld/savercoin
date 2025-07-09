const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  txHash: {
    type: String,
    unique: true,
    index: true
  },
  blockNumber: Number,
  timestamp: Date,
  from: String,
  to: String,
  value: Number,
  tokenValue: Number,
  type: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema);