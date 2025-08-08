import { prisma } from '@/lib/services/prisma-service';
import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/authenticated';
import { z } from 'zod';

const TRONGRID_API = 'https://api.trongrid.io';

const updateSchema = z.object({
  walletAddress: z.string().min(1)
});

// Helper to fetch TRC20 token balance from TronGrid
async function fetchTrc20Balance(wallet: string, token: string, tronApiKey?: string) {
  // Fetch account tokens (TRC20 balances)
  const url = `${TRONGRID_API}/v1/accounts/${wallet}`;
  const headers: Record<string, string> = {};
  if (tronApiKey) headers['TRON-PRO-API-KEY'] = tronApiKey;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  if (!data || !data.data || !Array.isArray(data.data) || !data.data[0]) return null;

  // The trc20 field is an array of objects: [{ "contractAddress": "balance", ... }]
  const trc20Array = data.data[0].trc20;
  if (!Array.isArray(trc20Array)) return null;

  let balanceStr: string | undefined;
  for (const entry of trc20Array) {
    if (entry[token]) {
      balanceStr = entry[token];
      break;
    }
    // Try lowercase/uppercase variants
    const lowerToken = token.toLowerCase();
    for (const key of Object.keys(entry)) {
      if (key.toLowerCase() === lowerToken) {
        balanceStr = entry[key];
        break;
      }
    }
    if (balanceStr) break;
  }
  if (!balanceStr) return null;

  // Fetch token metadata (symbol, decimals)
  let symbol = '';
  let decimals = 6;
  try {
    const metaUrl = `${TRONGRID_API}/v1/contracts/${token}`;
    const metaResp = await fetch(metaUrl, { headers });
    const metaData = await metaResp.json();
    if (metaData && metaData.data && metaData.data[0]) {
      symbol = metaData.data[0].token_abbr || '';
      decimals = Number(metaData.data[0].decimals) || 6;
    }
  } catch (e) {
    // fallback
  }

  // Convert balance to human-readable
  const balance = (parseFloat(balanceStr) / Math.pow(10, decimals)).toString();

  return {
    balance,
    symbol,
    decimals
  };
}

// POST /api/operations/wallet/balance/tron - Update balances for a Tron wallet
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
        chainId: '728126428'
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
    
    // Fetch balances for each token
    const tronApiKey = process.env.NEXT_PUBLIC_TRON_API_KEY || process.env.NEXT_PUBLIC_TRONGRID_API_KEY;
    if (!tronApiKey) {
      return NextResponse.json({ success: false, error: 'Tron API key is not configured' }, { status: 500 });
    }

    const balances: Record<string, any> = {};
    for (const token of tokenAddresses) {
      try {
        
        const bal = await fetchTrc20Balance(walletAddress, token, tronApiKey);

        if (bal) {
          balances[token.toLowerCase()] = {
            tokenAddress: token,
            balance: bal.balance,
            symbol: bal.symbol,
            decimals: bal.decimals
          };
        }
      } catch (e) {
        // Ignore errors for individual tokens
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
        tokenBalances: balances
      }
    });
  } catch (error) {
    console.error('Error updating Tron token balances:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update Tron token balances' },
      { status: 500 }
    );
  }
});
