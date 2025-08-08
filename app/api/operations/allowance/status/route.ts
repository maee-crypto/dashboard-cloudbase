import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse } from '@/types/emergency-withdrawal';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';

const updateStatusSchema = z.object({
  wallets: z.array(z.object({
    walletAddress: z.string(),
    chainId: z.string(),
    tokenAddress: z.string()
  })),
  status: z.enum(['new', 'pending', 'executed']),
  executedBy: z.string().optional()
});

// POST /api/operations/allowance/status - Update execution status for wallets
// Only allow 'admin' role to access this endpoint
export const POST = authenticated (1, async (session, request) => {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = updateStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const { wallets, status, executedBy } = validation.data;
    
    if (wallets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No wallets specified' },
        { status: 400 }
      );
    }
    
    console.log(`[STATUS] Updating ${wallets.length} wallets to status: ${status}`);
    
    // Process each wallet
    const results = await Promise.all(
      wallets.map(async ({ walletAddress, chainId, tokenAddress }) => {
        try {
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
            return {
              walletAddress,
              tokenAddress,
              success: false,
              error: 'Wallet not found'
            };
          }
          
          // Get current execution statuses
          const executionStatus = wallet.executionStatus as Record<string, any> || {};
          
          // Create updated execution status object
          const updatedExecutionStatus = {
            ...executionStatus,
            [tokenAddress.toLowerCase()]: {
              status,
              updatedAt: new Date().toISOString(),
              ...(executedBy && { executedBy }),
              ...(status === 'executed' && { txHash: `exec-${Date.now().toString(36)}` })
            }
          };
          
          // Update wallet with new execution status
          await prisma.walletAddress.update({
            where: { id: wallet.id },
            data: { executionStatus: updatedExecutionStatus }
          });
          
          return {
            walletAddress,
            tokenAddress,
            success: true,
            status
          };
        } catch (error) {
          console.error(`Error updating status for wallet ${walletAddress}:`, error);
          return {
            walletAddress,
            tokenAddress,
            success: false,
            error: 'Failed to update status'
          };
        }
      })
    );
    
    // Count successful updates
    const successCount = results.filter(r => r.success).length;
    
    return NextResponse.json({
      success: true,
      data: {
        results,
        totalWallets: wallets.length,
        successfulUpdates: successCount,
        failedUpdates: wallets.length - successCount
      }
    });
  } catch (error) {
    console.error('Error updating wallet statuses:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update wallet statuses' },
      { status: 500 }
    );
  }
});