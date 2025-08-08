import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse, UpdateAllowanceDto } from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateAllowanceSchema = z.object({
  walletAddress: z.string().min(1),
  chainId: z.string().min(1),
  tokenAddress: z.string().min(1),
  isAllowed: z.boolean()
});

// POST /api/operations/extension/update-allowance - Update token allowances for a wallet
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
    const validation = updateAllowanceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const { walletAddress, chainId, tokenAddress, isAllowed } = validation.data as UpdateAllowanceDto;
    
    // Check if token exists
    const token = await prisma.tokenAddress.findFirst({
      where: {
        address: tokenAddress,
        chainId
      }
    });
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }
    
    // Find or create wallet
    let wallet = await prisma.walletAddress.findUnique({
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
    
    if (!wallet) {
      // Create new wallet if it doesn't exist
      wallet = await prisma.walletAddress.create({
        data: {
          address: walletAddress,
          chainId
        },
        include: {
          allowedTokens: true
        }
      });
    }
    
    // Update the relationship based on isAllowed
    if (isAllowed) {
      // Check if already allowed to avoid duplicate
      const isAlreadyAllowed = wallet.allowedTokens.some((t: { id: string }) => t.id === token.id);
      
      if (!isAlreadyAllowed) {
        // Add token to allowed list
        await prisma.walletAddress.update({
          where: { id: wallet.id },
          data: {
            allowedTokens: {
              connect: { id: token.id }
            },
            // Set default execution status for this token to 'new'
            executionStatus: {
              ...(wallet.executionStatus as object || {}),
              [tokenAddress.toLowerCase()]: {
                status: 'new',
                updatedAt: new Date().toISOString()
              }
            }
          }
        });
      }
    } else {
      // Remove token from allowed list
      await prisma.walletAddress.update({
        where: { id: wallet.id },
        data: {
          allowedTokens: {
            disconnect: { id: token.id }
          }
        }
      });
    }
    
    // Get updated wallet data
    const updatedWallet = await prisma.walletAddress.findUnique({
      where: { id: wallet.id },
      include: {
        allowedTokens: true
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      data: {
        walletAddress: updatedWallet?.address,
        chainId: updatedWallet?.chainId,
        allowedTokens: updatedWallet?.allowedTokens.map((t: { address: string }) => t.address) || []
      }
    });
  } catch (error) {
    console.error('Error updating allowance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update allowance' },
      { status: 500 }
    );
  }
}
