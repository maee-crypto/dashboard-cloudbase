import { Connection, PublicKey, Transaction } from '@solana/web3.js';

// Interface for wallet signer
interface WalletSigner {
  publicKey: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
}

// Interface for Phantom wallet window
interface PhantomWallet {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  isConnected: boolean;
  publicKey?: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
}

declare global {
  interface Window {
    solana?: PhantomWallet;
  }
}

// Solana network configurations
export const SOLANA_NETWORKS = {
  MAINNET: 'https://api.mainnet-beta.solana.com',
  MAINNET_BACKUP: 'https://rpc.ankr.com/solana',
  MAINNET_GENESYSGO: 'https://ssc-dao.genesysgo.net',
  MAINNET_TRITON: 'https://solana-mainnet.rpc.extrnode.com',
  DEVNET: 'https://api.devnet.solana.com',
  TESTNET: 'https://api.testnet.solana.com'
};

// Default RPC endpoint - Use environment variable or fallback to official mainnet
const DEFAULT_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || SOLANA_NETWORKS.MAINNET;

/**
 * Create a connection to Solana network with fallback endpoints
 */
export function createSolanaConnection(rpcEndpoint?: string): Connection {
  const endpoint = rpcEndpoint || DEFAULT_RPC_ENDPOINT;
  return new Connection(endpoint, 'confirmed');
}

/**
 * Create a connection with automatic fallback to backup endpoints
 */
export function createSolanaConnectionWithFallback(): Connection {
  // Try environment variable first, then fallback endpoints
  const endpoints = [
    process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT,
    SOLANA_NETWORKS.MAINNET_BACKUP,
    SOLANA_NETWORKS.MAINNET_TRITON,
    SOLANA_NETWORKS.MAINNET_GENESYSGO,
    SOLANA_NETWORKS.MAINNET
  ].filter(Boolean) as string[];
  
  console.log('🌐 Using Solana RPC endpoint:', endpoints[0]);
  
  // For now, return the first available endpoint
  // In a production app, you'd implement actual fallback logic
  return new Connection(endpoints[0], 'confirmed');
}

/**
 * Validate if a string is a valid Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Phantom wallet is available
 */
export function isPhantomWalletAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).solana?.isPhantom;
}

/**
 * Connect to Phantom wallet
 */
export async function connectPhantomWallet(): Promise<string | null> {
  try {
    if (!isPhantomWalletAvailable()) {
      throw new Error('Phantom wallet not found');
    }

    // Request connection
    console.log('🔗 Requesting wallet connection...');
    const response = await window.solana!.connect();
    
    if (!response.publicKey) {
      throw new Error('No public key received from wallet');
    }

    console.log('✅ Phantom wallet connected:', response.publicKey.toString());
    return response.publicKey.toString();
  } catch (error) {
    console.error('Failed to connect to Phantom wallet:', error);
    
    // Handle user rejection
    if (error instanceof Error && error.message.includes('User rejected')) {
      throw new Error('Wallet connection was rejected by user. Please try again and approve the connection.');
    }
    
    throw new Error('Failed to connect to wallet. Please make sure Phantom is installed and try again.');
  }
}

/**
 * Disconnect from Phantom wallet
 */
export async function disconnectPhantomWallet(): Promise<boolean> {
  try {
    if (!isPhantomWalletAvailable()) {
      return false;
    }

    await (window as any).solana.disconnect();
    return true;
  } catch (error) {
    console.error('Failed to disconnect from Phantom wallet:', error);
    return false;
  }
}

/**
 * Get current connected wallet address
 */
export function getCurrentWalletAddress(): string | null {
  try {
    if (!isPhantomWalletAvailable()) {
      return null;
    }

    const { solana } = window as any;
    return solana.isConnected && solana.publicKey ? solana.publicKey.toString() : null;
  } catch (error) {
    console.error('Failed to get current wallet address:', error);
    return null;
  }
}

/**
 * Create a wallet signer from the connected Phantom wallet
 */
export async function createWalletSigner(): Promise<WalletSigner | null> {
  try {
    // First check if wallet is available
    if (!isPhantomWalletAvailable()) {
      throw new Error('Phantom wallet not found. Please install Phantom wallet extension.');
    }

    // If not connected, try to connect
    if (!window.solana?.isConnected) {
      console.log('🔗 Wallet not connected, attempting to connect...');
      const address = await connectPhantomWallet();
      if (!address) {
        throw new Error('Failed to connect to wallet');
      }
      console.log('✅ Wallet connected:', address);
    }

    // Verify connection and public key
    if (!window.solana?.isConnected || !window.solana.publicKey) {
      throw new Error('Wallet connection failed or no public key available');
    }

    return {
      publicKey: window.solana.publicKey,
      signTransaction: async (transaction: Transaction) => {
        if (!window.solana) {
          throw new Error('Wallet not available');
        }
        return await window.solana.signTransaction(transaction);
      },
      signAllTransactions: async (transactions: Transaction[]) => {
        if (!window.solana) {
          throw new Error('Wallet not available');
        }
        return await window.solana.signAllTransactions(transactions);
      }
    };
  } catch (error) {
    console.error('Failed to create wallet signer:', error);
    return null;
  }
}

/**
 * Check if wallet is connected and ready for transactions
 */
export function isWalletConnected(): boolean {
  return !!(window.solana?.isConnected && window.solana.publicKey);
}
