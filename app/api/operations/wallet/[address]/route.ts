import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse } from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/authenticated';

// DELETE /api/operations/wallet/:address - Delete wallet record
export const DELETE = authenticated ( 1 , async (session, request, { params }) => {
  try {
    const walletAddress = params.address;
    
    // Find all records matching the wallet address across chain IDs
    const wallets = await prisma.walletAddress.findMany({
      where: { address: walletAddress }
    });
    
    if (wallets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    // Delete all matching wallets
    await prisma.walletAddress.deleteMany({
      where: { address: walletAddress }
    });
    
    return NextResponse.json({ 
      success: true, 
      data: { 
        message: `Successfully deleted ${wallets.length} wallet record(s)` 
      } 
    });
  } catch (error) {
    console.error('Error deleting wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete wallet' },
      { status: 500 }
    );
  }
});