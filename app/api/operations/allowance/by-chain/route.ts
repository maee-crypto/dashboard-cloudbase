import { prisma } from '@/lib/services/prisma-service';
import { 
  AllowedTokensByChainDto, 
  ApiResponse, 
  WalletTokensResponse 
} from '@/types/emergency-withdrawal';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';

const allowedByChainSchema = z.object({
  chainId: z.string().min(1)
});

// POST /api/operations/allowance/by-chain - Get wallets with allowed tokens for a specific chain
export const POST = authenticated(3, async (session, request: Request) => {
  // Convert Request to NextRequest for compatibility
  const nextRequest = request as unknown as NextRequest;
  try {
    const body = await nextRequest.json();
    
    // Validate input
    const validation = allowedByChainSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const { chainId } = validation.data as AllowedTokensByChainDto;
    
    // Find all wallets for this chain with their allowed tokens
    const wallets = await prisma.walletAddress.findMany({
      where: { chainId },
      include: {
        allowedTokens: true
      }
    });
    
    // Format the response
    const results: WalletTokensResponse[] = wallets.map((wallet) => ({
      walletAddress: wallet.address,
      allowedTokens: wallet.allowedTokens.map((token) => token.address)
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: results 
    });
  } catch (error) {
    console.error('Error fetching allowed tokens by chain:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch allowed tokens by chain' },
      { status: 500 }
    );
  }
});