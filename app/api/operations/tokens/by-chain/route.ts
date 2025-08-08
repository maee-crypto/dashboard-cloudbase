import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse, FindByChainDto } from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';

const findByChainSchema = z.object({
  chainId: z.string().min(1)
});

// POST /api/operations/tokens/by-chain - Get tokens by chain ID
export const POST = authenticated(3, async (session, request) => {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = findByChainSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const { chainId } = validation.data as FindByChainDto;
    
    const tokens = await prisma.tokenAddress.findMany({
      where: { chainId },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ 
      success: true, 
      data: tokens 
    });
  } catch (error) {
    console.error('Error fetching tokens by chain:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tokens by chain' },
      { status: 500 }
    );
  }
});