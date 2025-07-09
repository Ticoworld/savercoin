// models/System.js - New model for persistent state
const systemSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});

// jobs/sync.js - Update to use persistent block
const getLastBlock = async () => {
  const record = await System.findOne({ key: 'lastBlock' });
  return record?.value || process.env.START_BLOCK;
};

const saveLastBlock = async (block) => {
  await System.updateOne(
    { key: 'lastBlock' },
    { $set: { value: block } },
    { upsert: true }
  );
};