const cron = require('node-cron');
const BscScanService = require('../services/bscscan');
const { processTransaction } = require('../services/processor');
const Transaction = require('../models/Transaction');

// --- Configuration for Test Mode ---
// Set TEST_MODE_ENABLED to 'true' in your .env to activate these test parameters.
// Set to 'false' to revert to normal, production-like behavior.
const TEST_MODE_ENABLED = process.env.TEST_MODE_ENABLED === 'true';

// In test mode, this defines the cron job interval in minutes.
// Default: 3 minutes.
const TEST_SYNC_INTERVAL_MINUTES = parseInt(process.env.TEST_SYNC_INTERVAL_MINUTES || '3');
// --- End Test Mode Configuration ---

let lastBlock = process.env.START_BLOCK; // Starting block for BscScan API calls

/**
 * Synchronizes token transactions from BscScan, processes them, and updates the last processed block.
 */
const syncTransactions = async () => {
  try {
    console.log(`Starting transaction sync from block ${lastBlock}`);
    
    const bscScan = new BscScanService(process.env.BSCSCAN_API_KEY);
    const txs = await bscScan.getTokenTransfers(
      process.env.TOKEN_CONTRACT,
      lastBlock
    );

    console.log(`API returned ${txs?.length || 0} transactions`);

    // Ensure the response is an array before processing
    if (!Array.isArray(txs)) {
      console.error('Invalid transactions response from BscScan API:', txs);
      return;
    }

    // Process each new transaction
    for (const tx of txs) {
      await processTransaction(tx);
    }

    // Update the last processed block number if new transactions were found
    if (txs.length > 0) {
      // Find the highest block number among the processed transactions and add 1
      lastBlock = Math.max(...txs.map(tx => parseInt(tx.blockNumber))) + 1;
      console.log(`Processed ${txs.length} transactions. New start block for next sync: ${lastBlock}`);
    }
  } catch (error) {
    console.error('Sync error:', error.message);
  }
};

/**
 * Starts the cron job for periodic transaction synchronization.
 * The interval is determined by test mode configuration.
 */
const startCronJob = () => {
  // Determine the cron interval based on TEST_MODE_ENABLED
  const cronInterval = TEST_MODE_ENABLED ? `*/${TEST_SYNC_INTERVAL_MINUTES} * * * *` : '*/5 * * * *'; // Default to every 5 minutes in normal mode
  
  // Schedule the syncTransactions function to run at the specified interval
  cron.schedule(cronInterval, syncTransactions);
  console.log(`Transaction sync job scheduled with interval: ${cronInterval}`);
};

module.exports = startCronJob;
