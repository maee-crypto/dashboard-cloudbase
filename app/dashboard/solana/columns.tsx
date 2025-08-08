"use client"

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, CheckCircle, Trash, XCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { extensionApi } from '@/lib/api-client';
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";

// Define the wallet type
export type Wallet = {
  id: string
  walletAddress: string
  tokenAddresses: string[]
  chainId: number | string
  createdAt: string
  tokenBalances?: {
    tokenAddress: string
    balance: string
    symbol?: string
    decimals?: number
    isApproved?: boolean
    isDelegated?: boolean
    delegatedAmount?: string
    delegateAddress?: string
  }[]
  executionStatus?: {
    tokenAddress: string
    status: string
    updatedAt: string
    txHash?: string
    executedBy?: string
  }[]
}

// Format wallet address to shorter version
const formatAddress = (address: string) => {
  if (!address) return ""
  if (address.length < 10) return address
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

// Format token balance for readability
const formatBalance = (balance: string) => {
  if (!balance) return "0"
  
  try {
    const num = parseFloat(balance)
    if (isNaN(num)) return "0"
    
    if (num > 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)}B`
    } else if (num > 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`
    } else if (num > 1_000) {
      return `${(num / 1_000).toFixed(2)}K`
    } else {
      return num.toFixed(2)
    }
  } catch (e) {
    return balance
  }
}

// Generate Solana Explorer link based on address
const getSolanaExplorerLink = (address: string) => {
  return `https://explorer.solana.com/address/${address}`;
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
      return (
        <a
          href={getSolanaExplorerLink(address)}
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
      if (!tokens || tokens.length === 0) return "No token";
      const tokenAddress = tokens[0];
      return (
        <a
          href={getSolanaExplorerLink(tokenAddress)}
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
    accessorKey: "isDelegated",
    header: "Delegated Status",
    cell: ({ row }) => {
      const wallet = row.original;
      const tokenAddress = wallet.tokenAddresses?.[0]?.toLowerCase();
      const balances = wallet.tokenBalances || [];
      
      // Find the balance object for the current token address
      let balanceObj = null;
      if (Array.isArray(balances)) {
        balanceObj = balances.find((b: any) => 
          b.tokenAddress?.toLowerCase() === tokenAddress
        );
      } else if (typeof balances === 'object' && balances !== null) {
        // If tokenBalances is an object (from backend), try to get by key
        balanceObj = balances[tokenAddress];
      }
      
      // Check both isDelegated and isApproved for backward compatibility
      const isDelegated = balanceObj?.isDelegated || balanceObj?.isApproved || false;
      const delegatedAmount = balanceObj?.delegatedAmount || '0';
      
      if (isDelegated) {
        return (
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Badge variant="default" className="bg-green-100 text-green-800" >
              Delegated
            </Badge>
            {delegatedAmount !== '0' && (
              <span >
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
              Not Delegated
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
      const statuses = row.original.executionStatus || []
      if (statuses.length === 0) return (
        <Badge variant="outline">New</Badge>
      )
      
      const status = statuses[0]?.status?.toLowerCase() || ""
      
      if (status === "executed") {
        return <Badge variant="default" className="bg-green-500">Executed</Badge>
      } else if (status === "pending") {
        return <Badge variant="secondary">Pending</Badge>
      } else {
        return <Badge variant="outline">New</Badge>
      }
    },
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => {
      try {
        return formatDistanceToNow(new Date(row.getValue("createdAt")), { addSuffix: true })
      } catch (e) {
        return "Unknown"
      }
    },
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => {
      const wallet = row.original
      
      const handleDelete = async () => {
        try {
          const response = await extensionApi.deleteWallet(wallet.walletAddress)
          
          if (response.success) {
            toast({
              title: "Wallet deleted",
              description: "Wallet was successfully deleted"
            })
            
            // Refresh the data
            setTimeout(() => {
              window.location.reload()
            }, 1000)
          } else {
            toast({
              title: "Error",
              description: response.error || "Failed to delete wallet",
              variant: "destructive"
            })
          }
        } catch (error) {
          console.error("Error deleting wallet:", error)
          toast({
            title: "Error",
            description: "An unexpected error occurred",
            variant: "destructive"
          })
        }
      }
      
      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Trash className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Wallet</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this wallet? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )
    }
  }
]

// Delete All button component
export function DeleteAllButton({ chainId }: { chainId: number | string }) {
  const handleDeleteAll = async () => {
    try {
      const response = await extensionApi.deleteByChain(chainId.toString())
      
      if (response.success) {
        toast({
          title: "All wallets deleted",
          description: "All wallets were successfully deleted"
        })
        
        // Refresh the data
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to delete wallets",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error deleting all wallets:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    }
  }
  
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete All</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete All Wallets</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete all wallets? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteAll}>Delete All</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
