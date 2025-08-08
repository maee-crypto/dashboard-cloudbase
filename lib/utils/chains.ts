export const CHAIN_NAMES: { [key: string]: string } = {
    '1': 'Ethereum Mainnet',
    '11155111': 'Sepolia',
    '5': 'Goerli',
    '137': 'Polygon',
    '80001': 'Mumbai',
    '56': 'BNB Smart Chain',
    '97': 'BSC Testnet',
    '728126428': 'Tron Mainnet',
    '3448148188': 'Tron Nile Testnet',
    '43114': 'Avalanche',
    '42161': 'Arbitrum One',
    '10': 'Optimism',
    '8217': 'Klaytn',
    '1666600000': 'Harmony',
    '507454': 'Solana Mainnet',
};

export const getChainName = (chainId: string): string => {
  return CHAIN_NAMES[chainId] || `Chain ID: ${chainId}`;
};
