import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/types/emergency-withdrawal';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { prisma } from '@/prisma';

const updateSchema = z.object({
  walletAddresses: z.array(z.string())
});

// POST /api/operations/wallet/balance/bulk - Update balances for multiple wallets
export const POST = authenticated(3, async (session, request) => {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = updateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const { walletAddresses } = validation.data;
    
    if (walletAddresses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No wallet addresses provided' },
        { status: 400 }
      );
    }
    
    // Get the origin from request URL for constructing internal API calls
    const url = new URL(request.url);
    const origin = url.origin;
    
    // Get the session cookie to forward with internal requests
    const serverSession = await getServerSession(authOptions);
    const sessionCookie = request.headers.get('cookie');
    
    // Process each wallet one by one
    const results = [];
    for (const address of walletAddresses) {
      try {
        // Determine chainId for the wallet (fetch from DB or pass as param)
        const wallet = await prisma.walletAddress.findFirst({
          where: { address: { equals: address, mode: 'insensitive' } }
        });
        let endpoint = `${origin}/api/operations/wallet/${address}/balance`;
        let body = undefined;
        let method = 'POST';

        if (wallet && wallet.chainId === '728126428') {
          // Tron wallet: use Tron-specific endpoint
          endpoint = `${origin}/api/operations/wallet/balance/tron`;
          body = JSON.stringify({ walletAddress: address });
        } else if (wallet && wallet.chainId === '507454') {
          // Solana wallet: use Solana-specific endpoint
          endpoint = `${origin}/api/operations/wallet/balance/solana`;
          body = JSON.stringify({ walletAddress: address });
        }

        const response = await fetch(endpoint, {
          method,
          headers: {
            'Cookie': sessionCookie || '',
            'Content-Type': 'application/json'
          },
          ...(body ? { body } : {})
        });

        const result = await response.json();
        results.push({
          walletAddress: address,
          success: result.success,
          data: result.data,
          error: result.error
        });
      } catch (error) {
        console.error(`Error updating wallet ${address}:`, error);
        results.push({
          walletAddress: address,
          success: false,
          error: 'Failed to update wallet balances'
        });
      }
    }
    
    // Count successes and failures
    const successes = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success).length;
    
    console.log(`Bulk update completed: ${successes} succeeded, ${failures} failed`);
    
    return NextResponse.json({
      success: true,
      data: {
        updatedCount: successes,
        failedCount: failures,
        results
      }
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process bulk update' },
      { status: 500 }
    );
  }
});