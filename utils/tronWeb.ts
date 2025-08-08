import TronWeb from 'tronweb';

// Initialize TronWeb with mainnet configuration
export const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': process.env.NEXT_PUBLIC_TRON_API_KEY },
  privateKey: process.env.NEXT_PUBLIC_TRON_PRIVATE_KEY,
});

// Helper function to check if TronLink is installed
export const isTronLinkInstalled = () => {
  return typeof window !== 'undefined' && window.tronWeb;
};

// Helper function to request account access
export const requestAccountAccess = async () => {
  if (!isTronLinkInstalled()) {
    throw new Error('Please install TronLink!');
  }

  try {
    // Add explicit check for tronLink to satisfy TypeScript
    if (!window.tronLink) {
      throw new Error('TronLink is installed but not ready or accessible.');
    }
    const accounts = await window.tronLink.request({
      method: 'tron_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts available');
    }

    return accounts[0];
  } catch (error) {
    throw new Error('Failed to request account access');
  }
};

// Helper function to get transaction info
export const getTransactionInfo = async (txId: string) => {
  if (!isTronLinkInstalled()) {
    throw new Error('Please install TronLink!');
  }

  try {
    return await window.tronWeb.trx.getTransactionInfo(txId);
  } catch (error) {
    throw new Error('Failed to get transaction info');
  }
}; 