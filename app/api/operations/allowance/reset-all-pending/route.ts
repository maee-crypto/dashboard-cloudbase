import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse } from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';

const resetAllPendingSchema = z.object({
  chainId: z.string()
});

// POST /api/operations/allowance/reset-all-pending - Reset all pending tokens to new status
export const POST = authenticated (1 , async (session, request) => {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = resetAllPendingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const { chainId } = validation.data;
    
    if (!chainId) {
      return NextResponse.json(
        { success: false, error: 'Chain ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`[RESET] Resetting all pending tokens for chain ${chainId}`);
    
    // Find all wallets for this chain
    const wallets = await prisma.walletAddress.findMany({
      where: { 
        chainId
      }
    });
    
    if (wallets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No wallets found for this chain ID' },
        { status: 404 }
      );
    }
    
    // Track which wallets were updated
    const updatedWallets = [];
    let totalResetCount = 0;
    
    // Process each wallet
    for (const wallet of wallets) {
      const executionStatus = wallet.executionStatus as Record<string, any> || {};
      let walletUpdated = false;
      let walletResetCount = 0;
      
      // Check each token in the execution status
      for (const [tokenAddress, status] of Object.entries(executionStatus)) {
        // Only reset tokens with 'pending' status
        if (status && status.status === 'pending') {
          // Update to 'new' status
          executionStatus[tokenAddress] = {
            ...status,
            status: 'new',
            updatedAt: new Date().toISOString()
          };
          walletUpdated = true;
          walletResetCount++;
        }
      }
      
      // If this wallet had pending tokens, update it
      if (walletUpdated) {
        await prisma.walletAddress.update({
          where: { id: wallet.id },
          data: { executionStatus }
        });
        
        updatedWallets.push({
          walletAddress: wallet.address,
          resetCount: walletResetCount
        });
        
        totalResetCount += walletResetCount;
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        message: `Reset ${totalResetCount} pending tokens to new status`,
        totalReset: totalResetCount,
        updatedWallets
      }
    });
  } catch (error) {
    console.error('Error resetting pending tokens:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset pending tokens' },
      { status: 500 }
    );
  }
});