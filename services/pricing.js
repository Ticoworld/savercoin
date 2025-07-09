// services/pricing.js
const axios = require('axios');

const MORALIS_API_BASE_URL = 'https://deep-index.moralis.io/api/v2.2/erc20';
// Change this line:
const BNB_CHAIN_ID = 'bsc'; // Changed from '56' to 'bsc'

let cachedPrice = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

const getSAVERPrice = async () => {
  const now = Date.now();

  if (cachedPrice && (now - lastFetchTime < CACHE_DURATION)) {
    console.log('Returning cached SAVERCOIN price:', cachedPrice);
    return cachedPrice;
  }

  const tokenContractAddress = process.env.TOKEN_CONTRACT;
  const moralisApiKey = process.env.MORALIS_API_KEY;

  if (!tokenContractAddress) {
    console.error("TOKEN_CONTRACT is not defined in .env. Cannot fetch token price.");
    return 0.0001;
  }
  if (!moralisApiKey) {
    console.error("MORALIS_API_KEY is not defined in .env. Cannot fetch token price.");
    return 0.0001;
  }

  try {
    console.log(`Fetching SAVERCOIN price for contract ${tokenContractAddress} from Moralis API...`);

    const response = await axios.get(
      `${MORALIS_API_BASE_URL}/${tokenContractAddress}/price`,
      {
        params: {
          chain: BNB_CHAIN_ID, // This will now send 'bsc'
        },
        headers: {
          'X-API-Key': moralisApiKey
        },
        family: 4
      }
    );

    const data = response.data;

    if (data && typeof data.usdPrice === 'number' && data.usdPrice > 0) {
      cachedPrice = data.usdPrice;
      lastFetchTime = now;
      console.log(`SAVERCOIN price fetched from Moralis: $${cachedPrice}`);
      return cachedPrice;
    } else {
      console.warn(`Moralis API did not return a valid price for ${tokenContractAddress}. Response:`, JSON.stringify(data));
      return 0.0001;
    }

  } catch (error) {
    console.error('Error fetching SAVERCOIN price from Moralis API:', error.message);
    if (error.response) {
      console.error('Moralis API Response Data:', error.response.data);
      console.error('Moralis API Response Status:', error.response.status);
    }
    return 0.0001;
  }
};

module.exports = { getSAVERPrice };