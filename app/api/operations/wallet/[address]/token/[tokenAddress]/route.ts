import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse } from '@/types/emergency-withdrawal';
import { NextRequest, NextResponse } from 'next/server';
import { authenticated } from '@/lib/authenticated';

// DELETE /api/operations/wallet/[address]/token/[tokenAddress] - Remove a specific token from a wallet
export const DELETE = authenticated (1, async (session, request, { params }) => {
  try {
    const { address, tokenAddress } = params;
    
    if (!address || !tokenAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address and token address are required' },
        { status: 400 }
      );
    }
    
    console.log(`Removing token ${tokenAddress} from wallet ${address}`);
    
    // First, find the wallet by address
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
    
    // Find the token in this wallet
    const tokenToRemove = wallet.allowedTokens.find(
      (token) => token.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    if (!tokenToRemove) {
      return NextResponse.json(
        { success: false, error: 'Token not found in this wallet' },
        { status: 404 }
      );
    }
    
    // Remove the token from the wallet's allowed tokens
    await prisma.walletAddress.update({
      where: { id: wallet.id },
      data: {
        allowedTokens: {
          disconnect: {
            id: tokenToRemove.id
          }
        },
      }
    });
    
    // If wallet has execution status for this token, remove it
    if (wallet.executionStatus) {
      const executionStatus = wallet.executionStatus as Record<string, any>;
      const lowerTokenAddress = tokenAddress.toLowerCase();
      
      if (executionStatus[lowerTokenAddress]) {
        // Remove this token's status from executionStatus
        delete executionStatus[lowerTokenAddress];
        
        // Update the wallet with the modified executionStatus
        await prisma.walletAddress.update({
          where: { id: wallet.id },
          data: { executionStatus }
        });
      }
    }
    
    // We don't need to remove the token from tokenBalances
    // Balance information can be kept for historical purposes
    
    return NextResponse.json({
      success: true,
      data: {
        message: `Token ${tokenAddress} removed from wallet ${address}`
      }
    });
  } catch (error) {
    console.error('Error removing token from wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove token from wallet' },
      { status: 500 }
    );
  }
});