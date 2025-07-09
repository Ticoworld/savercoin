require('dotenv').config();
const mongoose = require('mongoose');
const Wallet = require('./models/Wallet');
const ContestWinner = require('./models/ContestWinner');

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const contestEnd = new Date(process.env.CONTEST_END_TIMESTAMP);
  const now = new Date();

  if (now < contestEnd) {
    console.log('⏳ Contest not over yet.');
    return process.exit(0);
  }

  const alreadyExists = await ContestWinner.findOne();
  if (alreadyExists) {
    console.log('✅ Winner already saved:', alreadyExists.address);
    return process.exit(0);
  }

  const candidates = await Wallet.find({
    disqualified: false,
    totalBought: { $gt: 0 },
    buyDays: { $size: 5 } // Can use $size or manual .filter()
  }).sort({ totalBought: -1 }).lean();

  const eligible = candidates.filter(w => w.buyDays.length >= 5);
  if (eligible.length === 0) {
    console.log('⚠️ No eligible wallets.');
    return process.exit(0);
  }

  const winner = eligible[0];
  const saved = await ContestWinner.create({
    address: winner.address,
    totalBought: winner.totalBought,
    buyDays: winner.buyDays,
  });

  console.log('🏆 Winner saved:', saved.address);
  process.exit(0);
};

main().catch(err => {
  console.error('❌ Snapshot failed:', err);
  process.exit(1);
});
