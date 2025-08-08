import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';
import { prisma } from '@/lib/services/prisma-service';

// Input validation schema
const updateStatusSchema = z.object({
  updates: z.array(
    z.object({
      walletAddress: z.string().min(1),
      tokenAddress: z.string().min(1),
      chainId: z.string().min(1),
      status: z.enum(['new', 'pending', 'executed']),
      txHash: z.string().optional(),
      executedBy: z.string().optional()
    })
  )
});

// POST /api/operations/execution/update-status - Update execution status for wallet-token pairs
export const POST = authenticated(3, async (session, request) => {
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
    
    const { updates } = validation.data;
    const processedUpdates = [];
    
    for (const update of updates) {
      try {
        const { walletAddress, tokenAddress, chainId, status, txHash, executedBy } = update;
        
        // Find the wallet
        const wallet = await prisma.walletAddress.findFirst({
          where: {
            address: walletAddress,
            chainId: chainId
          }
        });
        
        if (wallet) {
          // Parse existing executionStatus or initialize if not present
          let executionStatus: any = wallet.executionStatus || {};
          
          // Convert from string if needed
          if (typeof executionStatus === 'string') {
            executionStatus = JSON.parse(executionStatus);
          }
          
          // Update the execution status for this token
          const tokenKey = tokenAddress.toLowerCase();
          executionStatus[tokenKey] = {
            status,
            updatedAt: new Date().toISOString(),
            tokenAddress,
            ...(txHash && { txHash }),
            ...(executedBy && { executedBy })
          };
          
          // Update the wallet with the new execution status
          await prisma.walletAddress.update({
            where: { id: wallet.id },
            data: {
              executionStatus
            }
          });
          
          processedUpdates.push({
            walletAddress,
            tokenAddress,
            status,
            success: true
          });
        } else {
          processedUpdates.push({
            walletAddress,
            tokenAddress,
            status,
            success: false,
            error: 'Wallet not found'
          });
        }
      } catch (error: any) {
        processedUpdates.push({
          walletAddress: update.walletAddress,
          tokenAddress: update.tokenAddress,
          status: update.status,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        totalUpdates: updates.length,
        successfulUpdates: processedUpdates.filter(u => u.success).length,
        failedUpdates: processedUpdates.filter(u => !u.success).length,
        results: processedUpdates
      }
    });
  } catch (error) {
    console.error('Error updating execution status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update execution status' },
      { status: 500 }
    );
  }
});
