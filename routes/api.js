const express = require('express');
const router = express.Router();
const Wallet = require('../models/Wallet');

// Import environment variables for test mode configuration
const TEST_MODE_ENABLED = process.env.TEST_MODE_ENABLED === 'true';
const TEST_BUY_DAY_INTERVAL_MINUTES = parseInt(process.env.TEST_BUY_DAY_INTERVAL_MINUTES || '3');
const DEBUG_LOGGING_ENABLED = process.env.DEBUG_LOGGING_ENABLED === 'true';

/**
 * Calculates the start of the 7-day window based on current time and test mode.
 * In test mode, it uses simulated day IDs. In normal mode, it uses calendar dates.
 * @returns {string|number} The identifier for the start of the 7-day window.
 */
const getSevenDayWindowStart = () => {
  const now = new Date();

  if (TEST_MODE_ENABLED) {
    const sevenDaysAgoMs = now.getTime() - (7 * TEST_BUY_DAY_INTERVAL_MINUTES * 60 * 1000);
    return Math.floor(sevenDaysAgoMs / (TEST_BUY_DAY_INTERVAL_MINUTES * 60 * 1000));
  } else {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(now.getUTCDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    return sevenDaysAgo.toISOString().split('T')[0];
  }
};

// GET /leaderboard - Includes all non-disqualified wallets with at least 1 valid buy day
router.get('/leaderboard', async (req, res) => {
  try {
    if (DEBUG_LOGGING_ENABLED) {
      console.log('[Leaderboard API] Fetching all non-disqualified wallets...');
    }

    const wallets = await Wallet.find({ disqualified: false })
      .sort({ totalBought: -1 })
      .select('address totalBought buyDays lastUpdated lastBuy'); // Include lastBuy

    const sevenDayWindowStart = getSevenDayWindowStart();

    const enrichedWallets = [];

    for (const wallet of wallets) {
      const uniqueBuyDaysInWindow = new Set();

      for (const buyDay of wallet.buyDays) {
        if (buyDay >= sevenDayWindowStart) {
          uniqueBuyDaysInWindow.add(buyDay);
        }
      }

      const activeBuyDaysCount = uniqueBuyDaysInWindow.size;

      if (activeBuyDaysCount > 0) {
        enrichedWallets.push({
          address: wallet.address,
          totalBought: wallet.totalBought,
          activeBuyDaysCount,
          qualified: activeBuyDaysCount >= 5,
          lastBuy: wallet.lastBuy || null, // Add lastBuy
        });
      }
    }

    enrichedWallets.sort((a, b) => b.totalBought - a.totalBought);

    const finalLeaderboard = enrichedWallets.slice(0, 100);

    res.json(finalLeaderboard);
  } catch (error) {
    console.error('[Leaderboard API] Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /wallet/:address
router.get('/wallet/:address', async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ 
      address: req.params.address.toLowerCase() 
    });

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    res.json(wallet);
  } catch (error) {
    console.error('[Wallet API] Error fetching wallet details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
