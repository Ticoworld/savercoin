const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const { getSAVERPrice } = require('./pricing');

// --- Configuration for Test Mode ---
const TEST_MODE_ENABLED = process.env.TEST_MODE_ENABLED === 'true';
const TEST_BUY_DAY_INTERVAL_MINUTES = parseInt(process.env.TEST_BUY_DAY_INTERVAL_MINUTES || '3');
const TEST_MIN_BUY_USD = parseFloat(process.env.TEST_MIN_BUY_USD || '2.0');
const minBuyUSD = TEST_MODE_ENABLED ? TEST_MIN_BUY_USD : 10.0;
const txTimestamp = new Date(parseInt(tx.timeStamp) * 1000);
const contestStart = new Date(process.env.CONTEST_START_TIMESTAMP);
const contestEnd = new Date(process.env.CONTEST_END_TIMESTAMP);
// --- End Test Mode Configuration ---

// --- Debug Logging Control ---
const DEBUG_LOGGING_ENABLED = process.env.DEBUG_LOGGING_ENABLED === 'true';
// --- End Debug Logging Control ---

// These are the addresses that represent the liquidity pool or router
// for your token on PancakeSwap.
// IMPORTANT: Include all possible 'from' or 'to' addresses that BscScan's
// getTokenTransfers API might report for PancakeSwap interactions involving your token.
const PANCAKESWAP_LP_OR_ROUTER_ADDRESSES = [
  "0x10ED43C718714eb63d5aA57B78B54704E256024E".toLowerCase(), // PancakeSwap Router V2
  "0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB".toLowerCase(), // PancakeSwap V2: SAVER 2 (Your SAVER/WBNB LP)
  "0x4b81DfEdC7B06e3c8F528F2f91CAc915BcD1c6d0".toLowerCase(), // Four.meme Contract (if applicable)
  "0x16e1a9b9bbe22707020f8b1d569182b4f75c50be".toLowerCase(), // NEW: Router address found in your latest logs
];

/**
 * Processes a single transaction, determining its type (buy/sell) and updating
 * wallet and transaction records accordingly.
 * @param {object} tx - The transaction object from BscScan API.
 */
const processTransaction = async (tx) => {
  try {
    if (DEBUG_LOGGING_ENABLED) {
      console.log(`[Processor] Attempting to process transaction: ${tx.hash}`);
    }

    // ⏱️ Only process TXs inside the contest period
    const txTimestamp = new Date(parseInt(tx.timeStamp) * 1000);
    const contestStart = new Date(process.env.CONTEST_START_TIMESTAMP);
    const contestEnd = new Date(process.env.CONTEST_END_TIMESTAMP);

    if (txTimestamp < contestStart || txTimestamp > contestEnd) {
      if (DEBUG_LOGGING_ENABLED) {
        console.log(`[Processor] TX ${tx.hash} is outside contest window. Skipping.`);
      }
      return;
    }

    if (!tx?.from || !tx?.to || !tx?.contractAddress || tx?.value === undefined || tx?.tokenDecimal === undefined) {
      console.warn(`[Processor] Invalid transaction structure (missing essential fields for ${tx.hash}):`, tx);
      return;
    }

    const tokenContractAddress = process.env.TOKEN_CONTRACT?.toLowerCase();
    if (tx.contractAddress.toLowerCase() !== tokenContractAddress) {
      if (DEBUG_LOGGING_ENABLED) {
        console.log(`[Processor] Transaction ${tx.hash} is for a different token (${tx.contractAddress}). Skipping.`);
      }
      return;
    }

    const exists = await Transaction.findOne({ txHash: tx.hash });
    if (exists) {
      if (DEBUG_LOGGING_ENABLED) {
        console.log(`[Processor] Transaction ${tx.hash} already processed. Skipping.`);
      }
      return;
    }

    let tokenValue = parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal));
    if (DEBUG_LOGGING_ENABLED) {
      console.log(`[Processor] Raw tx.value: ${tx.value}, tx.tokenDecimal: ${tx.tokenDecimal}`);
      console.log(`[Processor] Calculated tokenValue for ${tx.hash}: ${tokenValue}`);
    }

    if (isNaN(tokenValue) || tokenValue <= 0) {
      console.warn(`[Processor] Skipping TX ${tx.hash} with invalid or zero token value: ${tokenValue}`);
      return;
    }

    let type = null;
    const fromLower = tx.from.toLowerCase();
    const toLower = tx.to.toLowerCase();

    if (PANCAKESWAP_LP_OR_ROUTER_ADDRESSES.includes(fromLower) && !PANCAKESWAP_LP_OR_ROUTER_ADDRESSES.includes(toLower)) {
      type = "buy";
      console.log(`[Processor] Identified as BUY transaction: ${tx.hash}`);
    } else if (PANCAKESWAP_LP_OR_ROUTER_ADDRESSES.includes(toLower) && !PANCAKESWAP_LP_OR_ROUTER_ADDRESSES.includes(fromLower)) {
      type = "sell";
      console.log(`[Processor] Identified as SELL transaction: ${tx.hash}`);
    } else {
      if (DEBUG_LOGGING_ENABLED) {
        console.log(`[Processor] Transaction ${tx.hash} is neither buy nor sell. Skipping.`);
      }
      return;
    }

    const newTx = new Transaction({
      txHash: tx.hash,
      blockNumber: parseInt(tx.blockNumber),
      timestamp: txTimestamp, // Use the parsed timestamp
      from: tx.from,
      to: tx.to,
      value: parseFloat(tx.value),
      tokenValue,
      type,
    });

    await newTx.save();
    console.log(`[Processor] Transaction ${newTx.txHash} saved to DB as type: ${newTx.type}`);

    if (type === "buy") {
      await processBuyTransaction(newTx);
    } else if (type === "sell") {
      await processSellTransaction(newTx);
    }
  } catch (err) {
    console.error(`[Processor] Failed to process transaction ${tx?.hash || 'unknown'}:`, err.message);
  }
};


/**
 * Processes a 'buy' transaction, updating the associated wallet's buy history and total bought amount.
 * Applies test mode parameters for buy day calculation and minimum buy threshold.
 * @param {object} tx - The buy transaction record.
 */
const processBuyTransaction = async (tx) => {
  // For a buy, the 'to' address is the buyer's wallet (the one receiving the SAVER tokens)
  const walletAddress = tx.to; 
  const price = await getSAVERPrice(); // Get the current SAVER price in USD
  const usdValue = tx.tokenValue * price; // Calculate USD value of the buy

  console.log(`[BuyProcessor] Processing buy for ${walletAddress}. TokenValue: ${tx.tokenValue}, Price: ${price}, USDValue: $${usdValue.toFixed(4)}`);

  // --- Test Mode: Minimum Buy Threshold ---
  if (usdValue < minBuyUSD) {
  console.log(`[BuyProcessor] Skipping buy for ${walletAddress} due to low USD value ($${usdValue.toFixed(4)} < $${minBuyUSD}). TxHash: ${tx.txHash}`);
  return;
}
  // --- End Test Mode ---

  // Find the wallet or create a new one if it doesn't exist
  let wallet = await Wallet.findOne({ address: walletAddress });
  if (!wallet) {
    wallet = new Wallet({
      address: walletAddress,
      buys: [],
      totalBought: 0,
      buyDays: [],
      disqualified: false,
    });
    console.log(`[BuyProcessor] Created new wallet for address: ${walletAddress}`);
  } else {
    if (DEBUG_LOGGING_ENABLED) {
      console.log(`[BuyProcessor] Found existing wallet for address: ${walletAddress}`);
    }
  }

  // Add the new buy transaction details to the wallet's buys array
  wallet.buys.push({
    txHash: tx.txHash,
    amount: tx.tokenValue,
    usdValue,
    timestamp: tx.timestamp,
  });

  // Update the total amount of SAVER bought by this wallet
  wallet.totalBought += tx.tokenValue;

  // --- Test Mode: Simulated Buy Days ---
  let buyDayIdentifier;
  if (TEST_MODE_ENABLED) {
    // In test mode, group transactions into "days" of TEST_BUY_DAY_INTERVAL_MINUTES
    buyDayIdentifier = Math.floor(tx.timestamp.getTime() / (TEST_BUY_DAY_INTERVAL_MINUTES * 60 * 1000));
    if (DEBUG_LOGGING_ENABLED) {
      console.log(`[BuyProcessor] Test mode: Buy day identifier for ${walletAddress} is ${buyDayIdentifier} (interval: ${TEST_BUY_DAY_INTERVAL_MINUTES} min)`);
    }
  } else {
    // In normal mode, use the actual calendar date string (YYYY-MM-DD)
    buyDayIdentifier = tx.timestamp.toISOString().split("T")[0];
  }

  // Add the buyDayIdentifier to the wallet's buyDays array if it's a new "day"
  if (!wallet.buyDays.includes(buyDayIdentifier)) {
    wallet.buyDays.push(buyDayIdentifier);
    console.log(`[BuyProcessor] Added new buy day identifier ${buyDayIdentifier} for wallet ${walletAddress}`);
  } else {
    if (DEBUG_LOGGING_ENABLED) {
      console.log(`[BuyProcessor] Buy day identifier ${buyDayIdentifier} already exists for wallet ${walletAddress}`);
    }
  }

  // Update the last activity timestamp for the wallet
  wallet.lastUpdated = new Date();
  wallet.lastBuy = tx.timestamp; // Set latest buy timestamp
  await wallet.save();
  console.log(`[BuyProcessor] Wallet ${walletAddress} updated. Total bought: ${wallet.totalBought.toFixed(4)} SAVER, USD value: $${usdValue.toFixed(4)}. TxHash: ${tx.txHash}`);
};

/**
 * Processes a 'sell' transaction, marking the associated wallet as disqualified.
 * @param {object} tx - The sell transaction record.
 */
const processSellTransaction = async (tx) => {
  // For a sell, the 'from' address is the seller's wallet (the one sending the SAVER tokens)
  const walletAddress = tx.from; 
  console.log(`[SellProcessor] Processing sell for ${walletAddress}. TxHash: ${tx.txHash}`);

  // Update the wallet to mark it as disqualified
  await Wallet.updateOne(
    { address: walletAddress },
    { $set: { disqualified: true } }
  );
  console.log(`[SellProcessor] Wallet ${walletAddress} disqualified due to sell transaction: ${tx.txHash}`);
};

module.exports = { processTransaction };
