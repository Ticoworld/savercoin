require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const startCronJob = require('./jobs/sync');
const apiRoutes = require('./routes/api');
const { getSAVERPrice } = require('./services/pricing'); // Adjust path as needed
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors()); 

app.use('/api', apiRoutes);
// ❗ You forgot the parentheses here

// Immediately-invoked async function to bootstrap the app after DB connects
(async () => {
  try {
    await connectDB(); // ✅ Wait for DB to connect before proceeding

    console.log('MongoDB Connected');

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Start cron job
    startCronJob();

    // Optional test fetch — remove later
    console.log('Testing SAVERCOIN price fetch...');
    const price = await getSAVERPrice();
    console.log('Fetched SAVERCOIN Price:', price);

  } catch (err) {
    console.error('[Fatal Error] Failed to connect to MongoDB or start server:', err);
    process.exit(1);
  }
})();
