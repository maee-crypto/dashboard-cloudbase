import { prisma } from '@/lib/services/prisma-service';
import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/authenticated';
import { z } from 'zod';
import { getSPLTokenBalance, getTokenMetadata } from '@/utils/solanaHelper';
import { createSolanaConnection } from '@/utils/solanaWeb';
import { PublicKey } from '@solana/web3.js';

const updateSchema = z.object({
  walletAddress: z.string().min(1)
});

// POST /api/operations/wallet/balance/solana - Update balances for a Solana wallet
export const POST = authenticated(3, async (session, request) => {
  try {
    const body = await request.json();
    const validation = updateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.message }, { status: 400 });
    }
    const { walletAddress } = validation.data;

    // Find wallet in DB
    const wallet = await prisma.walletAddress.findFirst({
      where: {
        address: {
          equals: walletAddress,
          mode: 'insensitive'
        },
        chainId: '507454' // Solana mainnet
      },
      include: { allowedTokens: true }
    });

    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 });
    }

    const tokenAddresses = wallet.allowedTokens.map(t => t.address);
    if (tokenAddresses.length === 0) {
      return NextResponse.json({ success: false, error: 'No tokens found for this wallet' }, { status: 400 });
    }

    // Validate wallet address format
    try {
      new PublicKey(walletAddress);
    } catch (error) {
      return NextResponse.json({ 
        success: false, 
        error: `Invalid wallet address format: ${walletAddress}` 
      }, { status: 400 });
    }

    // Fetch balances for each token
    const connection = createSolanaConnection();
    const balances: Record<string, any> = {};
    const errors: string[] = [];
    let successCount = 0;
    
    for (const tokenAddress of tokenAddresses) {
      try {
        // Validate token address format
        try {
          new PublicKey(tokenAddress);
        } catch (error) {
          errors.push(`Invalid token address format: ${tokenAddress}`);
          continue;
        }

        // Get SPL token balance
        const balanceResult = await getSPLTokenBalance(walletAddress, tokenAddress, connection);
        
        if (balanceResult) {
          // Get token metadata
          let metadata;
          try {
            metadata = await getTokenMetadata(tokenAddress, connection);
          } catch (metadataError) {
            console.warn(`Could not fetch metadata for token ${tokenAddress}:`, metadataError);
            metadata = null;
          }
          
          // Get existing token data to preserve delegation status
          const existingTokenData = (wallet.tokenBalances as Record<string, any> || {})[tokenAddress.toLowerCase()] || {};
          
          balances[tokenAddress.toLowerCase()] = {
            ...existingTokenData, // Preserve existing data including delegation status
            tokenAddress,
            balance: balanceResult.balance,
            symbol: metadata?.symbol || existingTokenData.symbol || 'UNKNOWN',
            decimals: metadata?.decimals || balanceResult.decimals || existingTokenData.decimals || 6
          };
          successCount++;
          console.log(`Successfully fetched balance for ${walletAddress} and token ${tokenAddress}: ${balanceResult.balance}`);
        } else {
          const errorMsg = `Failed to get balance for token: ${tokenAddress}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      } catch (error) {
        console.error(`Error fetching balance for token ${tokenAddress}:`, error);
        errors.push(`Error fetching balance for token ${tokenAddress}: ${error}`);
        // Continue with other tokens even if one fails
      }
    }

    // Merge with existing balances
    const existingBalances = wallet.tokenBalances as Record<string, any> || {};
    const updatedBalances = { ...existingBalances, ...balances };

    // Update DB
    await prisma.walletAddress.update({
      where: { id: wallet.id },
      data: { tokenBalances: updatedBalances }
    });

    return NextResponse.json({
      success: true,
      data: {
        walletAddress,
        updatedTokenCount: Object.keys(balances).length,
        successfulTokens: successCount,
        totalTokens: tokenAddresses.length,
        tokenBalances: balances,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error updating Solana token balances:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update Solana token balances' },
      { status: 500 }
    );
  }
});
