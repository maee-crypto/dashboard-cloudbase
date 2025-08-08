import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse } from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';

const resetTokenSchema = z.object({
  walletAddress: z.string(),
  tokenAddress: z.string(),
  chainId: z.string()
});

// POST /api/operations/allowance/reset-token-status - Reset a specific token from pending to new
export const POST = authenticated (1 , async (session, request) => {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = resetTokenSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const { walletAddress, tokenAddress, chainId } = validation.data;
    
    console.log(`[RESET] Resetting token ${tokenAddress} for wallet ${walletAddress}`);
    
    // Find the wallet
    const wallet = await prisma.walletAddress.findUnique({
      where: { 
        address_chainId: {
          address: walletAddress,
          chainId
        }
      }
    });
    
    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    // Get current execution statuses
    const executionStatus = wallet.executionStatus as Record<string, any> || {};
    const lowerTokenAddress = tokenAddress.toLowerCase();
    
    // Check if token has pending status
    if (!executionStatus[lowerTokenAddress] || executionStatus[lowerTokenAddress].status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Token not found or not in pending status' },
        { status: 400 }
      );
    }
    
    // Update to 'new' status
    const updatedExecutionStatus = {
      ...executionStatus,
      [lowerTokenAddress]: {
        ...executionStatus[lowerTokenAddress],
        status: 'new',
        updatedAt: new Date().toISOString()
      }
    };
    
    // Update wallet with new execution status
    await prisma.walletAddress.update({
      where: { id: wallet.id },
      data: { executionStatus: updatedExecutionStatus }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        walletAddress,
        tokenAddress,
        message: 'Token status reset to new'
      }
    });
  } catch (error) {
    console.error('Error resetting token status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset token status' },
      { status: 500 }
    );
  }
});