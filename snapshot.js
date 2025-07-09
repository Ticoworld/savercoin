const mongoose = require('mongoose');
const Wallet = require('./models/Wallet');
const ContestWinner = require('./models/ContestWinner');

const runSnapshot = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const contestEnd = new Date(process.env.CONTEST_END_TIMESTAMP);
  const now = new Date();

  if (now < contestEnd) {
    console.log('⏳ Contest not over yet.');
    return; // ✅ Don't exit the process
  }

  const alreadyExists = await ContestWinner.findOne();
  if (alreadyExists) {
    console.log('✅ Winner already saved:', alreadyExists.address);
    return;
  }

  const candidates = await Wallet.find({
    disqualified: false,
    totalBought: { $gt: 0 },
  }).sort({ totalBought: -1 }).lean();

  const eligible = candidates.filter(w => w.buyDays.length >= 5);
  if (eligible.length === 0) {
    console.log('⚠️ No eligible wallets.');
    return;
  }

  const winner = eligible[0];
  const saved = await ContestWinner.create({
    address: winner.address,
    totalBought: winner.totalBought,
    buyDays: winner.buyDays,
  });

  console.log('🏆 Winner saved:', saved.address);
};

module.exports = runSnapshot;
