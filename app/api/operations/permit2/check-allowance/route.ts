import { prisma } from '@/lib/services/prisma-service';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ethers } from 'ethers';
import { authenticated } from '@/lib/authenticated';

// Permit2 ABI - only the allowance function
const PERMIT2_ABI = [
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)'
];

// Input validation schema
const checkAllowanceSchema = z.object({
  items: z.array(
    z.object({
      walletAddress: z.string().min(1),
      tokenAddress: z.string().min(1),
      spenderAddress: z.string().min(1)
    })
  )
});

// POST /api/operations/permit2/check-allowance - Check allowances for tokens using Permit2
export const POST = authenticated(3, async (session, request) => {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = checkAllowanceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const { items } = validation.data;
    
    // Set up provider for querying the blockchain
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'https://eth.llamarpc.com');
    
    // Process each item
    const processedItems = [];
    
    for (const item of items) {
      try {
        const { walletAddress, tokenAddress, spenderAddress } = item;
        
        // Create Permit2 contract instance using the proper address
        const permit2Address = "0x000000000022d473030f116ddee9f6b43ac78ba3"; // Official Uniswap Permit2 contract
        
        // Ensure addresses are properly checksummed
        const checksummedWallet = ethers.getAddress(walletAddress);
        const checksummedToken = ethers.getAddress(tokenAddress);
        const checksummedSpender = ethers.getAddress(spenderAddress);
        
        let permit2Contract;
        try {
          permit2Contract = new ethers.Contract(permit2Address, PERMIT2_ABI, provider);
        } catch (error: any) {
          throw new Error(`Failed to create Permit2 contract instance: ${error.message}`);
        }
        
        // Query Permit2 allowance with proper parameter order
        let rawAllowance;
        try {
          rawAllowance = await permit2Contract.allowance(checksummedWallet, checksummedToken, checksummedSpender);
        } catch (error: any) {
          throw new Error(`Failed to query Permit2 allowance: ${error.message}`);
        }
        
        // Extract structured data from allowance - ensuring we handle the values safely
        let allowanceAmount = "0";
        let expiration = 0;
        let nonce = 0;
        
        try {
          if (rawAllowance && typeof rawAllowance === 'object') {
            // Make sure to handle decimals properly by just storing the raw value
            allowanceAmount = rawAllowance.amount ? rawAllowance.amount.toString() : "0";
            expiration = rawAllowance.expiration ? Number(rawAllowance.expiration) : 0;
            nonce = rawAllowance.nonce ? Number(rawAllowance.nonce) : 0;
          }
        } catch (error) {
          console.error("Error parsing allowance data:", error);
        }
        
        // Determine if approved (any amount > 0 counts as approved for our UI purposes)
        const isApproved = BigInt(allowanceAmount) > BigInt(0);
        
        // Format expiration date for UI
        const expirationDate = new Date(expiration * 1000);
        
        // Update the database with the allowance information
        const wallet = await prisma.walletAddress.findFirst({
          where: {
            address: walletAddress,
            chainId: "1" // Assuming Ethereum mainnet
          }
        });
        
        if (wallet) {
          // Parse existing tokenBalances or initialize if not present
          let tokenBalances: any = wallet.tokenBalances || {};
          
          // Convert from string if needed
          if (typeof tokenBalances === 'string') {
            tokenBalances = JSON.parse(tokenBalances);
          }
          
          // Update the token balance with approval information
          tokenBalances[tokenAddress] = {
            ...(tokenBalances[tokenAddress] || {}),
            isApproved,
            tokenAddress,
            approvalNonce: nonce,
            approvalAmount: allowanceAmount,
            approvalExpiration: expiration
          };
          
          // Update the wallet with the new token balances
          await prisma.walletAddress.update({
            where: { id: wallet.id },
            data: {
              tokenBalances
            }
          });
        }
        
        // Add to processed items
        processedItems.push({
          ...item,
          isApproved,
          allowanceAmount,
          expiration,
          expirationDate: expirationDate.toISOString(),
          nonce,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        processedItems.push({
          ...item,
          isApproved: false,
          error: `Failed to check allowance: ${error.message || 'Unknown error'}`
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        totalProcessed: processedItems.length,
        items: processedItems
      }
    });
  } catch (error: any) {
    console.error('Error checking allowances:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check allowances' },
      { status: 500 }
    );
  }
});