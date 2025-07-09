const axios = require('axios');

// Etherscan V2 unified API endpoint (used across all EVM chains)
const BSCSCAN_API = 'https://api.etherscan.io/v2/api';

class BscScanService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async getTokenTransfers(contract, startBlock, endBlock = 'latest') {
    const params = {
      chainid: 56, // BNB Smart Chain
      module: 'account',
      action: 'tokentx',
      contractaddress: contract,
      startblock: startBlock,
      endblock: endBlock,
      sort: 'asc',
      apikey: this.apiKey
    };

    try {
      const response = await axios.get(BSCSCAN_API, { params });

      if (response.data.status !== '1') {
        throw new Error(`BscScan API error: ${response.data.message}`);
      }

      return response.data.result;
    } catch (error) {
      console.error('BscScan API Error:', error.message);
      return [];
    }
  }
}

module.exports = BscScanService;
