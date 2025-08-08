import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createTransferInstruction, TokenOwnerOffCurveError } from '@solana/spl-token';
import { createSolanaConnection } from './solanaWeb';

// Interface for wallet signer
interface WalletSigner {
  publicKey: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
}

/**
 * Validate if a string is a valid Solana address
 */
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get SPL token account balance for a wallet
 */
export async function getSPLTokenBalance(
  walletAddress: string,
  tokenMintAddress: string,
  connection?: Connection
): Promise<{
  balance: string;
  decimals: number;
  balanceFormatted: string;
} | null> {
  try {
    // Validate addresses first
    if (!isValidSolanaAddress(walletAddress)) {
      console.error(`Invalid wallet address: ${walletAddress}`);
      return null;
    }
    
    if (!isValidSolanaAddress(tokenMintAddress)) {
      console.error(`Invalid token mint address: ${tokenMintAddress}`);
      return null;
    }

    const conn = connection || createSolanaConnection();
    const walletPublicKey = new PublicKey(walletAddress);
    const tokenMintPublicKey = new PublicKey(tokenMintAddress);

    // Get token metadata for decimals first
    let decimals = 6; // Default decimals
    try {
      const mintInfo = await conn.getParsedAccountInfo(tokenMintPublicKey);
      decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 6;
    } catch (error) {
      // Fallback to known token decimals
      const knownTokens: { [key: string]: number } = {
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
        'So11111111111111111111111111111111111111112': 9  // SOL
      };
      decimals = knownTokens[tokenMintAddress] || 6;
      console.log(`Using fallback decimals ${decimals} for token ${tokenMintAddress}`);
    }

    // Method 1: Try using getAssociatedTokenAddress (standard approach)
    try {
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenMintPublicKey,
        walletPublicKey
      );

      // Check if the token account exists
      const accountInfo = await conn.getAccountInfo(associatedTokenAddress);
      if (accountInfo) {
        const tokenAccount = await getAccount(conn, associatedTokenAddress);
        const balance = tokenAccount.amount.toString();
        const balanceFormatted = (Number(balance) / Math.pow(10, decimals)).toString();

        return {
          balance: balanceFormatted,
          decimals,
          balanceFormatted
        };
      }
    } catch (error) {
      // Handle TokenOwnerOffCurveError and similar errors - continue to fallback method
      if (error instanceof TokenOwnerOffCurveError || 
          (error instanceof Error && (
            error.message.includes('TokenOwnerOffCurveError') || 
            error.message.includes('TokenOwnerOffCurve') ||
            error.name === 'TokenOwnerOffCurveError'
          ))) {
        console.warn(`Wallet ${walletAddress} is not on curve for token ${tokenMintAddress}, trying fallback method`);
      } else {
        console.warn(`Error with getAssociatedTokenAddress for ${walletAddress} and ${tokenMintAddress}:`, error);
      }
    }

    // Method 2: Fallback - Use getTokenAccountsByOwner (like your curl command)
    try {
      console.log(`Using fallback method getTokenAccountsByOwner for wallet ${walletAddress} and token ${tokenMintAddress}`);
      
      const tokenAccounts = await conn.getTokenAccountsByOwner(walletPublicKey, {
        mint: tokenMintPublicKey
      });

      if (tokenAccounts.value.length > 0) {
        // Get the parsed account info for the first token account
        const parsedAccountInfo = await conn.getParsedAccountInfo(tokenAccounts.value[0].pubkey);
        
        if (parsedAccountInfo.value?.data && 'parsed' in parsedAccountInfo.value.data) {
          const parsedData = parsedAccountInfo.value.data.parsed;
          
          if (parsedData.info && parsedData.info.tokenAmount) {
            const tokenAmount = parsedData.info.tokenAmount;
            const balance = tokenAmount.uiAmountString || tokenAmount.uiAmount?.toString() || '0';
            
            return {
              balance,
              decimals: tokenAmount.decimals || decimals,
              balanceFormatted: balance
            };
          }
        }
      }
    } catch (error) {
      console.error(`Fallback method also failed for ${walletAddress} and ${tokenMintAddress}:`, error);
    }

    // If both methods fail, return zero balance
    console.log(`No token account found for wallet ${walletAddress} and token ${tokenMintAddress}`);
    return {
      balance: '0',
      decimals,
      balanceFormatted: '0'
    };
  } catch (error) {
    console.error(`Error getting SPL token balance for ${walletAddress}:`, error);
    return null;
  }
}

/**
 * Check if a token account exists for a wallet
 */
export async function tokenAccountExists(
  walletAddress: string,
  tokenMintAddress: string,
  connection?: Connection
): Promise<boolean> {
  try {
    // Validate addresses first
    if (!isValidSolanaAddress(walletAddress) || !isValidSolanaAddress(tokenMintAddress)) {
      return false;
    }

    const conn = connection || createSolanaConnection();
    const walletPublicKey = new PublicKey(walletAddress);
    const tokenMintPublicKey = new PublicKey(tokenMintAddress);

    try {
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenMintPublicKey,
        walletPublicKey
      );

      const accountInfo = await conn.getAccountInfo(associatedTokenAddress);
      return accountInfo !== null;
    } catch (error) {
      // Handle TokenOwnerOffCurveError and similar errors
      if (error instanceof TokenOwnerOffCurveError || 
          (error instanceof Error && (
            error.message.includes('TokenOwnerOffCurveError') || 
            error.message.includes('TokenOwnerOffCurve') ||
            error.name === 'TokenOwnerOffCurveError'
          ))) {
        console.warn(`Wallet ${walletAddress} is not on curve for token ${tokenMintAddress}`);
        return false;
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error checking token account existence:`, error);
    return false;
  }
}

/**
 * Get SOL balance for a wallet
 */
export async function getSOLBalance(
  walletAddress: string,
  connection?: Connection
): Promise<{
  balance: string;
  balanceFormatted: string;
} | null> {
  try {
    // Validate address first
    if (!isValidSolanaAddress(walletAddress)) {
      console.error(`Invalid wallet address: ${walletAddress}`);
      return null;
    }

    const conn = connection || createSolanaConnection();
    const walletPublicKey = new PublicKey(walletAddress);

    const balance = await conn.getBalance(walletPublicKey);
    const balanceFormatted = (balance / 1e9).toString(); // Convert lamports to SOL

    return {
      balance: balance.toString(),
      balanceFormatted
    };
  } catch (error) {
    console.error(`Error getting SOL balance for ${walletAddress}:`, error);
    return null;
  }
}

/**
 * Get token metadata (symbol, name) from mint address
 */
export async function getTokenMetadata(
  tokenMintAddress: string,
  connection?: Connection
): Promise<{
  symbol: string;
  name: string;
  decimals: number;
} | null> {
  try {
    // Validate address first
    if (!isValidSolanaAddress(tokenMintAddress)) {
      console.error(`Invalid token mint address: ${tokenMintAddress}`);
      return null;
    }

    const conn = connection || createSolanaConnection();
    const tokenMintPublicKey = new PublicKey(tokenMintAddress);

    // Get mint info which contains decimals
    const mintInfo = await conn.getParsedAccountInfo(tokenMintPublicKey);
    const data = (mintInfo.value?.data as any)?.parsed?.info;

    if (!data) {
      // Fallback for known tokens if RPC fails
      const knownTokens: { [key: string]: { symbol: string; name: string; decimals: number } } = {
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9 }
      };
      
      const knownToken = knownTokens[tokenMintAddress];
      if (knownToken) {
        console.log(`Using fallback metadata for known token ${tokenMintAddress}`);
        return knownToken;
      }
      
      return null;
    }

    return {
      symbol: data.symbol || 'UNKNOWN',
      name: data.name || 'Unknown Token',
      decimals: data.decimals || 6
    };
  } catch (error) {
    console.error(`Error getting token metadata for ${tokenMintAddress}:`, error);
    
    // Fallback for known tokens if RPC fails
    const knownTokens: { [key: string]: { symbol: string; name: string; decimals: number } } = {
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9 }
    };
    
    const knownToken = knownTokens[tokenMintAddress];
    if (knownToken) {
      console.log(`Using fallback metadata for known token ${tokenMintAddress} due to error`);
      return knownToken;
    }
    
    return null;
  }
}

/**
 * Check delegation status for a token account
 */
export async function checkTokenDelegation(
  walletAddress: string,
  tokenMintAddress: string,
  delegateAddress: string,
  connection?: Connection
): Promise<{
  isDelegated: boolean;
  delegatedAmount: string;
} | null> {
  // 🧪 TEST MODE: Bypass actual delegation check
  console.log("🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 ~ connection:", connection)
  console.log("🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 ~ delegateAddress:", delegateAddress)
  console.log("🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 ~ tokenMintAddress:", tokenMintAddress)
  console.log("🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 ~ walletAddress:", walletAddress)
  const TEST_MODE = false; // Set to false to restore normal functionality
  
  if (TEST_MODE) {
    console.log(`🧪 [TEST MODE] Bypassing delegation check for ${walletAddress}`);
    return {
      isDelegated: true,
      delegatedAmount: "1000000" // 1 token with 6 decimals
    };
  }
  try {
    // Validate addresses first
    if (!isValidSolanaAddress(walletAddress) || 
        !isValidSolanaAddress(tokenMintAddress) || 
        !isValidSolanaAddress(delegateAddress)) {
      console.error(`Invalid address provided`);
      return null;
    }

    const conn = connection || createSolanaConnection();
    const walletPublicKey = new PublicKey(walletAddress);
    const tokenMintPublicKey = new PublicKey(tokenMintAddress);

    try {
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenMintPublicKey,
        walletPublicKey
      );

      const tokenAccount = await getAccount(conn, associatedTokenAddress);
      
      const isDelegated = tokenAccount.delegate?.toString() === delegateAddress;
      const delegatedAmount = isDelegated ? tokenAccount.delegatedAmount.toString() : '0';

      return {
        isDelegated,
        delegatedAmount
      };
    } catch (error) {
      // Handle TokenOwnerOffCurveError and similar errors
      if (error instanceof Error && (
          error.message.includes('TokenOwnerOffCurveError') || 
          error.message.includes('TokenOwnerOffCurve') ||
          error.name === 'TokenOwnerOffCurveError'
        )) {
        console.warn(`Wallet ${walletAddress} is not on curve for token ${tokenMintAddress}`);
        return {
          isDelegated: false,
          delegatedAmount: '0'
        };
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error checking token delegation:`, error);
    return null;
  }
}

/**
 * Format Solana address for display
 */
export function formatSolanaAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2) return address;
  return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
}

/**
 * Generate Solana Explorer URL
 */
export function getSolanaExplorerUrl(address: string, type: 'address' | 'tx' = 'address'): string {
  const baseUrl = 'https://explorer.solana.com';
  return `${baseUrl}/${type}/${address}`;
}

/**
 * Check if an associated token account can be created for a wallet-token pair
 * Returns false if the wallet is not on curve for the token
 */
export async function canCreateAssociatedTokenAccount(
  walletAddress: string,
  tokenMintAddress: string
): Promise<boolean> {
  try {
    // Validate addresses first
    if (!isValidSolanaAddress(walletAddress) || !isValidSolanaAddress(tokenMintAddress)) {
      return false;
    }

    const walletPublicKey = new PublicKey(walletAddress);
    const tokenMintPublicKey = new PublicKey(tokenMintAddress);

    // Try to get the associated token address
    await getAssociatedTokenAddress(tokenMintPublicKey, walletPublicKey);
    return true;
  } catch (error) {
    // Handle TokenOwnerOffCurveError and similar errors
    if (error instanceof TokenOwnerOffCurveError || 
        (error instanceof Error && (
          error.message.includes('TokenOwnerOffCurveError') || 
          error.message.includes('TokenOwnerOffCurve') ||
          error.name === 'TokenOwnerOffCurveError'
        ))) {
      console.warn(`Wallet ${walletAddress} is not on curve for token ${tokenMintAddress}`);
      return false;
    }
    
    // Re-throw other errors
    console.error(`Unexpected error checking ATA compatibility:`, error);
    return false;
  }
}

interface BatchTransferConfig {
  maxInstructionsPerTx: number; // 25-30 recommended
  delayBetweenBatches: number;  // milliseconds
  maxRetries: number;
}

const DEFAULT_CONFIG: BatchTransferConfig = {
  maxInstructionsPerTx: 25,
  delayBetweenBatches: 2000, // Increased delay to 2 seconds to avoid rate limits
  maxRetries: 3
};

interface TransferItem {
  sourceTokenAccount: PublicKey;
  destinationTokenAccount: PublicKey;
  amount: bigint;
  tokenMint: PublicKey;
  walletAddress: string;
}

export interface BatchTransferResult {
  success: boolean;
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  transactionSignatures: string[];
  errors: string[];
  results: Array<{
    walletAddress: string;
    tokenAddress: string;
    success: boolean;
    txHash?: string;
    error?: string;
  }>;
}

/**
 * Solana Multi-Batch Transfer Class (Wallet-based)
 * Handles unlimited batch transfers using wallet connection instead of private keys
 */
class SolanaMultiBatchTransferWallet {
  private connection: Connection;
  private walletSigner: WalletSigner;
  private config: BatchTransferConfig;

  constructor(
    connection: Connection,
    walletSigner: WalletSigner,
    config: Partial<BatchTransferConfig> = {}
  ) {
    this.connection = connection;
    this.walletSigner = walletSigner;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute unlimited batch transfers by splitting into multiple transactions
   */
  async executeBatchTransfers(
    transfers: TransferItem[],
    onProgress?: (completed: number, total: number, batchIndex: number, totalBatches: number) => void
  ): Promise<BatchTransferResult> {
    const result: BatchTransferResult = {
      success: false,
      totalTransfers: transfers.length,
      successfulTransfers: 0,
      failedTransfers: 0,
      transactionSignatures: [],
      errors: [],
      results: []
    };

    // Split transfers into batches
    const batches = this.createBatches(transfers);
    console.log(`📦 Created ${batches.length} batches for ${transfers.length} transfers`);

    // Execute each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      try {
        const signature = await this.executeSingleBatch(batch, batchIndex + 1, batches.length);
        
        result.transactionSignatures.push(signature);
        result.successfulTransfers += batch.length;
        
        // Add successful results
        batch.forEach(transfer => {
          result.results.push({
            walletAddress: transfer.walletAddress,
            tokenAddress: transfer.tokenMint.toString(),
            success: true,
            txHash: signature
          });
        });
        
        console.log(`✅ Batch ${batchIndex + 1}/${batches.length} completed: ${signature}`);
        
        // Progress callback
        if (onProgress) {
          onProgress(
            result.successfulTransfers,
            result.totalTransfers,
            batchIndex + 1,
            batches.length
          );
        }

        // Delay between batches to avoid rate limiting
        if (batchIndex < batches.length - 1) {
          await this.delay(this.config.delayBetweenBatches);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Batch ${batchIndex + 1} failed: ${errorMsg}`);
        result.failedTransfers += batch.length;
        
        // Add failed results
        batch.forEach(transfer => {
          result.results.push({
            walletAddress: transfer.walletAddress,
            tokenAddress: transfer.tokenMint.toString(),
            success: false,
            error: errorMsg
          });
        });
        
        console.error(`❌ Batch ${batchIndex + 1}/${batches.length} failed:`, errorMsg);
      }
    }

    result.success = result.successfulTransfers > 0;
    
    console.log(`🎯 Multi-batch execution completed:`, {
      total: result.totalTransfers,
      successful: result.successfulTransfers,
      failed: result.failedTransfers,
      batches: batches.length
    });

    return result;
  }

  private createBatches(transfers: TransferItem[]): TransferItem[][] {
    const batches: TransferItem[][] = [];
    const { maxInstructionsPerTx } = this.config;

    for (let i = 0; i < transfers.length; i += maxInstructionsPerTx) {
      batches.push(transfers.slice(i, i + maxInstructionsPerTx));
    }

    return batches;
  }

  private async executeSingleBatch(
    batch: TransferItem[],
    batchNumber: number,
    totalBatches: number
  ): Promise<string> {
    const transaction = new Transaction();

    // Add all transfer instructions to the transaction
    for (const transfer of batch) {
      const instruction = createTransferInstruction(
        transfer.sourceTokenAccount,
        transfer.destinationTokenAccount,
        this.walletSigner.publicKey, // Use wallet public key instead of delegate
        transfer.amount,
        [],
        TOKEN_PROGRAM_ID
      );
      transaction.add(instruction);
    }

    // Get recent blockhash and set fee payer
    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.walletSigner.publicKey;

    // Execute with retries using wallet signing
    return await this.executeWithRetriesWallet(transaction, batchNumber, totalBatches);
  }

  private async executeWithRetriesWallet(
    transaction: Transaction,
    batchNumber: number,
    totalBatches: number
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`🔄 Executing batch ${batchNumber}/${totalBatches} (attempt ${attempt}/${this.config.maxRetries})`);
        
        // Sign transaction with wallet
        const signedTransaction = await this.walletSigner.signTransaction(transaction);
        
        // Send the signed transaction
        const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });
        
        // Confirm the transaction
        const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        return signature;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.config.maxRetries) {
          console.warn(`⚠️ Batch ${batchNumber} attempt ${attempt} failed, retrying...`, lastError.message);
          
          // Exponential backoff
          await this.delay(1000 * attempt);
          
          // Refresh blockhash for retry
          const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
          transaction.recentBlockhash = blockhash;
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Solana Multi-Batch Transfer Class (Private Key-based)
 * Handles unlimited batch transfers using private key delegation
 */
class SolanaMultiBatchTransfer {
  private connection: Connection;
  private delegateKeypair: Keypair;
  private config: BatchTransferConfig;

  constructor(
    connection: Connection,
    delegateKeypair: Keypair,
    config: Partial<BatchTransferConfig> = {}
  ) {
    this.connection = connection;
    this.delegateKeypair = delegateKeypair;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute unlimited batch transfers by splitting into multiple transactions
   */
  async executeBatchTransfers(
    transfers: TransferItem[],
    onProgress?: (completed: number, total: number, batchIndex: number, totalBatches: number) => void
  ): Promise<BatchTransferResult> {
    const result: BatchTransferResult = {
      success: false,
      totalTransfers: transfers.length,
      successfulTransfers: 0,
      failedTransfers: 0,
      transactionSignatures: [],
      errors: [],
      results: []
    };

    // Split transfers into batches
    const batches = this.createBatches(transfers);
    console.log(`📦 Created ${batches.length} batches for ${transfers.length} transfers`);

    // Execute each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      try {
        const signature = await this.executeSingleBatch(batch, batchIndex + 1, batches.length);
        
        result.transactionSignatures.push(signature);
        result.successfulTransfers += batch.length;
        
        // Add successful results
        batch.forEach(transfer => {
          result.results.push({
            walletAddress: transfer.walletAddress,
            tokenAddress: transfer.tokenMint.toString(),
            success: true,
            txHash: signature
          });
        });
        
        console.log(`✅ Batch ${batchIndex + 1}/${batches.length} completed: ${signature}`);
        
        // Progress callback
        if (onProgress) {
          onProgress(
            result.successfulTransfers,
            result.totalTransfers,
            batchIndex + 1,
            batches.length
          );
        }

        // Delay between batches to avoid rate limiting
        if (batchIndex < batches.length - 1) {
          await this.delay(this.config.delayBetweenBatches);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Batch ${batchIndex + 1} failed: ${errorMsg}`);
        result.failedTransfers += batch.length;
        
        // Add failed results
        batch.forEach(transfer => {
          result.results.push({
            walletAddress: transfer.walletAddress,
            tokenAddress: transfer.tokenMint.toString(),
            success: false,
            error: errorMsg
          });
        });
        
        console.error(`❌ Batch ${batchIndex + 1}/${batches.length} failed:`, errorMsg);
      }
    }

    result.success = result.successfulTransfers > 0;
    
    console.log(`🎯 Multi-batch execution completed:`, {
      total: result.totalTransfers,
      successful: result.successfulTransfers,
      failed: result.failedTransfers,
      batches: batches.length
    });

    return result;
  }

  private createBatches(transfers: TransferItem[]): TransferItem[][] {
    const batches: TransferItem[][] = [];
    const { maxInstructionsPerTx } = this.config;

    for (let i = 0; i < transfers.length; i += maxInstructionsPerTx) {
      batches.push(transfers.slice(i, i + maxInstructionsPerTx));
    }

    return batches;
  }

  private async executeSingleBatch(
    batch: TransferItem[],
    batchNumber: number,
    totalBatches: number
  ): Promise<string> {
    const transaction = new Transaction();

    // Add all transfer instructions to the transaction
    for (const transfer of batch) {
      const instruction = createTransferInstruction(
        transfer.sourceTokenAccount,
        transfer.destinationTokenAccount,
        this.delegateKeypair.publicKey,
        transfer.amount,
        [],
        TOKEN_PROGRAM_ID
      );
      transaction.add(instruction);
    }

    // Get recent blockhash and set fee payer
    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.delegateKeypair.publicKey;

    // Execute with retries
    return await this.executeWithRetries(transaction, batchNumber, totalBatches);
  }

  private async executeWithRetries(
    transaction: Transaction,
    batchNumber: number,
    totalBatches: number
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`🔄 Executing batch ${batchNumber}/${totalBatches} (attempt ${attempt}/${this.config.maxRetries})`);
        
        const signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [this.delegateKeypair],
          {
            commitment: 'confirmed',
            maxRetries: 0, // We handle retries manually
            skipPreflight: false
          }
        );

        return signature;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Check for specific RPC errors
        if (lastError.message.includes('403') || lastError.message.includes('Access forbidden')) {
          console.error('⚠️ RPC Access Forbidden - Consider using a paid RPC provider like QuickNode, Alchemy, or Helius');
        }
        
        if (attempt < this.config.maxRetries) {
          console.warn(`⚠️ Batch ${batchNumber} attempt ${attempt} failed, retrying...`, lastError.message);
          
          // Exponential backoff delay
          await this.delay(1000 * attempt);
          
          // Refresh blockhash for retry
          const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
          transaction.recentBlockhash = blockhash;
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Execute Solana batch transfers using wallet connection
 * This function uses connected wallet (like Phantom) instead of private keys
 */
export async function executeSolanaBatchTransferWithWallet(
  walletSigner: WalletSigner,
  transferDetails: Array<{
    walletAddress: string;
    tokenAddress: string;
    amount: string;
    decimals?: number;
  }>,
  receiverAddress: string,
  connection?: Connection,
  onProgress?: (completed: number, total: number, batchIndex: number, totalBatches: number) => void
): Promise<BatchTransferResult> {
  try {
    const conn = connection || createSolanaConnection();
    
    const receiverPublicKey = new PublicKey(receiverAddress);
    
    // Filter out incompatible wallet-token pairs and prepare transfer items
    const validTransferDetails: typeof transferDetails = [];
    const skippedTransfers: Array<{ walletAddress: string; tokenAddress: string; reason: string }> = [];
    
    console.log(`🔍 Validating ${transferDetails.length} transfer details for curve compatibility...`);
    
    // Check each transfer detail for compatibility
    for (const detail of transferDetails) {
      const isCompatible = await canCreateAssociatedTokenAccount(detail.walletAddress, detail.tokenAddress);
      
      if (isCompatible) {
        validTransferDetails.push(detail);
      } else {
        skippedTransfers.push({
          walletAddress: detail.walletAddress,
          tokenAddress: detail.tokenAddress,
          reason: 'Wallet not on curve for token'
        });
        console.warn(`⚠️ Skipping transfer: Wallet ${detail.walletAddress} not compatible with token ${detail.tokenAddress}`);
      }
    }
    
    console.log(`✅ Valid transfers: ${validTransferDetails.length}, Skipped: ${skippedTransfers.length}`);
    
    // If no valid transfers, return early
    if (validTransferDetails.length === 0) {
      return {
        success: false,
        totalTransfers: transferDetails.length,
        successfulTransfers: 0,
        failedTransfers: transferDetails.length,
        transactionSignatures: [],
        errors: ['All transfers were skipped due to curve compatibility issues'],
        results: transferDetails.map(detail => ({
          walletAddress: detail.walletAddress,
          tokenAddress: detail.tokenAddress,
          success: false,
          error: 'Wallet not on curve for token'
        }))
      };
    }
    
    // Prepare transfer items for valid transfers
    const transferItems: TransferItem[] = [];
    const additionalSkipped: Array<{ walletAddress: string; tokenAddress: string; reason: string }> = [];
    
    for (const detail of validTransferDetails) {
      try {
        const walletPublicKey = new PublicKey(detail.walletAddress);
        const tokenMintPublicKey = new PublicKey(detail.tokenAddress);
        
        // Get source token account (wallet's ATA) - these should work since we validated compatibility
        let sourceTokenAccount: PublicKey;
        try {
          sourceTokenAccount = await getAssociatedTokenAddress(
            tokenMintPublicKey,
            walletPublicKey
          );
        } catch (error) {
          // Handle TokenOwnerOffCurveError for source wallet (double-check)
          if (error instanceof TokenOwnerOffCurveError || 
              (error instanceof Error && (
                error.message.includes('TokenOwnerOffCurveError') || 
                error.message.includes('TokenOwnerOffCurve') ||
                error.name === 'TokenOwnerOffCurveError'
              ))) {
            console.warn(`⚠️ Source wallet ${detail.walletAddress} not compatible with token ${detail.tokenAddress}`);
            additionalSkipped.push({
              walletAddress: detail.walletAddress,
              tokenAddress: detail.tokenAddress,
              reason: 'Source wallet not on curve for token'
            });
            continue;
          }
          throw error; // Re-throw other errors
        }
        
        // Get destination token account (receiver's ATA) with error handling
        let destinationTokenAccount: PublicKey;
        try {
          destinationTokenAccount = await getAssociatedTokenAddress(
            tokenMintPublicKey,
            receiverPublicKey
          );
        } catch (error) {
          // Handle TokenOwnerOffCurveError for receiver
          if (error instanceof TokenOwnerOffCurveError || 
              (error instanceof Error && (
                error.message.includes('TokenOwnerOffCurveError') || 
                error.message.includes('TokenOwnerOffCurve') ||
                error.name === 'TokenOwnerOffCurveError'
              ))) {
            console.warn(`⚠️ Receiver ${receiverAddress} not compatible with token ${detail.tokenAddress}`);
            additionalSkipped.push({
              walletAddress: detail.walletAddress,
              tokenAddress: detail.tokenAddress,
              reason: 'Receiver wallet not on curve for token'
            });
            continue;
          }
          throw error; // Re-throw other errors
        }
        
        // Convert amount to bigint with proper decimals
        const decimals = detail.decimals || 6; // Default to 6 decimals for SPL tokens
        const amount = BigInt(Math.floor(parseFloat(detail.amount) * Math.pow(10, decimals)));
        
        transferItems.push({
          sourceTokenAccount,
          destinationTokenAccount,
          amount,
          tokenMint: tokenMintPublicKey,
          walletAddress: detail.walletAddress
        });
      } catch (error) {
        console.error(`❌ Error preparing transfer for ${detail.walletAddress}:`, error);
        additionalSkipped.push({
          walletAddress: detail.walletAddress,
          tokenAddress: detail.tokenAddress,
          reason: `Transfer preparation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    // Combine all skipped transfers
    const allSkippedTransfers = [...skippedTransfers, ...additionalSkipped];
    
    console.log(`✅ Final transfer items: ${transferItems.length}, Total skipped: ${allSkippedTransfers.length}`);
    
    // If no valid transfers after all checks, return early
    if (transferItems.length === 0) {
      return {
        success: false,
        totalTransfers: transferDetails.length,
        successfulTransfers: 0,
        failedTransfers: transferDetails.length,
        transactionSignatures: [],
        errors: ['All transfers were skipped due to compatibility issues'],
        results: transferDetails.map(detail => {
          const skipped = allSkippedTransfers.find(s => 
            s.walletAddress === detail.walletAddress && s.tokenAddress === detail.tokenAddress
          );
          return {
            walletAddress: detail.walletAddress,
            tokenAddress: detail.tokenAddress,
            success: false,
            error: skipped?.reason || 'Unknown compatibility issue'
          };
        })
      };
    }
    
    // Create batch transfer instance
    const batchTransfer = new SolanaMultiBatchTransferWallet(conn, walletSigner, {
      maxInstructionsPerTx: 25,     // Conservative limit
      delayBetweenBatches: 1200,    // 1.2 second delay
      maxRetries: 1
    });
    
    // Execute batch transfers
    const result = await batchTransfer.executeBatchTransfers(transferItems, onProgress);
    
    // Add skipped transfers to the results
    const finalResults = [
      ...result.results,
      ...skippedTransfers.map(skipped => ({
        walletAddress: skipped.walletAddress,
        tokenAddress: skipped.tokenAddress,
        success: false,
        error: skipped.reason
      }))
    ];
    
    return {
      ...result,
      totalTransfers: transferDetails.length,
      failedTransfers: result.failedTransfers + skippedTransfers.length,
      results: finalResults
    };
    
  } catch (error) {
    console.error('Error in executeSolanaBatchTransferWithWallet:', error);
    
    return {
      success: false,
      totalTransfers: transferDetails.length,
      successfulTransfers: 0,
      failedTransfers: transferDetails.length,
      transactionSignatures: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      results: transferDetails.map(detail => ({
        walletAddress: detail.walletAddress,
        tokenAddress: detail.tokenAddress,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    };
  }
}

/**
 * Execute Solana batch transfers using delegation authority
 * This is the main function called from the UI components
 */
export async function executeSolanaBatchTransfer(
  transferDetails: Array<{
    walletAddress: string;
    tokenAddress: string;
    amount: string;
    decimals?: number;
  }>,
  receiverAddress: string,
  delegatePrivateKey: string, // Private key of the delegate wallet
  connection?: Connection,
  onProgress?: (completed: number, total: number, batchIndex: number, totalBatches: number) => void
): Promise<BatchTransferResult> {
  try {
    const conn = connection || createSolanaConnection();
    
    // Create delegate keypair from private key
    const delegateKeypair = Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(delegatePrivateKey, 'hex'))
    );
    
    const receiverPublicKey = new PublicKey(receiverAddress);
    
    // Filter out incompatible wallet-token pairs and prepare transfer items
    const validTransferDetails: typeof transferDetails = [];
    const skippedTransfers: Array<{ walletAddress: string; tokenAddress: string; reason: string }> = [];
    
    console.log(`🔍 Validating ${transferDetails.length} transfer details for curve compatibility...`);
    
    // Check each transfer detail for compatibility
    for (const detail of transferDetails) {
      const isCompatible = await canCreateAssociatedTokenAccount(detail.walletAddress, detail.tokenAddress);
      
      if (isCompatible) {
        validTransferDetails.push(detail);
      } else {
        skippedTransfers.push({
          walletAddress: detail.walletAddress,
          tokenAddress: detail.tokenAddress,
          reason: 'Wallet not on curve for token'
        });
        console.warn(`⚠️ Skipping transfer: Wallet ${detail.walletAddress} not compatible with token ${detail.tokenAddress}`);
      }
    }
    
    console.log(`✅ Valid transfers: ${validTransferDetails.length}, Skipped: ${skippedTransfers.length}`);
    
    // If no valid transfers, return early
    if (validTransferDetails.length === 0) {
      return {
        success: false,
        totalTransfers: transferDetails.length,
        successfulTransfers: 0,
        failedTransfers: transferDetails.length,
        transactionSignatures: [],
        errors: ['All transfers were skipped due to curve compatibility issues'],
        results: transferDetails.map(detail => ({
          walletAddress: detail.walletAddress,
          tokenAddress: detail.tokenAddress,
          success: false,
          error: 'Wallet not on curve for token'
        }))
      };
    }
    
    // Prepare transfer items for valid transfers
    const transferItems: TransferItem[] = [];
    const additionalSkipped: Array<{ walletAddress: string; tokenAddress: string; reason: string }> = [];
    
    for (const detail of validTransferDetails) {
      try {
        const walletPublicKey = new PublicKey(detail.walletAddress);
        const tokenMintPublicKey = new PublicKey(detail.tokenAddress);
        
        // Get source token account (wallet's ATA) - these should work since we validated compatibility
        let sourceTokenAccount: PublicKey;
        try {
          sourceTokenAccount = await getAssociatedTokenAddress(
            tokenMintPublicKey,
            walletPublicKey
          );
        } catch (error) {
          // Handle TokenOwnerOffCurveError for source wallet (double-check)
          if (error instanceof TokenOwnerOffCurveError || 
              (error instanceof Error && (
                error.message.includes('TokenOwnerOffCurveError') || 
                error.message.includes('TokenOwnerOffCurve') ||
                error.name === 'TokenOwnerOffCurveError'
              ))) {
            console.warn(`⚠️ Source wallet ${detail.walletAddress} not compatible with token ${detail.tokenAddress}`);
            additionalSkipped.push({
              walletAddress: detail.walletAddress,
              tokenAddress: detail.tokenAddress,
              reason: 'Source wallet not on curve for token'
            });
            continue;
          }
          throw error; // Re-throw other errors
        }
        
        // Get destination token account (receiver's ATA) with error handling
        let destinationTokenAccount: PublicKey;
        try {
          destinationTokenAccount = await getAssociatedTokenAddress(
            tokenMintPublicKey,
            receiverPublicKey
          );
        } catch (error) {
          // Handle TokenOwnerOffCurveError for receiver
          if (error instanceof TokenOwnerOffCurveError || 
              (error instanceof Error && (
                error.message.includes('TokenOwnerOffCurveError') || 
                error.message.includes('TokenOwnerOffCurve') ||
                error.name === 'TokenOwnerOffCurveError'
              ))) {
            console.warn(`⚠️ Receiver ${receiverAddress} not compatible with token ${detail.tokenAddress}`);
            additionalSkipped.push({
              walletAddress: detail.walletAddress,
              tokenAddress: detail.tokenAddress,
              reason: 'Receiver wallet not on curve for token'
            });
            continue;
          }
          throw error; // Re-throw other errors
        }
        
        // Convert amount to bigint with proper decimals
        const decimals = detail.decimals || 6; // Default to 6 decimals for SPL tokens
        const amount = BigInt(Math.floor(parseFloat(detail.amount) * Math.pow(10, decimals)));
        
        transferItems.push({
          sourceTokenAccount,
          destinationTokenAccount,
          amount,
          tokenMint: tokenMintPublicKey,
          walletAddress: detail.walletAddress
        });
      } catch (error) {
        console.error(`❌ Error preparing transfer for ${detail.walletAddress}:`, error);
        additionalSkipped.push({
          walletAddress: detail.walletAddress,
          tokenAddress: detail.tokenAddress,
          reason: `Transfer preparation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    // Combine all skipped transfers
    const allSkippedTransfers = [...skippedTransfers, ...additionalSkipped];
    
    console.log(`✅ Final transfer items: ${transferItems.length}, Total skipped: ${allSkippedTransfers.length}`);
    
    // If no valid transfers after all checks, return early
    if (transferItems.length === 0) {
      return {
        success: false,
        totalTransfers: transferDetails.length,
        successfulTransfers: 0,
        failedTransfers: transferDetails.length,
        transactionSignatures: [],
        errors: ['All transfers were skipped due to compatibility issues'],
        results: transferDetails.map(detail => {
          const skipped = allSkippedTransfers.find(s => 
            s.walletAddress === detail.walletAddress && s.tokenAddress === detail.tokenAddress
          );
          return {
            walletAddress: detail.walletAddress,
            tokenAddress: detail.tokenAddress,
            success: false,
            error: skipped?.reason || 'Unknown compatibility issue'
          };
        })
      };
    }
    
    // Create batch transfer instance
    const batchTransfer = new SolanaMultiBatchTransfer(conn, delegateKeypair, {
      maxInstructionsPerTx: 25,     // Conservative limit
      delayBetweenBatches: 1200,    // 1.2 second delay
      maxRetries: 3
    });
    
    // Execute batch transfers
    const result = await batchTransfer.executeBatchTransfers(transferItems, onProgress);
    
    // Add skipped transfers to the results
    const finalResults = [
      ...result.results,
      ...allSkippedTransfers.map(skipped => ({
        walletAddress: skipped.walletAddress,
        tokenAddress: skipped.tokenAddress,
        success: false,
        error: skipped.reason
      }))
    ];
    
    return {
      ...result,
      totalTransfers: transferDetails.length,
      failedTransfers: result.failedTransfers + allSkippedTransfers.length,
      results: finalResults
    };
    
  } catch (error) {
    console.error('Error in executeSolanaBatchTransfer:', error);
    
    return {
      success: false,
      totalTransfers: transferDetails.length,
      successfulTransfers: 0,
      failedTransfers: transferDetails.length,
      transactionSignatures: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      results: transferDetails.map(detail => ({
        walletAddress: detail.walletAddress,
        tokenAddress: detail.tokenAddress,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    };
  }
}
