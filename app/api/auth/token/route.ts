import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

// Schema for API key request
const apiKeyRequestSchema = z.object({
  serviceName: z.string().min(1),
  expiresIn: z.number().default(86400) // Default expiry: 24 hours in seconds
});

// For development only - in production this should be an environment variable
const JWT_SECRET_KEY = "emergency-withdrawal-system-super-secret-key";

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    
    // For debugging purposes, log the session
    console.log("Session:", JSON.stringify(session, null, 2));
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse and validate request body
    const body = await req.json();
    const result = apiKeyRequestSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.message },
        { status: 400 }
      );
    }
    
    const { serviceName, expiresIn } = result.data;
    
    // Create JWT token using the hardcoded secret
    const secretKey = new TextEncoder().encode(JWT_SECRET_KEY);
    const now = Math.floor(Date.now() / 1000);
    
    const token = await new SignJWT({
      serviceName,
      iat: now,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(now + expiresIn)
      .setIssuedAt(now)
      .sign(secretKey);
    
    return NextResponse.json({
      success: true,
      data: {
        token,
        expiresAt: new Date((now + expiresIn) * 1000).toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate token' },
      { status: 500 }
    );
  }
} 