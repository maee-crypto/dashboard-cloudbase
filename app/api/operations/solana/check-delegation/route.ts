import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';
import { checkTokenDelegation } from '@/utils/solanaHelper';
import { prisma } from '@/lib/services/prisma-service';

// Input validation schema
const checkDelegationSchema = z.object({
  items: z.array(
    z.object({
      walletAddress: z.string().min(1),
      tokenAddress: z.string().min(1),
      delegateAddress: z.string().min(1)
    })
  )
});

// POST /api/operations/solana/check-delegation - Check delegation status for Solana SPL tokens
export const POST = authenticated(3, async (session, request) => {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = checkDelegationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const { items } = validation.data;
    
    // Process each item
    const processedItems = [];
    
    for (const item of items) {
      try {
        const { walletAddress, tokenAddress, delegateAddress } = item;
        
        // Check delegation status using Solana helper
        const delegationResult = await checkTokenDelegation(
          walletAddress,
          tokenAddress,
          delegateAddress
        );
        
        if (delegationResult) {
          const { isDelegated, delegatedAmount } = delegationResult;
          
          // Update the database with the delegation information
          const wallet = await prisma.walletAddress.findFirst({
            where: {
              address: walletAddress,
              chainId: "507454" // Solana chainId
            }
          });
          
          if (wallet) {
            // Parse existing tokenBalances or initialize if not present
            let tokenBalances: any = wallet.tokenBalances || {};
            
            // Convert from string if needed
            if (typeof tokenBalances === 'string') {
              tokenBalances = JSON.parse(tokenBalances);
            }
            
            // Update the token balance with delegation information
            // Also set isApproved for UI consistency (delegation = approval in Solana)
            tokenBalances[tokenAddress.toLowerCase()] = {
              ...(tokenBalances[tokenAddress.toLowerCase()] || {}),
              isDelegated,
              isApproved: isDelegated, // Set isApproved = isDelegated for UI consistency
              tokenAddress,
              delegatedAmount,
              delegateAddress: isDelegated ? delegateAddress : null,
              // Keep existing balance info if available
              balance: tokenBalances[tokenAddress.toLowerCase()]?.balance || '0',
              symbol: tokenBalances[tokenAddress.toLowerCase()]?.symbol || 'UNKNOWN',
              decimals: tokenBalances[tokenAddress.toLowerCase()]?.decimals || 6
            };
            
            // Update the wallet with the new token balances
            await prisma.walletAddress.update({
              where: { id: wallet.id },
              data: {
                tokenBalances
              }
            });
            
            console.log(`✅ Updated delegation status for wallet ${walletAddress}, token ${tokenAddress}: isDelegated=${isDelegated}, isApproved=${isDelegated}`);
          }
          
          // Add to processed items
          processedItems.push({
            ...item,
            isDelegated,
            isApproved: isDelegated, // Add isApproved for consistency
            delegatedAmount,
            timestamp: new Date().toISOString()
          });
        } else {
          processedItems.push({
            ...item,
            isDelegated: false,
            isApproved: false, // Add isApproved for consistency
            delegatedAmount: '0',
            error: 'Failed to check delegation status'
          });
        }
      } catch (error: any) {
        processedItems.push({
          ...item,
          isDelegated: false,
          isApproved: false, // Add isApproved for consistency
          delegatedAmount: '0',
          error: `Failed to check delegation: ${error.message || 'Unknown error'}`
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        processedItems,
        totalProcessed: processedItems.length,
        message: `Processed ${processedItems.length} delegation checks`
      }
    });
  } catch (error) {
    console.error('Error checking Solana delegations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check delegations' },
      { status: 500 }
    );
  }
});
