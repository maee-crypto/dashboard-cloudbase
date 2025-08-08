import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse } from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/authenticated';

// DELETE /api/operations/chain/:chainId - Delete all wallets for a specific chain
export const DELETE = authenticated( 1 , async (session, request, { params }) => {
  try {
    const chainId = params.chainId;
    
    // Count records for this chain ID
    const count = await prisma.walletAddress.count({
      where: { chainId }
    });
    
    if (count === 0) {
      return NextResponse.json(
        { success: false, error: 'No wallets found for this chain ID' },
        { status: 404 }
      );
    }
    
    // Delete all wallets for this chain
    await prisma.walletAddress.deleteMany({
      where: { chainId }
    });
    
    return NextResponse.json({ 
      success: true, 
      data: { 
        message: `Successfully deleted ${count} wallet(s) for chain ID ${chainId}` 
      } 
    });
  } catch (error) {
    console.error('Error deleting wallets for chain:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete wallets' },
      { status: 500 }
    );
  }
});