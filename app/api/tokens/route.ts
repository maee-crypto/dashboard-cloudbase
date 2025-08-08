import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SignJWT } from 'jose';
import { prisma } from '@/lib/services/prisma-service';
import crypto from 'crypto';
import { authenticated } from '@/lib/authenticated';

// Schema for creating API tokens
const createTokenSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  expiresIn: z.number().default(86400), // Default 24 hours in seconds
  description: z.string().optional()
});

// GET /api/tokens - Get all tokens for the current user
export const GET = authenticated(3, async (session, req) => {
  try {
    // Get tokens created by this user, exclude token hash from results
    const tokens = await prisma.apiToken.findMany({
      where: { createdBy: session.user.email },
      select: {
        id: true,
        name: true,
        expiresAt: true,
        lastUsed: true,
        isRevoked: true,
        createdAt: true,
        updatedAt: true,
        description: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ success: true, data: tokens });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
});

// POST /api/tokens - Create a new API token
export const POST = authenticated(1, async (session, req) => {
  try {
    // Parse request body
    const body = await req.json();
    const result = createTokenSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.message },
        { status: 400 }
      );
    }
    
    const { name, expiresIn, description } = result.data;
    
    // Generate a secure random token ID
    const tokenId = crypto.randomBytes(32).toString('hex');
    
    // Create JWT token
    const now = Math.floor(Date.now() / 1000);
    const expiryTime = now + expiresIn;
    const expiryDate = new Date(expiryTime * 1000);
    
    // Use environment variable for JWT secret
    const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'emergency-withdrawal-system-super-secret-key');
    
    const token = await new SignJWT({
      sub: tokenId,
      iat: now
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(expiryTime)
      .setIssuedAt(now)
      .sign(JWT_SECRET);
    
    // Store token in database (store tokenId which is used to identify this token)
    await prisma.apiToken.create({
      data: {
        name,
        token: tokenId, // Store the token ID (not the actual JWT)
        expiresAt: expiryDate,
        createdBy: session.user.email,
        description
      }
    });
    
    // Return the full token to the client (this is the only time it will be shown)
    return NextResponse.json({
      success: true,
      data: {
        token,
        expiresAt: expiryDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create token' },
      { status: 500 }
    );
  }
});