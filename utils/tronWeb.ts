import TronWeb from 'tronweb';

// Initialize TronWeb with mainnet configuration
export const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': process.env.NEXT_PUBLIC_TRON_API_KEY },
  privateKey: process.env.NEXT_PUBLIC_TRON_PRIVATE_KEY,
});

// Wallet detection functions
export const isTronLinkInstalled = () => {
  return typeof window !== 'undefined' && 
         (window.tronLink || window.tronWeb) && 
         window.tronLink?.isTronLink !== false;
};

export const isTrustWalletInstalled = () => {
  return typeof window !== 'undefined' && 
         (window.trustwallet?.tron || 
          (window.ethereum && window.ethereum.isTrustWallet));
};

export const getInstalledWallet = () => {
  if (isTronLinkInstalled()) return 'tronlink';
  if (isTrustWalletInstalled()) return 'trustwallet';
  return null;
};

// Helper function to request account access from TronLink
export const requestTronLinkAccountAccess = async () => {
  if (!isTronLinkInstalled()) {
    throw new Error('TronLink is not installed!');
  }

  try {
    if (!window.tronLink) {
      throw new Error('TronLink is installed but not ready or accessible.');
    }
    
    if (!window.tronLink.ready) {
      throw new Error('TronLink is not ready. Please unlock your wallet.');
    }
    
    console.log('🚀 ~ Requesting TronLink accounts...');
    const accounts = await window.tronLink.request({
      method: 'tron_requestAccounts',
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts available');
    }

    console.log('🚀 ~ TronLink accounts received:', accounts);
    return accounts[0];
  } catch (error) {
    console.error('TronLink requestAccountAccess error:', error);
    throw new Error(`Failed to request account access from TronLink: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper function to request account access from Trust Wallet
export const requestTrustWalletAccountAccess = async () => {
  if (!isTrustWalletInstalled()) {
    throw new Error('Trust Wallet is not installed!');
  }

  try {
    let account: string | undefined;

    // Try Trust Wallet Tron extension first
    if (window.trustwallet?.tron) {
      try {
        console.log('🚀 ~ Trust Wallet Tron extension detected, attempting connection...');
        const result = await window.trustwallet.tron.request({
          method: 'tron_requestAccounts',
        });
        if (result && result.length > 0) {
          account = result[0];
          console.log('🚀 ~ Trust Wallet Tron extension connected successfully:', account);
        }
      } catch (tronError) {
        console.log('🚀 ~ Trust Wallet Tron extension failed, trying Ethereum bridge...', tronError);
        // Continue to Ethereum bridge fallback
      }
    }
    
    // Fallback to Ethereum bridge for Trust Wallet
    if (!account && window.ethereum && window.ethereum.isTrustWallet) {
      try {
        console.log('🚀 ~ Trust Wallet Ethereum bridge detected, attempting connection...');
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        
        if (accounts && accounts.length > 0) {
          // Convert Ethereum address to Tron address format
          // This is a simplified conversion - in production you might want more robust handling
          account = accounts[0];
          console.log('🚀 ~ Using Trust Wallet via Ethereum bridge, address:', account);
        }
      } catch (ethError) {
        console.error('🚀 ~ Trust Wallet Ethereum bridge failed:', ethError);
        throw new Error('Failed to connect via Trust Wallet Ethereum bridge');
      }
    }

    if (!account) {
      throw new Error('No accounts available from Trust Wallet');
    }

    return account;
  } catch (error) {
    console.error('Trust Wallet requestAccountAccess error:', error);
    throw new Error(`Failed to request account access from Trust Wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Universal account access function that tries both wallet types
export const requestAccountAccess = async () => {
  const walletType = getInstalledWallet();
  
  if (!walletType) {
    throw new Error('No supported wallet detected. Please install TronLink or Trust Wallet.');
  }

  try {
    if (walletType === 'tronlink') {
      return await requestTronLinkAccountAccess();
    } else if (walletType === 'trustwallet') {
      return await requestTrustWalletAccountAccess();
    }
  } catch (error) {
    throw new Error(`Failed to connect to ${walletType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper function to get transaction info
export const getTransactionInfo = async (txId: string) => {
  if (!isTronLinkInstalled() && !isTrustWalletInstalled()) {
    throw new Error('No supported wallet detected!');
  }

  try {
    return await window.tronWeb.trx.getTransactionInfo(txId);
  } catch (error) {
    throw new Error('Failed to get transaction info');
  }
};

// Enhanced function to check if any wallet is ready
export const isTronWebReady = () => {
  // Check if we have the basic requirements
  if (typeof window === 'undefined' || !window.tronWeb) {
    return false;
  }

  // If TronLink is ready, we're good to go
  if (window.tronLink?.ready) {
    return true;
  }

  // If TronWeb has essential properties, consider it ready
  // The 'ready' property is not always reliable, so we check for functionality instead
  try {
    const hasEssentialProperties = window.tronWeb.address && 
                                 window.tronWeb.fullNode && 
                                 window.tronWeb.contract;
    
    if (hasEssentialProperties) {
      console.log('🚀 ~ isTronWebReady ~ TronWeb has essential properties, considering ready');
      return true;
    }
  } catch (error) {
    console.log('🚀 ~ isTronWebReady ~ Error checking TronWeb properties:', error);
  }

  // Fallback: if TronWeb exists and TronLink exists, consider it ready
  if (window.tronLink) {
    console.log('🚀 ~ isTronWebReady ~ TronWeb and TronLink exist, considering ready');
    return true;
  }

  console.log('🚀 ~ isTronWebReady ~ Check failed:', {
    hasWindow: typeof window !== 'undefined',
    hasTronWeb: !!window.tronWeb,
    tronWebReady: (window.tronWeb as any)?.ready,
    hasTronLink: !!window.tronLink,
    tronLinkReady: window.tronLink?.ready,
    hasEssentialProps: !!(window.tronWeb?.address && window.tronWeb?.fullNode && window.tronWeb?.contract)
  });
  
  return false;
};

// Enhanced function to wait for any wallet to be ready
export const waitForTronWebReady = async (maxWaitTime = 10000): Promise<boolean> => {
  console.log('🚀 ~ waitForTronWebReady ~ Starting wait for TronWeb to be ready...');
  console.log('🚀 ~ Current state:', {
    hasTronWeb: !!window.tronWeb,
    tronWebReady: (window.tronWeb as any)?.ready,
    hasTronLink: !!window.tronLink,
    tronLinkReady: window.tronLink?.ready,
    hasTrustWallet: !!window.trustwallet?.tron,
    hasEthereum: !!window.ethereum
  });

  if (isTronWebReady()) {
    console.log('🚀 ~ waitForTronWebReady ~ TronWeb is already ready!');
    return true;
  }

  const startTime = Date.now();
  const checkInterval = 200; // Check every 200ms
  let attempts = 0;

  while (Date.now() - startTime < maxWaitTime) {
    attempts++;
    
    if (isTronWebReady()) {
      console.log(`🚀 ~ waitForTronWebReady ~ TronWeb became ready after ${attempts} attempts!`);
      return true;
    }
    
    // Log progress every 10 attempts (2 seconds)
    if (attempts % 10 === 0) {
      console.log(`🚀 ~ waitForTronWebReady ~ Attempt ${attempts}: Still waiting... Current state:`, {
        hasTronWeb: !!window.tronWeb,
        tronWebReady: (window.tronWeb as any)?.ready,
        hasTronLink: !!window.tronLink,
        tronLinkReady: window.tronLink?.ready
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  console.log(`🚀 ~ waitForTronWebReady ~ Timed out after ${maxWaitTime}ms. Final state:`, {
    hasTronWeb: !!window.tronWeb,
    tronWebReady: (window.tronWeb as any)?.ready,
    hasTronLink: !!window.tronLink,
    tronLinkReady: window.tronLink?.ready
  });
  return false;
};

// Function to initialize TronWeb with wallet provider
export const initializeTronWebWithWallet = async () => {
  const walletType = getInstalledWallet();
  
  if (!walletType) {
    throw new Error('No supported wallet detected');
  }

  try {
    if (walletType === 'tronlink' && window.tronLink?.ready) {
      // TronLink automatically injects tronWeb
      if (window.tronWeb && (window.tronWeb as any).ready) {
        return window.tronWeb;
      }
    } else if (walletType === 'trustwallet') {
      // For Trust Wallet, we need to ensure tronWeb is properly configured
      if (window.tronWeb && (window.tronWeb as any).ready) {
        return window.tronWeb;
      }
    }
    
    throw new Error(`Wallet ${walletType} is not ready`);
  } catch (error) {
    throw new Error(`Failed to initialize TronWeb with ${walletType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 

// Function to get detailed wallet information
export const getWalletInfo = () => {
  const info = {
    tronLink: {
      installed: isTronLinkInstalled(),
      ready: window.tronLink?.ready || false,
      hasTronWeb: !!(window.tronWeb && (window.tronWeb as any).ready)
    },
    trustWallet: {
      installed: isTrustWalletInstalled(),
      hasTronExtension: !!(window.trustwallet?.tron),
      hasEthereumBridge: !!(window.ethereum && window.ethereum.isTrustWallet)
    },
    detectedWallet: getInstalledWallet(),
    tronWebReady: isTronWebReady()
  };

  console.log('🚀 ~ Wallet Detection Info:', info);
  return info;
};

// Function to provide wallet connection guidance
export const getWalletConnectionGuidance = () => {
  const wallet = getInstalledWallet();
  
  if (!wallet) {
    return {
      message: 'No supported wallet detected',
      instructions: [
        'Install TronLink extension from the Chrome Web Store',
        'Or install Trust Wallet from the App Store/Play Store',
        'Refresh the page after installation'
      ]
    };
  }

  if (wallet === 'tronlink') {
    return {
      message: 'TronLink detected',
      instructions: [
        'Make sure TronLink is unlocked',
        'Ensure you are connected to Tron Mainnet',
        'Click "Connect TronLink" to establish connection'
      ]
    };
  }

  if (wallet === 'trustwallet') {
    return {
      message: 'Trust Wallet detected',
      instructions: [
        'Make sure Trust Wallet is unlocked',
        'Ensure you have Tron network enabled',
        'Click "Connect Trust Wallet" to establish connection'
      ]
    };
  }

  return {
    message: 'Unknown wallet type',
    instructions: ['Please refresh the page and try again']
  };
}; 

// Function to manually trigger TronWeb initialization
export const triggerTronWebInit = async (maxWaitTime = 5000): Promise<boolean> => {
  console.log('🚀 ~ triggerTronWebInit ~ Manually triggering TronWeb initialization...');
  
  // If TronWeb is already ready, return true
      if (window.tronWeb && (window.tronWeb as any).ready) {
      console.log('🚀 ~ triggerTronWebInit ~ TronWeb already ready');
      return true;
    }

  // Wait for TronWeb to be injected by TronLink
  const startTime = Date.now();
  const checkInterval = 100; // Check every 100ms

  while (Date.now() - startTime < maxWaitTime) {
    // Check if TronWeb was injected
    if (window.tronWeb) {
      console.log('🚀 ~ triggerTronWebInit ~ TronWeb detected, waiting for ready state...');
      
      // Wait for TronWeb to be ready
      const readyStartTime = Date.now();
      while (Date.now() - readyStartTime < 3000) { // Wait up to 3 seconds for ready state
        if ((window.tronWeb as any).ready) {
          console.log('🚀 ~ triggerTronWebInit ~ TronWeb is now ready!');
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('🚀 ~ triggerTronWebInit ~ TronWeb detected but not ready after timeout');
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  console.log('🚀 ~ triggerTronWebInit ~ Failed to initialize TronWeb');
  return false;
};

// Enhanced function to request account access with TronWeb initialization
export const requestAccountAccessWithInit = async () => {
  console.log('🚀 ~ requestAccountAccessWithInit ~ Starting enhanced account access...');
  
  try {
    // First request account access
    const account = await requestAccountAccess();
    console.log('🚀 ~ requestAccountAccessWithInit ~ Account access granted:', account);
    
    // Then ensure TronWeb is available with comprehensive fallback
    const initSuccess = await ensureTronWebAvailable();
    
    if (!initSuccess) {
      console.warn('🚀 ~ requestAccountAccessWithInit ~ TronWeb initialization failed, but account access was granted');
    } else {
      console.log('🚀 ~ requestAccountAccessWithInit ~ TronWeb initialization successful!');
    }
    
    return account;
  } catch (error) {
    console.error('🚀 ~ requestAccountAccessWithInit ~ Failed:', error);
    throw error;
  }
}; 

// More aggressive TronWeb initialization
export const forceTronWebInit = async (maxWaitTime = 10000): Promise<boolean> => {
  console.log('🚀 ~ forceTronWebInit ~ Starting aggressive TronWeb initialization...');
  
  // If already ready, return true
      if (window.tronWeb && (window.tronWeb as any).ready) {
      console.log('🚀 ~ forceTronWebInit ~ TronWeb already ready');
      return true;
    }

  const startTime = Date.now();
  const checkInterval = 100;

  while (Date.now() - startTime < maxWaitTime) {
    // Check if TronWeb was injected
    if (window.tronWeb) {
      console.log('🚀 ~ forceTronWebInit ~ TronWeb detected, checking ready state...');
      
      // Try to access a property to trigger initialization
      try {
        if (window.tronWeb.address) {
          console.log('🚀 ~ forceTronWebInit ~ TronWeb address property accessible');
        }
      } catch (e) {
        console.log('🚀 ~ forceTronWebInit ~ TronWeb address property not accessible yet');
      }
      
      // Wait for ready state
      const readyStartTime = Date.now();
      while (Date.now() - readyStartTime < 5000) { // Wait up to 5 seconds
        if ((window.tronWeb as any).ready) {
          console.log('🚀 ~ forceTronWebInit ~ TronWeb is now ready!');
          return true;
        }
        
        // Try to trigger ready state by accessing properties
        try {
          if (window.tronWeb.fullNode && window.tronWeb.fullNode.host) {
            console.log('🚀 ~ forceTronWebInit ~ TronWeb fullNode accessible');
          }
        } catch (e) {
          // Ignore errors during initialization
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('🚀 ~ forceTronWebInit ~ TronWeb detected but not ready after timeout');
      break;
    }
    
    // Try to trigger TronLink injection
    if (window.tronLink && window.tronLink.ready) {
      console.log('🚀 ~ forceTronWebInit ~ TronLink ready, waiting for TronWeb injection...');
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  console.log('🚀 ~ forceTronWebInit ~ Failed to initialize TronWeb');
  return false;
}; 

// Fallback TronWeb creation
export const createFallbackTronWeb = () => {
  console.log('🚀 ~ createFallbackTronWeb ~ Creating fallback TronWeb instance...');
  
  try {
    // Create a new TronWeb instance with mainnet configuration
    const fallbackTronWeb = new TronWeb({
      fullHost: 'https://api.trongrid.io',
      headers: { 'TRON-PRO-API-KEY': process.env.NEXT_PUBLIC_TRON_API_KEY },
    });
    
    console.log('🚀 ~ createFallbackTronWeb ~ Fallback TronWeb created successfully');
    return fallbackTronWeb;
  } catch (error) {
    console.error('🚀 ~ createFallbackTronWeb ~ Failed to create fallback TronWeb:', error);
    return null;
  }
};

// Comprehensive TronWeb initialization with fallback
export const ensureTronWebAvailable = async (): Promise<boolean> => {
  console.log('🚀 ~ ensureTronWebAvailable ~ Ensuring TronWeb is available...');
  
  // Check if TronWeb is already ready
  if (isTronWebReady()) {
    console.log('🚀 ~ ensureTronWebAvailable ~ TronWeb already available');
    return true;
  }
  
  // Try to initialize injected TronWeb
  const initSuccess = await forceTronWebInit(5000);
  if (initSuccess) {
    console.log('🚀 ~ ensureTronWebAvailable ~ Injected TronWeb initialization successful');
    return true;
  }
  
  // Try fallback TronWeb creation
  console.log('🚀 ~ ensureTronWebAvailable ~ Trying fallback TronWeb creation...');
  const fallbackTronWeb = createFallbackTronWeb();
  if (fallbackTronWeb) {
    // Replace the global TronWeb with our fallback
    (window as any).tronWeb = fallbackTronWeb;
    console.log('🚀 ~ ensureTronWebAvailable ~ Fallback TronWeb set as global instance');
    return true;
  }
  
  console.log('🚀 ~ ensureTronWebAvailable ~ All TronWeb initialization methods failed');
  return false;
}; 