import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse } from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/authenticated';

// PATCH /api/operations/tokens/:id/toggle - Toggle token status (enabled/disabled)
export const PATCH = authenticated(1, async (session, request, { params }) => {
  try {
    const id = params.id;
    
    // Check if token exists
    const token = await prisma.tokenAddress.findUnique({
      where: { id }
    });
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }
    
    // Toggle isEnabled status
    const updatedToken = await prisma.tokenAddress.update({
      where: { id },
      data: { isEnabled: !token.isEnabled }
    });
    
    return NextResponse.json({ 
      success: true, 
      data: updatedToken 
    });
  } catch (error) {
    console.error('Error toggling token status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle token status' },
      { status: 500 }
    );
  }
});