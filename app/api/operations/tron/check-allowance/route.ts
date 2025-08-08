import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated } from '@/lib/authenticated';

const TRONGRID_API = 'https://api.trongrid.io';
const tronApiKey = process.env.NEXT_PUBLIC_TRON_API_KEY || process.env.NEXT_PUBLIC_TRONGRID_API_KEY;

const checkAllowanceSchema = z.object({
  items: z.array(
    z.object({
      walletAddress: z.string().min(1),
      tokenAddress: z.string().min(1),
      spenderAddress: z.string().min(1)
    })
  )
});

// Helper to fetch TRC20 allowance using TronGrid API
async function fetchTrc20Allowance(owner: string, spender: string, token: string) {
  // TronGrid API for allowance: /v1/accounts/{owner}/allowances?contract_address={token}
  const url = `${TRONGRID_API}/v1/accounts/${owner}/allowances?contract_address=${token}`;
  const headers: Record<string, string> = {};
  if (tronApiKey) headers['TRON-PRO-API-KEY'] = tronApiKey;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  if (!data || !data.data || !Array.isArray(data.data) || !data.data[0]) return "0";
  // Find the allowance for the spender
  const allowances = data.data[0].allowances || [];
  const entry = allowances.find((a: any) => a.spender && a.spender.toLowerCase() === spender.toLowerCase());
  return entry ? entry.allowance : "0";
}

export const POST = authenticated(1, async (request) => {
  try {
    const body = await request.json();
    const validation = checkAllowanceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.message }, { status: 400 });
    }
    const { items } = validation.data;

    const results = [];
    for (const { walletAddress, tokenAddress, spenderAddress } of items) {
      try {
        const allowance = await fetchTrc20Allowance(walletAddress, spenderAddress, tokenAddress);
        const isApproved = BigInt(allowance) > BigInt(0);
        results.push({
          walletAddress,
          tokenAddress,
          spenderAddress,
          allowance,
          isApproved
        });
      } catch (error) {
        results.push({
          walletAddress,
          tokenAddress,
          spenderAddress,
          allowance: "0",
          isApproved: false,
          error: (error as any)?.message || "Failed to fetch allowance"
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalProcessed: results.length,
        items: results
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to check Tron allowances' },
      { status: 500 }
    );
  }
});
