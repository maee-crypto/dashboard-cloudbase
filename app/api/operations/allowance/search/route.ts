import { prisma } from '@/lib/services/prisma-service';
import { ApiResponse } from '@/types/emergency-withdrawal';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticated } from '@/lib/authenticated';

const searchSchema = z.object({
  chainId: z.string().min(1),
  walletAddress: z.string().optional(),
  tokenAddress: z.string().optional(),
  executionFilter: z.enum(['new', 'pending', 'executed', 'all']).optional().default('all'),
  minBalance: z.string().optional(),
  maxBalance: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().optional().default(1),
  pageSize: z.number().optional().default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

// POST /api/operations/allowance/search - Search wallets with filtering
export const POST = authenticated(3, async (session, request: Request) => {
  // Convert Request to NextRequest for compatibility
  const nextRequest = request as unknown as NextRequest;
  try {
    const body = await nextRequest.json();
    
    // Validate input
    const validation = searchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.message },
        { status: 400 }
      );
    }
    
    const params = validation.data;
    const { 
      chainId, 
      walletAddress, 
      tokenAddress, 
      executionFilter, 
      minBalance, 
      maxBalance, 
      startDate, 
      endDate, 
      page = 1, 
      pageSize = 10,
      sortBy,
      sortOrder
    } = params;
    
    // console.log('[SEARCH] Search params:', JSON.stringify(params, null, 2));
    
    // Start building the where clause for initial wallet query
    let where: any = { chainId };
    
    // Filter by wallet address if provided
    if (walletAddress) {
      where.address = {
        contains: walletAddress,
        mode: 'insensitive'
      };
    }
    
    // Filter by token address if provided (this will be applied in the flattening step too)
    if (tokenAddress) {
      where.allowedTokens = {
        some: {
          address: {
            equals: tokenAddress
          }
        }
      };
    }
    
    // Filter by creation date range if provided
    if (startDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        gte: new Date(startDate)
      };
    }
    
    if (endDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        lte: new Date(endDate)
      };
    }
    
    // Fetch all matching wallets but without pagination for flattening step
    // We'll apply pagination after flattening
    const wallets = await prisma.walletAddress.findMany({
      where,
      include: {
        allowedTokens: true
      },
      orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' }
    });
    
    // Flatten the results - create one entry per wallet-token pair
    let flattenedResults: any[] = [];
    
    wallets.forEach(wallet => {
      const executionStatusMap = wallet.executionStatus as Record<string, any> || {};
      const tokenBalancesMap = wallet.tokenBalances as Record<string, any> || {};
      
      // Process each token for this wallet
      wallet.allowedTokens.forEach(token => {
        const tokenAddress = token.address;
        const lowerTokenAddress = tokenAddress.toLowerCase();
        
        // Get execution status for this token
        const status = executionStatusMap[lowerTokenAddress];
        const executionStatus = {
          tokenAddress,
          status: status?.status || 'new',
          updatedAt: status?.updatedAt || wallet.createdAt.toISOString(),
          txHash: status?.txHash,
          executedBy: status?.executedBy
        };
        
        // Get balance for this token
        const balance = tokenBalancesMap[lowerTokenAddress];
        const tokenBalance = {
          tokenAddress,
          balance: balance?.balance || '0',
          symbol: balance?.symbol,
          decimals: balance?.decimals,
          isApproved: balance?.isApproved || false,
          approvalAmount: balance?.approvalAmount,
          approvalExpiration: balance?.approvalExpiration,
          approvalNonce: balance?.approvalNonce
        };
        
        // Skip this token if it doesn't match execution filter
        if (executionFilter && executionFilter !== 'all') {
          const tokenStatus = executionStatus.status;
          if (tokenStatus !== executionFilter && !(executionFilter === 'new' && !status)) {
            return; // Skip this token
          }
        }
        
        // Skip this token if it doesn't match balance filters
        if (minBalance || maxBalance) {
          const balanceValue = parseFloat(tokenBalance.balance);
          if (minBalance && balanceValue < parseFloat(minBalance)) return;
          if (maxBalance && balanceValue > parseFloat(maxBalance)) return;
        }
        
        // Add this wallet-token pair to the flattened results
        flattenedResults.push({
          id: `${wallet.id}-${tokenAddress}`,
          walletAddress: wallet.address,
          chainId: wallet.chainId,
          createdAt: wallet.createdAt,
          tokenAddress,
          allowedTokens: [tokenAddress],
          tokenAddresses: [tokenAddress],
          executionStatus: [executionStatus],
          tokenBalances: [tokenBalance]
        });
      });
    });
    
    // Calculate total count of flattened results for pagination
    const totalCount = flattenedResults.length;
    
    // Apply pagination to the flattened results
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = flattenedResults.slice(startIndex, endIndex);
    
    // Calculate total pages based on the flattened results
    const totalPages = Math.ceil(totalCount / pageSize);
    
    console.log(`[SEARCH] Found ${totalCount} wallet-token pairs, returning page ${page} with ${paginatedResults.length} results`);
    
    return NextResponse.json({
      success: true,
      data: {
        results: paginatedResults,
        total: totalCount,
        page,
        pageSize,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error searching wallets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search wallets' },
      { status: 500 }
    );
  }
});