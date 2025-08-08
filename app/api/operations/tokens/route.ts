import { prisma } from '@/lib/services/prisma-service';
import { 
  ApiResponse,
  CreateTokenAddressDto
} from '@/types/emergency-withdrawal';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';

// Validation schema
const createTokenSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  chainId: z.string().min(1),
  description: z.string().optional()
});

// GET /api/operations/tokens - Get all token addresses
export const GET = authenticated(3, async (session, req) => {
  try {
    const tokens = await prisma.tokenAddress.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ 
      success: true, 
      data: tokens 
    });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
});

// POST /api/operations/tokens - Create new token address
export const POST = authenticated(1, async (session, req) => {
  try {
    const body = await req.json();
    
    // Validate input
    const validation = createTokenSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const data = validation.data as CreateTokenAddressDto;
    
    // Create token
    const token = await prisma.tokenAddress.create({
      data: {
        name: data.name,
        address: data.address,
        chainId: data.chainId,
        description: data.description
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      data: token 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create token' },
      { status: 500 }
    );
  }
});