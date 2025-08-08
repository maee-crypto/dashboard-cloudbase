import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse, CheckAllowanceDto } from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const checkAllowanceSchema = z.object({
  walletAddress: z.string().min(1),
  chainId: z.string().min(1),
  tokenAddresses: z.array(z.string().min(1))
});

// POST /api/operations/extension/check-allowance - Check if a wallet has allowance for specific tokens
export async function POST(request: Request) {
  try {
    // Validate token from the middleware
    const tokenId = request.headers.get('X-Token-ID');
    
    // API requires a token ID
    if (!tokenId) {
      return NextResponse.json(
        { success: false, error: 'API token required' },
        { status: 401 }
      );
    }
    
    try {
      // Verify token exists and is not revoked
      const token = await prisma.apiToken.findFirst({
        where: {
          token: tokenId,
          isRevoked: false,
          expiresAt: {
            gt: new Date()
          }
        }
      });
      
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Token is revoked or expired' },
          { status: 401 }
        );
      }
      
      // Update last used time
      await prisma.apiToken.update({
        where: { id: token.id },
        data: { lastUsed: new Date() }
      });
    } catch (error) {
      console.error('Error validating token:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to validate token' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Validate input
    const validation = checkAllowanceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const { walletAddress, chainId, tokenAddresses } = validation.data as CheckAllowanceDto;
    
    // Find wallet with its allowed tokens
    const wallet = await prisma.walletAddress.findUnique({
      where: { 
        address_chainId: {
          address: walletAddress,
          chainId
        }
      },
      include: {
        allowedTokens: true
      }
    });
    
    // Build the response
    const results = tokenAddresses.map(tokenAddress => {
      const isAllowed = wallet?.allowedTokens.some(token => token.address === tokenAddress) || false;
      return {
        tokenAddress,
        isAllowed
      };
    });
    
    return NextResponse.json({ 
      success: true, 
      data: results 
    });
  } catch (error) {
    console.error('Error checking allowance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check allowance' },
      { status: 500 }
    );
  }
}
