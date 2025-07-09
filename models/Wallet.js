const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  buys: [{
    txHash: { type: String, index: true },
    amount: Number,
    timestamp: Date,
    usdValue: Number
  }],
  totalBought: {
    type: Number,
    default: 0
  },
  buyDays: [String], // YYYY-MM-DD format
  disqualified: {
    type: Boolean,
    default: false
  },
  lastUpdated: Date,
    lastBuy: Date, // 👈 Add this

});



module.exports = mongoose.model('Wallet', WalletSchema);

WalletSchema.virtual('isEligible').get(function() {
  return (
    this.buyDays.length >= 5 && 
    !this.disqualified &&
    this.totalBought > 0
  );
});