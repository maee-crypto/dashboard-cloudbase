import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse } from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/authenticated';

// GET /api/operations/tokens/enabled - Get all enabled token addresses
export const GET = authenticated(3, async (session, req) => {
  try {
    const tokens = await prisma.tokenAddress.findMany({
      where: { isEnabled: true },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ 
      success: true, 
      data: tokens 
    });
  } catch (error) {
    console.error('Error fetching enabled tokens:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch enabled tokens' },
      { status: 500 }
    );
  }
});