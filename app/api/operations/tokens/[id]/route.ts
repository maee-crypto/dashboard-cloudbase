import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse, UpdateTokenAddressDto } from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';

const updateTokenSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  chainId: z.string().min(1).optional(),
  isEnabled: z.boolean().optional(),
  description: z.string().optional()
});

// GET /api/operations/tokens/:id - Get token address by id
export const GET = authenticated(3, async (session, request, { params }) => {
  try {
    const id = params.id;
    
    const token = await prisma.tokenAddress.findUnique({
      where: { id }
    });
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data: token 
    });
  } catch (error) {
    console.error('Error fetching token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch token' },
      { status: 500 }
    );
  }
});

// PATCH /api/operations/tokens/:id - Update token address
export const PATCH = authenticated(1, async (session, request, { params }) => {
  try {
    const id = params.id;
    const body = await request.json();
    
    // Validate input
    const validation = updateTokenSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const data = validation.data as UpdateTokenAddressDto;
    
    // Check if token exists
    const existingToken = await prisma.tokenAddress.findUnique({
      where: { id }
    });
    
    if (!existingToken) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }
    
    // Update token
    const updatedToken = await prisma.tokenAddress.update({
      where: { id },
      data
    });
    
    return NextResponse.json({ 
      success: true, 
      data: updatedToken 
    });
  } catch (error) {
    console.error('Error updating token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update token' },
      { status: 500 }
    );
  }
});

// DELETE /api/operations/tokens/:id - Delete token address
export const DELETE = authenticated(1, async (session, request, { params }) => {
  try {
    const id = params.id;
    
    // Check if token exists
    const existingToken = await prisma.tokenAddress.findUnique({
      where: { id }
    });
    
    if (!existingToken) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }
    
    // Delete token
    await prisma.tokenAddress.delete({
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