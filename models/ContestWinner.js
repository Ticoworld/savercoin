const mongoose = require('mongoose');

const ContestWinnerSchema = new mongoose.Schema({
  address: { type: String, required: true },
  totalBought: { type: Number, required: true },
  buyDays: [String],
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ContestWinner', ContestWinnerSchema);
