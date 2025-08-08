import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/services/prisma-service';
import { authenticated } from '@/lib/authenticated';

// PATCH /api/tokens/:id - Revoke a token
export const PATCH = authenticated(1, async (session, req, { params }) => {
  try {
    const id = params.id;
    
    // Find the token
    const token = await prisma.apiToken.findUnique({
      where: { id }
    });
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }
    
    // Check if the user owns this token
    if (token.createdBy !== session.user.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not own this token' },
        { status: 403 }
      );
    }
    
    // Revoke the token
    const updatedToken = await prisma.apiToken.update({
      where: { id },
      data: { isRevoked: true }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        id: updatedToken.id,
        isRevoked: updatedToken.isRevoked
      }
    });
  } catch (error) {
    console.error('Error revoking token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke token' },
      { status: 500 }
    );
  }
});

// DELETE /api/tokens/:id - Delete a token
export const DELETE = authenticated(1, async (session, req, { params }) => {
  try {
    const id = params.id;
    
    // Find the token
    const token = await prisma.apiToken.findUnique({
      where: { id }
    });
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }
    
    // Check if the user owns this token
    if (token.createdBy !== session.user.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not own this token' },
        { status: 403 }
      );
    }
    
    // Delete the token
    await prisma.apiToken.delete({
      where: { id }
    });
    
    return NextResponse.json({
      success: true,
      data: { message: 'Token deleted successfully' }
    });
  } catch (error) {
    console.error('Error deleting token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete token' },
      { status: 500 }
    );
  }
});