/**
 * Emergency Withdrawal System Types
 * Contains DTOs and response types for the token and wallet management
 */

// Token Address DTOs
export interface CreateTokenAddressDto {
  name: string;
  address: string;
  chainId: string;
  description?: string;
  isEnabled?: boolean;
}

export interface UpdateTokenAddressDto {
  name?: string;
  address?: string;
  chainId?: string;
  isEnabled?: boolean;
  description?: string;
}

export interface FindByChainDto {
  chainId: string;
}

// Wallet/Token Allowance DTOs
export interface CheckAllowedTokensDto {
  walletAddresses: { address: string; chainId: string }[];
}

export interface AllowedTokenResponse {
  walletAddress: string;
  tokenAddress: string;
  isAllowed: boolean;
}

export interface AllowedTokensByChainDto {
  chainId: string;
}

export interface WalletTokensResponse {
  walletAddress: string;
  allowedTokens: string[];
}

export interface CheckAllowanceDto {
  walletAddress: string;
  chainId: string;
  tokenAddresses: string[];
}

export interface UpdateAllowanceDto {
  walletAddress: string;
  chainId: string;
  tokenAddress: string;
  isAllowed: boolean;
}

// Search Wallet DTO for advanced filtering
export interface SearchWalletDto {
  chainId: string;
  walletAddress?: string;
  tokenAddress?: string;
  executionFilter?: 'new' | 'pending' | 'executed' | 'all';
  minBalance?: string;
  maxBalance?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Token Balance type for storing balance information
export interface TokenBalance {
  tokenAddress: string;
  balance: string;
  symbol?: string;
  decimals?: number;
}

// Execution Status type
export interface ExecutionStatus {
  tokenAddress: string;
  status: string;
  updatedAt: string;
  txHash?: string;
  executedBy?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
} 