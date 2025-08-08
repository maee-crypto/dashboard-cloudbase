import TronWeb from 'tronweb';

export const waitForTronWeb = async (timeout = 10000): Promise<TronWeb | null> => {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (window.tronWeb?.ready) {
      return window.tronWeb;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return null;
};

export const validateTronTransaction = async (
  tronWeb: TronWeb,
  txId: string,
  maxAttempts = 20
): Promise<boolean> => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await tronWeb.trx.getTransactionInfo(txId);
      if (tx.receipt) {
        return tx.receipt.result === 'SUCCESS';
      }
    } catch (error) {
      console.warn(`Attempt ${i + 1}: Transaction not yet confirmed`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Transaction confirmation timeout');
};

export const getContractEvents = async (
  tronWeb: TronWeb,
  contractAddress: string,
  eventName: string,
  options = {}
) => {
  try {
    const contract = await tronWeb.contract([], contractAddress);
    const events = await contract.getEvents(eventName, options);
    return events;
  } catch (error) {
    console.error('Error fetching contract events:', error);
    throw error;
  }
};
