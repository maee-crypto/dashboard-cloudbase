import { Connection, PublicKey } from '@solana/web3.js';
import { createSolanaConnection, createWalletSigner } from './solanaWeb';
import { 
  getSPLTokenBalance, 
  checkTokenDelegation, 
  executeSolanaBatchTransferWithWallet,
  BatchTransferResult 
} from './solanaHelper';

// Types
interface WalletSigner {
  publicKey: PublicKey;
  signTransaction: (transaction: any) => Promise<any>;
  signAllTransactions: (transactions: any[]) => Promise<any[]>;
}

interface DelegationCheckResult {
  walletAddress: string;
  tokenAddress: string;
  balance: string;
  delegatedAmount: string;
  isDelegated: boolean;
  validAmount: string; // Min of balance and delegated amount
  decimals: number;
}

interface ExecutionStatusUpdate {
  walletAddress: string;
  tokenAddress: string;
  chainId: string;
  status: 'new' | 'pending' | 'executed';
  txHash?: string;
  executedBy?: string;
}

/**
 * Main class for Solana delegation batch transfers
 * Handles wallet connection, delegation checking, and batch execution
 */
export class SolanaDelegationBatchTransfer {
  private connection: Connection;
  private walletSigner: WalletSigner | null = null;
  private delegateAddress: string;
  private chainId: string = '507454'; // Solana mainnet

  constructor(delegateAddress: string, connection?: Connection) {
    this.connection = connection || createSolanaConnection();
    this.delegateAddress = delegateAddress;
  }

  /**
   * Connect to wallet (Phantom/Solflare)
   */
  async connectWallet(): Promise<{ success: boolean; address?: string; error?: string }> {
    try {
      console.log('🔗 Connecting to Solana wallet...');
      
      const signer = await createWalletSigner();
      if (!signer) {
        return { success: false, error: 'Failed to connect to wallet' };
      }
      
      this.walletSigner = signer;
      const address = signer.publicKey.toString();
      
      console.log('✅ Wallet connected successfully:', address);
      return { success: true, address };
    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown wallet connection error' 
      };
    }
  }

  /**
   * Check delegation status for all wallet-token pairs
   */
  async checkDelegationStatus(
    walletTokenPairs: Array<{ walletAddress: string; tokenAddress: string }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<DelegationCheckResult[]> {
    console.log(`🔍 Checking delegation status for ${walletTokenPairs.length} wallet-token pairs...`);
    
    const results: DelegationCheckResult[] = [];
    
    for (let i = 0; i < walletTokenPairs.length; i++) {
      const { walletAddress, tokenAddress } = walletTokenPairs[i];
      
      try {
        // Check delegation status
        const delegationResult = await checkTokenDelegation(
          walletAddress,
          tokenAddress,
          this.delegateAddress,
          this.connection
        );

        // Get token balance
        const balanceResult = await getSPLTokenBalance(
          walletAddress,
          tokenAddress,
          this.connection
        );

        const balance = balanceResult?.balance || '0';
        const decimals = balanceResult?.decimals || 6;
        const isDelegated = delegationResult?.isDelegated || false;
        const delegatedAmount = delegationResult?.delegatedAmount || '0';

        // Calculate valid amount (minimum of balance and delegated amount)
        const balanceNum = parseFloat(balance);
        const delegatedNum = parseFloat(delegatedAmount);
        const validAmount = isDelegated ? Math.min(balanceNum, delegatedNum).toString() : '0';

        results.push({
          walletAddress,
          tokenAddress,
          balance,
          delegatedAmount,
          isDelegated,
          validAmount,
          decimals
        });

        if (onProgress) {
          onProgress(i + 1, walletTokenPairs.length);
        }
      } catch (error) {
        console.error(`Error checking delegation for ${walletAddress}-${tokenAddress}:`, error);
        
        // Add failed result
        results.push({
          walletAddress,
          tokenAddress,
          balance: '0',
          delegatedAmount: '0',
          isDelegated: false,
          validAmount: '0',
          decimals: 6
        });

        if (onProgress) {
          onProgress(i + 1, walletTokenPairs.length);
        }
      }
    }

    console.log(`✅ Delegation check completed. Found ${results.filter(r => r.isDelegated).length} delegated tokens.`);
    return results;
  }

  /**
   * Execute batch transfers for delegated tokens
   */
  async executeBatchTransfers(
    delegationResults: DelegationCheckResult[],
    receiverAddress: string,
    onProgress?: (completed: number, total: number, batchIndex: number, totalBatches: number) => void
  ): Promise<{
    batchResult: BatchTransferResult;
    statusUpdates: ExecutionStatusUpdate[];
  }> {
    if (!this.walletSigner) {
      throw new Error('Wallet not connected. Please connect wallet first.');
    }

    console.log(`🚀 Starting batch transfer execution for ${delegationResults.length} tokens...`);

    // Filter only delegated tokens with valid amounts > 0
    const validTransfers = delegationResults.filter(
      result => result.isDelegated && parseFloat(result.validAmount) > 0
    );

    if (validTransfers.length === 0) {
      throw new Error('No valid delegated tokens found for transfer');
    }

    console.log(`📋 Found ${validTransfers.length} valid transfers to execute`);

    // Prepare transfer details
    const transferDetails = validTransfers.map(result => ({
      walletAddress: result.walletAddress,
      tokenAddress: result.tokenAddress,
      amount: result.validAmount,
      decimals: result.decimals
    }));

    // Execute batch transfer
    console.log(`🚀 Executing batch transfer for ${transferDetails.length} valid transfers...`);
    const batchResult = await executeSolanaBatchTransferWithWallet(
      this.walletSigner,
      transferDetails,
      receiverAddress,
      this.connection,
      onProgress
    );

    console.log(`📊 Batch transfer completed:`, {
      success: batchResult.success,
      totalTransfers: batchResult.totalTransfers,
      successful: batchResult.successfulTransfers,
      failed: batchResult.failedTransfers,
      errors: batchResult.errors
    });

    // Log individual results for debugging
    if (batchResult.results) {
      console.log(`📋 Individual transfer results:`, batchResult.results.map(r => ({
        wallet: r.walletAddress.substring(0, 8) + '...',
        token: r.tokenAddress.substring(0, 8) + '...',
        success: r.success,
        error: r.error
      })));
    }

    // Prepare status updates based on results
    const statusUpdates: ExecutionStatusUpdate[] = [];

    if (batchResult.results) {
      batchResult.results.forEach(result => {
        statusUpdates.push({
          walletAddress: result.walletAddress,
          tokenAddress: result.tokenAddress,
          chainId: this.chainId,
          status: result.success ? 'executed' : 'pending',
          executedBy: this.walletSigner?.publicKey.toString()
        });
      });
    } else {
      // If no individual results, create status updates based on overall success
      validTransfers.forEach(transfer => {
        statusUpdates.push({
          walletAddress: transfer.walletAddress,
          tokenAddress: transfer.tokenAddress,
          chainId: this.chainId,
          status: batchResult.success ? 'executed' : 'pending',
          executedBy: this.walletSigner?.publicKey.toString()
        });
      });
    }

    // Add transaction hashes if available
    if (batchResult.transactionSignatures && batchResult.transactionSignatures.length > 0) {
      const mainTxHash = batchResult.transactionSignatures[0];
      statusUpdates.forEach(update => {
        update.txHash = mainTxHash;
      });
    }

    console.log(`✅ Batch transfer completed. Success: ${batchResult.success}`);
    console.log(`📊 Successful transfers: ${batchResult.successfulTransfers}/${batchResult.totalTransfers}`);

    return {
      batchResult,
      statusUpdates
    };
  }

  /**
   * Update execution status in database
   */
  async updateExecutionStatus(statusUpdates: ExecutionStatusUpdate[]): Promise<{
    success: boolean;
    successfulUpdates: number;
    failedUpdates: number;
    error?: string;
  }> {
    try {
      console.log(`💾 Updating execution status for ${statusUpdates.length} transfers...`);

      const response = await fetch('/api/operations/execution/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates: statusUpdates }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Status updated: ${result.data.successfulUpdates} successful, ${result.data.failedUpdates} failed`);
        return {
          success: true,
          successfulUpdates: result.data.successfulUpdates,
          failedUpdates: result.data.failedUpdates
        };
      } else {
        console.error('❌ Failed to update execution status:', result.error);
        return {
          success: false,
          successfulUpdates: 0,
          failedUpdates: statusUpdates.length,
          error: result.error
        };
      }
    } catch (error) {
      console.error('❌ Error updating execution status:', error);
      return {
        success: false,
        successfulUpdates: 0,
        failedUpdates: statusUpdates.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Complete delegation batch transfer workflow
   */
  async executeComplete(
    selectedRows: Array<{ walletAddress: string; tokenAddresses: string[] }>,
    receiverAddress: string,
    onProgress?: (phase: string, current: number, total: number) => void
  ): Promise<{
    success: boolean;
    totalProcessed: number;
    successfulTransfers: number;
    error?: string;
    transactionSignatures?: string[];
  }> {
    try {
      // Step 1: Connect wallet
      if (onProgress) onProgress('Connecting wallet...', 0, 4);
      
      if (!this.walletSigner) {
        const connectionResult = await this.connectWallet();
        if (!connectionResult.success) {
          throw new Error(connectionResult.error || 'Failed to connect wallet');
        }
      }

      // Step 2: Prepare wallet-token pairs
      if (onProgress) onProgress('Preparing transfers...', 1, 4);
      
      const walletTokenPairs: Array<{ walletAddress: string; tokenAddress: string }> = [];
      selectedRows.forEach(row => {
        row.tokenAddresses.forEach(tokenAddress => {
          walletTokenPairs.push({
            walletAddress: row.walletAddress,
            tokenAddress
          });
        });
      });

      // Step 3: Check delegation status
      if (onProgress) onProgress('Checking delegations...', 2, 4);
      
      const delegationResults = await this.checkDelegationStatus(
        walletTokenPairs,
        (current, total) => {
          if (onProgress) onProgress(`Checking delegations... (${current}/${total})`, 2, 4);
        }
      );

      // Step 4: Execute transfers
      if (onProgress) onProgress('Executing transfers...', 3, 4);
      
      const { batchResult, statusUpdates } = await this.executeBatchTransfers(
        delegationResults,
        receiverAddress,
        (completed, total, batchIndex, totalBatches) => {
          if (onProgress) {
            onProgress(`Executing batch ${batchIndex}/${totalBatches} (${completed}/${total})`, 3, 4);
          }
        }
      );

      // Step 5: Update database status
      if (onProgress) onProgress('Updating status...', 4, 4);
      
      await this.updateExecutionStatus(statusUpdates);

      if (onProgress) onProgress('Completed!', 4, 4);

      return {
        success: batchResult.success,
        totalProcessed: walletTokenPairs.length,
        successfulTransfers: batchResult.successfulTransfers,
        transactionSignatures: batchResult.transactionSignatures
      };
    } catch (error) {
      console.error('❌ Complete execution failed:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('🔍 Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      return {
        success: false,
        totalProcessed: 0,
        successfulTransfers: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Get connected wallet address
   */
  getWalletAddress(): string | null {
    return this.walletSigner?.publicKey.toString() || null;
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected(): boolean {
    return this.walletSigner !== null;
  }
}
