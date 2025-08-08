import { prisma } from '@/lib/services/prisma-service';
import { 
  AllowedTokenResponse, 
  ApiResponse, 
  CheckAllowedTokensDto 
} from '@/types/emergency-withdrawal';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';

const checkAllowedSchema = z.object({
  walletAddresses: z.array(
    z.object({
      address: z.string().min(1),
      chainId: z.string().min(1)
    })
  )
});

// POST /api/operations/allowance/check - Check which tokens are allowed for given wallets
export const POST = authenticated(3, async (session, request: Request) => {
  // Convert Request to NextRequest for compatibility
  const nextRequest = request as unknown as NextRequest;
  try {
    const body = await nextRequest.json();
    
    // Validate input
    const validation = checkAllowedSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const { walletAddresses } = validation.data as CheckAllowedTokensDto;
    
    // Build the response by checking each wallet's allowed tokens
    const results: AllowedTokenResponse[] = [];
    
    for (const { address, chainId } of walletAddresses) {
      // Find wallet with its allowed tokens
      const wallet = await prisma.walletAddress.findUnique({
        where: { 
          address_chainId: {
            address,
            chainId
          }
        },
        include: {
          allowedTokens: true
        }
      });
      
      if (wallet) {
        // Add each token to the results with isAllowed=true
        wallet.allowedTokens.forEach((token) => {
          results.push({
            walletAddress: address,
            tokenAddress: token.address,
            isAllowed: true
          });
        });
      }
      
      // Get all tokens for this chain
      const allChainTokens = await prisma.tokenAddress.findMany({
        where: { chainId }
      });
      
      // Add tokens not in the allowed list with isAllowed=false
      const allowedTokenAddresses = wallet?.allowedTokens.map((t) => t.address) || [];
      
      allChainTokens.forEach((token) => {
        if (!allowedTokenAddresses.includes(token.address)) {
          results.push({
            walletAddress: address,
            tokenAddress: token.address,
            isAllowed: false
          });
        }
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      data: results 
    });
  } catch (error) {
    console.error('Error checking allowed tokens:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check allowed tokens' },
      { status: 500 }
    );
  }
});