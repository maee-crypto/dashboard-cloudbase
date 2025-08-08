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
import { ChevronLeft, ChevronRight, RefreshCw, Play, RotateCcw, AlertTriangle, ChevronDown } from "lucide-react";
import { allowanceApi, tokenManagementApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { error } from "console";

// Define a base type for execution table rows
export interface ExecutionRow {
  walletAddress: string;
  tokenAddresses?: string[];
  tokenAddress?: string;
  executionStatus?: { tokenAddress: string; status: string }[];
}

interface ExecutionTableProps<TData extends ExecutionRow, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  chainId: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  isServerPaginated?: boolean;
  onRowSelectionChange?: (selectedRows: TData[]) => void;
  onRefresh?: () => void;
  onExecuteTokens?: (selectedRows: TData[]) => Promise<any>;
  executionReceiver?: string;
  setExecutionReceiver?: (val: string) => void;
  isLoading?: boolean; // Add loading prop
  validateReceiverAddress?: (address: string) => boolean; // Add address validation function
}

export function ExecutionTable<TData extends ExecutionRow, TValue>({
  columns,
  data,
  chainId,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  isServerPaginated = false,
  onRowSelectionChange,
  onRefresh,
  onExecuteTokens,
  executionReceiver,
  setExecutionReceiver,
  isLoading = false, // Add loading prop with default
  validateReceiverAddress, // Add address validation function
}: ExecutionTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: isServerPaginated ? currentPage - 1 : 0, // Convert 1-based to 0-based for tanstack table
    pageSize: 10, // Keep 10 records per page
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [showReceiverInput, setShowReceiverInput] = useState(false);
  const { toast } = useToast();
  
  // Default validation function for Ethereum addresses
  const defaultValidateAddress = (address: string): boolean => {
    return !!(address && address.length === 42 && address.startsWith('0x'));
  };

  // Use provided validation function or fall back to default
  const isValidReceiverAddress = validateReceiverAddress || defaultValidateAddress;
  
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
          title: "No rows selected",
          description: "Please select at least one row to update balances.",
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
          description: `Successfully updated ${response.data.updatedCount} wallets.${response.data.failedUpdates > 0 ? ` Failed: ${response.data.failedUpdates}` : ''}`,
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

  // Handle resetting a specific token from pending to new
  const handleResetToken = async (walletAddress: string, tokenAddress: string) => {
    try {
      setIsResetting(true);
      
      console.log(`Resetting token ${tokenAddress} for wallet ${walletAddress}`);
      
      // Call the reset API
      const response = await allowanceApi.resetTokenStatus(
        walletAddress, 
        tokenAddress, 
        chainId.toString()
      );
      
      if (response.success) {
        toast({
          title: "Token reset",
          description: "Token status has been reset to new.",
          variant: "default"
        });
        
        // Refresh the table data
        if (onPageChange && isServerPaginated) {
          onPageChange(currentPage);
        }
      } else {
        toast({
          title: "Error resetting token",
          description: response.error || "An error occurred while resetting the token.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error resetting token:", error);
      toast({
        title: "Error resetting token",
        description: "An unexpected error occurred while resetting the token.",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Handle resetting all pending tokens to new
  const handleResetAllPending = async () => {
    try {
      setIsResetting(true);
      
      console.log(`Resetting all pending tokens for chain ${chainId}`);
      
      // Call the reset all API
      const response = await allowanceApi.resetAllPending(chainId.toString());
      
      if (response.success) {
        toast({
          title: "All tokens reset",
          description: `Successfully reset ${response.data.totalReset} tokens to new status.`,
          variant: "default"
        });
        
        // Refresh the table data
        if (onPageChange && isServerPaginated) {
          onPageChange(currentPage);
        }
      } else {
        toast({
          title: "Error resetting tokens",
          description: response.error || "An error occurred while resetting tokens.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error resetting all pending tokens:", error);
      toast({
        title: "Error resetting tokens",
        description: "An unexpected error occurred while resetting tokens.",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Helper: update local data to mark selected rows as executed
  const markRowsExecuted = (selectedRows: TData[]) => {
    selectedRows.forEach((row) => {
      if (Array.isArray(row.executionStatus)) {
        row.executionStatus = row.executionStatus.map((s) => ({
          ...s,
          status: "executed",
        }));
      } else {
        row.executionStatus = [];
      }
    });
  };

  // Create actions column with "Reset" instead of delete
  const actionsColumn: ColumnDef<TData, any> = {
    id: "actions",
    header: "Action",
    cell: ({ row }) => {
      const rowData = row.original as any;
      const walletAddress = rowData.walletAddress;
      const tokenAddress = rowData.tokenAddresses && rowData.tokenAddresses.length > 0 
                        ? rowData.tokenAddresses[0] 
                        : null;

      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Token Status</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reset this token's status to "new"? This will remove it from the execution queue.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => handleResetToken(walletAddress, tokenAddress)}
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    },
  };

  // Replace the action column with our custom one
  const modifiedColumns = [...columns];
  const actionColumnIndex = modifiedColumns.findIndex(col => col.id === 'actions');
  if (actionColumnIndex >= 0) {
    modifiedColumns[actionColumnIndex] = actionsColumn;
  }

  const table = useReactTable({
    data,
    columns: modifiedColumns,
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
      {/* Execute, Receiver, and Reset All buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
          <div className="relative">
            <Button
              variant="default"
              onClick={() => setShowReceiverInput((v) => !v)}
              disabled={isExecuting || data.length === 0}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Execute Tokens
              <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showReceiverInput ? 'rotate-180' : ''}`} />
            </Button>
            {showReceiverInput && (
              <div className="absolute z-10 mt-2 bg-white border rounded shadow-lg p-4 min-w-[300px] w-max flex flex-col gap-3">
                <label htmlFor="executionReceiver" className="font-medium whitespace-nowrap mb-1">Receiver Address</label>
                <input
                  id="executionReceiver"
                  type="text"
                  placeholder={chainId === 728126428 ? "T..." : "0x..."}
                  value={executionReceiver || ''}
                  onChange={e => setExecutionReceiver && setExecutionReceiver(e.target.value)}
                  className="max-w-xs w-full px-2 py-1 border rounded text-sm font-mono"
                  autoComplete="off"
                />
                <Button
                  variant="default"
                  onClick={async () => {
                    if (onExecuteTokens) {
                      setIsExecuting(true);
                      try {
                        const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
                        await onExecuteTokens(selectedRows);
                      } catch (error) {
                        console.error("Execution error:", error);
                        toast({
                          title: "Execution Error",
                          description: error instanceof Error ? error.message : "Unknown error occurred",
                          variant: "destructive"
                        });
                      } finally {
                        setIsExecuting(false);
                        setShowReceiverInput(false);
                      }
                    }
                  }}
                  disabled={
                    isExecuting || 
                    !onExecuteTokens || 
                    !executionReceiver || 
                    !isValidReceiverAddress(executionReceiver || '') ||
                    data.length === 0
                  }
                  className="gap-2 mt-2"
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Execute Selected Tokens
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={isResetting || isLoading}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="gap-2 whitespace-nowrap">
              <RotateCcw className="h-4 w-4" />
              Reset All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset All Pending Tokens</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reset all pending tokens to "new" status? This will clear the execution queue.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAllPending}>Reset All</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      
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
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mb-2" />
                    <p>No pending tokens found.</p>
                    <p className="text-sm">Process tokens in the Wallet Data tab first.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {executionResult && executionResult.results && Array.isArray(executionResult.results) && (
        <div className="mt-4 p-4 rounded-md border bg-gray-50">
          <div className="font-semibold mb-2">Batch Execution Result</div>
          {executionResult.txHash && (
            <div className="mb-2">Tx Hash: <a href={`https://etherscan.io/tx/${executionResult.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{executionResult.txHash}</a></div>
          )}
          <ul className="text-sm">
            {executionResult.results.map((r: any, idx: number) => (
              <li key={idx} className={r.success ? "text-green-700" : "text-red-700"}>
                {r.walletAddress} / {r.tokenAddress}: {r.success ? "Executed" : `Failed: ${r.error || 'Unknown error'}`}
              </li>
            ))}
          </ul>
        </div>
      )}
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