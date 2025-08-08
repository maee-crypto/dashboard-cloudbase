import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Trash2, CheckCircle, XCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { extensionApi } from '@/lib/api-client';
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";

export type Wallet = {
  id: string;
  walletAddress: string;
  tokenAddresses: string[];
  chainId: number;
  createdAt: string;
  tokenBalances?: {
    tokenAddress: string;
    balance: string;
    symbol?: string;
    decimals?: number;
    isApproved?: boolean;
    isDelegated?: boolean; // Add isDelegated for Solana support
    delegatedAmount?: string;
  }[];
  executionStatus?: {
    tokenAddress: string;
    status: string;
    updatedAt: string;
    txHash?: string;
    executedBy?: string;
  }[];
};

// Format wallet address to shorter version
const formatAddress = (address: string) => {
  if (!address) return "";
  if (address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Format token balance for readability
const formatBalance = (balance: string) => {
  if (!balance) return "0";
  
  try {
    const num = parseFloat(balance);
    if (isNaN(num)) return "0";
    
    if (num > 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)}B`;
    } else if (num > 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num > 1_000) {
      return `${(num / 1_000).toFixed(2)}K`;
    } else {
      return num.toFixed(2);
    }
  } catch (e) {
    return balance;
  }
};

// Generate Etherscan link based on chainId and address
const getEtherscanLink = (chainId: number, address: string) => {
  // Default to Ethereum mainnet
  let baseUrl = "https://etherscan.io";
  
  // For other networks
  if (chainId === 5) {
    baseUrl = "https://goerli.etherscan.io";
  } else if (chainId === 11155111) {
    baseUrl = "https://sepolia.etherscan.io";
  }
  
  return `${baseUrl}/address/${address}`;
};

// Generate Tronscan link based on address
const getTronscanLink = (address: string) => {
  return `https://tronscan.org/#/address/${address}`;
};

export const columns: ColumnDef<Wallet>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "walletAddress",
    header: "Wallet",
    cell: ({ row }) => {
      const address = row.getValue("walletAddress") as string;
      const chainId = row.original.chainId;
      const isTron = chainId === 728126428;
      return (
        <a
          href={isTron ? getTronscanLink(address) : getEtherscanLink(chainId, address)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-blue-600 hover:underline"
        >
          {formatAddress(address)}
        </a>
      );
    },
  },
  {
    accessorKey: "tokenAddresses",
    header: "Token",
    cell: ({ row }) => {
      const tokens = row.getValue("tokenAddresses") as string[];
      const chainId = row.original.chainId;
      const isTron = chainId === 728126428;
      if (!tokens || tokens.length === 0) return "No token";
      const tokenAddress = tokens[0];
      return (
        <a
          href={isTron ? getTronscanLink(tokenAddress) : getEtherscanLink(chainId, tokenAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-blue-600 hover:underline"
        >
          {formatAddress(tokenAddress)}
        </a>
      );
    },
  },
  {
    accessorKey: "tokenBalances",
    header: "Balance",
    cell: ({ row }) => {
      const wallet = row.original;
      const balances = wallet.tokenBalances || [];
      if (balances.length === 0) return "Unknown";
      return formatBalance(balances[0]?.balance || "0");
    },
    enableSorting: false,
  },
  {
    accessorKey: "isApproved",
    header: "Approval Status",
    cell: ({ row }) => {
      const wallet = row.original;
      const tokenAddress = wallet.tokenAddresses?.[0]?.toLowerCase();
      const balances = wallet.tokenBalances || [];
      
      // Find the balance object for the current token address
      let balanceObj = null;
      if (Array.isArray(balances)) {
        balanceObj = balances.find((b: any) => b.tokenAddress?.toLowerCase() === tokenAddress);
      } else if (typeof balances === 'object' && balances !== null) {
        // If tokenBalances is an object (from backend), try to get by key
        balanceObj = balances[tokenAddress];
      }
      
      if (!balanceObj) {
        return (
          <div className="flex items-center space-x-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              Not Approved
            </Badge>
          </div>
        );
      }
      
      // Check both isApproved and isDelegated for backward compatibility
      // For Solana: isDelegated = isApproved, for other chains: use isApproved
      const isApproved = balanceObj.isApproved || balanceObj.isDelegated || false;
      const delegatedAmount = balanceObj.delegatedAmount || '0';
      
      if (isApproved) {
        return (
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Badge variant="default" className="bg-green-100 text-green-800">
              {wallet.chainId === 507454 ? 'Delegated' : 'Approved'}
            </Badge>
            {delegatedAmount !== '0' && wallet.chainId === 507454 && (
              <span className="text-xs text-gray-500">
                ({formatBalance(delegatedAmount)})
              </span>
            )}
          </div>
        );
      } else {
        return (
          <div className="flex items-center space-x-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              {wallet.chainId === 507454 ? 'Not Delegated' : 'Not Approved'}
            </Badge>
          </div>
        );
      }
    },
    enableSorting: false,
  },
  {
    accessorKey: "executionStatus",
    header: "Status",
    cell: ({ row }) => {
      const wallet = row.original;
      const statuses = wallet.executionStatus || [];
      if (statuses.length === 0) return (
        <Badge variant="outline">New</Badge>
      );
      
      const status = statuses[0]?.status?.toLowerCase() || "";
      
      if (status === "executed") {
        return <Badge variant="default" className="bg-green-500">Executed</Badge>;
      } else if (status === "pending") {
        return <Badge variant="secondary">Pending</Badge>;
      } else {
        return <Badge variant="outline">New</Badge>;
      }
    },
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => {
      try {
        return formatDistanceToNow(new Date(row.getValue("createdAt")), { addSuffix: true });
      } catch (e) {
        return "Unknown";
      }
    },
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => {
      const wallet = row.original;
      const walletAddress = wallet.walletAddress;
      const tokenAddress = wallet.tokenAddresses && wallet.tokenAddresses.length > 0 
                          ? wallet.tokenAddresses[0] 
                          : null;

      const handleDelete = async () => {
        try {
          if (!tokenAddress) {
            alert("No token address found for this row");
            return;
          }

          // Call API to delete just this specific token from the wallet
          const response = await extensionApi.deleteWalletToken(walletAddress, tokenAddress);

          if (response.success) {
            alert("Token removed from wallet successfully");
            window.location.reload();
          } else if (response.error === "Wallet or token not found") {
            alert("Wallet or token not found");
          } else {
            alert(response.error || "Failed to remove token from wallet");
          }
        } catch (error) {
          console.error("Error removing token from wallet:", error);
          alert("Error removing token from wallet");
        }
      };

      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Token from Wallet</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this token ({formatAddress(tokenAddress || "")}) from this wallet? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    },
  },
];

export const DeleteAllButton = ({ chainId }: { chainId: number }) => {
  const handleDeleteAll = async () => {
    try {
      const response = await extensionApi.deleteByChain(chainId.toString());

      if (response.success) {
        alert("All wallet-token pairs deleted successfully");
        window.location.reload();
      } else if (response.error === "No wallets found for this chain ID") {
        alert("No wallets found for this chain");
      } else {
        alert(response.error || "Failed to delete wallet-token pairs");
      }
    } catch (error) {
      console.error("Error deleting wallets:", error);
      alert("Error deleting wallet-token pairs");
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          Delete All
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete All</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete all wallet-token pairs for this chain? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteAll}>Delete All</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};