import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse } from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/authenticated';

const QUICKNODE_URL = process.env.QUICKNODE_API_URL || 'https://damp-burned-pond.quiknode.pro/fc3af2730b02007adef5b25cda489e45cf5afe4d/';

// Helper to process QN balance responses and adjust for decimals
const processQuickNodeBalance = (balance: any, decimals: number) => {
  // totalBalance is returned as a string
  const rawBalance = balance.totalBalance;
  
  if (!rawBalance) return "0";
  
  // Convert to a proper decimal representation based on token decimals
  const decimalBalance = parseFloat(rawBalance) / (10 ** decimals);
  
  // Return as a string with appropriate precision
  return decimalBalance.toString();
};

// Rate limiter setup - 5 requests per second
const RATE_LIMIT = 5; // requests per second
const queue: (() => Promise<any>)[] = [];
let processing = false;

const processQueue = async () => {
  if (processing) return;
  processing = true;
  
  while (queue.length > 0) {
    const batchSize = Math.min(RATE_LIMIT, queue.length);
    const batch = queue.splice(0, batchSize);
    
    // Execute batch in parallel
    await Promise.all(batch.map(task => task()));
    
    // Wait for rate limit
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second pause
    }
  }
  
  processing = false;
};

// Enqueue a QuickNode request
const enqueueRequest = (fn: () => Promise<any>) => {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
    processQueue();
  });
};

// POST /api/operations/wallet/[address]/balance - Update token balances for a wallet
export const POST = authenticated(3, async (session, request, { params }) => {
  try {
    const { address } = params;
    
    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }
    
    // Find wallet in the database
    const wallet = await prisma.walletAddress.findFirst({
      where: {
        address: {
          equals: address,
          mode: 'insensitive'
        }
      },
      include: {
        allowedTokens: true
      }
    });
    
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    const tokenAddresses = wallet.allowedTokens.map(token => token.address);
    
    if (tokenAddresses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No tokens found for this wallet' },
        { status: 400 }
      );
    }
    
    console.log(`Updating balances for wallet ${address} with ${tokenAddresses.length} tokens`);
    
    // Call QuickNode API to get token balances
    const response = await enqueueRequest(async () => {
      const quicknodeResponse = await fetch(QUICKNODE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'qn_getWalletTokenBalance',
          params: [{
            wallet: address,
            contracts: tokenAddresses
          }]
        })
      });
      
      return quicknodeResponse.json();
    });
    
    // Type check the response
    if (!response || 
        typeof response !== 'object' || 
        !('result' in response) || 
        !response.result || 
        typeof response.result !== 'object' || 
        !('result' in response.result)) {
      console.error('Invalid response from QuickNode:', response);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch token balances from QuickNode' },
        { status: 500 }
      );
    }
    
    // Process QuickNode response
    const tokenResults = response.result.result as any[];
    const tokenBalances = tokenResults.reduce((acc: Record<string, any>, token: any) => {
      const tokenAddress = token.address.toLowerCase();
      
      acc[tokenAddress] = {
        tokenAddress: token.address,
        balance: processQuickNodeBalance(token, parseInt(token.decimals) || 18),
        symbol: token.symbol,
        decimals: token.decimals
      };
      
      return acc;
    }, {});
    
    // Get existing token balances
    const existingBalances = wallet.tokenBalances as Record<string, any> || {};
    
    // Merge with new balances (keeping existing tokens that weren't in the QuickNode response)
    const updatedBalances = {
      ...existingBalances,
      ...tokenBalances
    };
    
    // Update the wallet with new token balances
    await prisma.walletAddress.update({
      where: { id: wallet.id },
      data: { tokenBalances: updatedBalances }
    });
    
    console.log(`Updated ${Object.keys(tokenBalances).length} token balances for wallet ${address}`);
    
    return NextResponse.json({
      success: true,
      data: {
        walletAddress: address,
        updatedTokenCount: Object.keys(tokenBalances).length,
        tokenBalances
      }
    });
  } catch (error) {
    console.error('Error updating token balances:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update token balances' },
      { status: 500 }
    );
  }
});