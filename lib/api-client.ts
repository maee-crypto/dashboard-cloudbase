/**
 * API Client for the Emergency Withdrawal System
 * Abstracts all API calls to the backend
 */

import { 
  AllowedTokenResponse, 
  AllowedTokensByChainDto, 
  CheckAllowanceDto, 
  CheckAllowedTokensDto, 
  CreateTokenAddressDto, 
  FindByChainDto,
  SearchWalletDto,
  UpdateAllowanceDto, 
  UpdateTokenAddressDto,
  WalletTokensResponse 
} from "@/types/emergency-withdrawal";
import { signOut } from "next-auth/react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function handle401(response: Response) {
  if (typeof window !== 'undefined' && response.status === 401) {
    // Remove session using NextAuth
    signOut({ callbackUrl: "/" });
  }
}

async function fetchWith401(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  handle401(response);
  return response;
}

// Token Operations
export const tokenApi = {
  getAll: async () => {
    const response = await fetchWith401(`${API_BASE}/api/operations/tokens`);
    return response.json();
  },
  
  getEnabled: async () => {
    const response = await fetchWith401(`${API_BASE}/api/operations/tokens/enabled`);
    return response.json();
  },
  
  getById: async (id: string) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/tokens/${id}`);
    return response.json();
  },
  
  create: async (data: CreateTokenAddressDto) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  update: async (id: string, data: UpdateTokenAddressDto) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/tokens/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  delete: async (id: string) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/tokens/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },
  
  toggle: async (id: string) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/tokens/${id}/toggle`, {
      method: 'PATCH'
    });
    return response.json();
  },
  
  getByChain: async (chainId: string) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/tokens/by-chain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId })
    });
    return response.json();
  }
};

// Allowance Operations
export const allowanceApi = {
  checkAllowed: async (data: CheckAllowedTokensDto) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/allowance/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getByChain: async (chainId: string) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/allowance/by-chain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId })
    });
    return response.json();
  },
  
  search: async (params: SearchWalletDto) => {
    console.log('Searching with params:', params);
    const response = await fetchWith401(`${API_BASE}/api/operations/allowance/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return response.json();
  },
  
  updateStatus: async (wallets: { walletAddress: string; chainId: string; tokenAddress: string }[], status: 'new' | 'pending' | 'executed') => {
    const response = await fetchWith401(`${API_BASE}/api/operations/allowance/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallets, status, executedBy: 'dashboard' })
    });
    return response.json();
  },
  
  // Reset all pending tokens to new status for a chain
  resetAllPending: async (chainId: string) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/allowance/reset-all-pending`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId })
    });
    return response.json();
  },
  
  // Reset a specific token from pending to new
  resetTokenStatus: async (walletAddress: string, tokenAddress: string, chainId: string) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/allowance/reset-token-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, tokenAddress, chainId })
    });
    return response.json();
  }
};

// Extension Operations
export const extensionApi = {
  checkAllowance: async (data: CheckAllowanceDto) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/extension/check-allowance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  updateAllowance: async (data: UpdateAllowanceDto) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/extension/update-allowance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  deleteWallet: async (address: string) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/wallet/${address}`, {
      method: 'DELETE'
    });
    return response.json();
  },
  
  deleteWalletToken: async (walletAddress: string, tokenAddress: string) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/wallet/${walletAddress}/token/${tokenAddress}`, {
      method: 'DELETE'
    });
    return response.json();
  },
  
  deleteByChain: async (chainId: string) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/chain/${chainId}`, {
      method: 'DELETE'
    });
    return response.json();
  }
};

// Token Management API
export const tokenManagementApi = {
  getTokens: async () => {
    const response = await fetchWith401(`${API_BASE}/api/tokens`);
    return response.json();
  },
  
  createToken: async (data: { name: string; expiresIn: number; description?: string }) => {
    const response = await fetchWith401(`${API_BASE}/api/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  revokeToken: async (id: string) => {
    const response = await fetchWith401(`${API_BASE}/api/tokens/${id}`, {
      method: 'PATCH'
    });
    return response.json();
  },
  
  deleteToken: async (id: string) => {
    const response = await fetchWith401(`${API_BASE}/api/tokens/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },
  
  // Update token balances for a wallet
  updateWalletBalances: async (walletAddress: string) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/wallet/${walletAddress}/balance`, {
      method: 'POST'
    });
    return response.json();
  },
  
  // Update token balances for multiple wallets
  bulkUpdateBalances: async (walletAddresses: string[]) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/wallet/balance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddresses })
    });
    return response.json();
  }
};

// Permit2 Operations for checking token approvals
export const permit2Api = {
  updateAllowances: async (items: { walletAddress: string; tokenAddress: string; spenderAddress: string }[]) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/permit2/check-allowance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    return response.json();
  }
};

// Tron TRC20 Allowance Operations
export const tronAllowanceApi = {
  checkAllowances: async (items: { walletAddress: string; tokenAddress: string; spenderAddress: string }[]) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/tron/check-allowance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    return response.json();
  }
};

// Solana SPL Token Delegation Operations
export const solanaDelegationApi = {
  checkDelegations: async (items: { walletAddress: string; tokenAddress: string; delegateAddress: string }[]) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/solana/check-delegation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    return response.json();
  }
};

// Execution Status Operations
export const executionStatusApi = {
  updateStatus: async (updates: Array<{
    walletAddress: string;
    tokenAddress: string;
    chainId: string;
    status: 'new' | 'pending' | 'executed';
    txHash?: string;
    executedBy?: string;
  }>) => {
    const response = await fetchWith401(`${API_BASE}/api/operations/execution/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    });
    return response.json();
  }
};