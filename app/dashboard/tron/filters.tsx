"use client"

import React from "react"
import { Search, Calendar, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DeleteAllButton } from "@/components/tables/wallet-tables/columns"

// Define the search params interface
export interface WalletSearchParams {
  chainId: string | number
  walletAddress?: string
  minBalance?: string
  maxBalance?: string
  startDate?: Date | null
  endDate?: Date | null
  executionFilter?: string
  page: number
  pageSize: number
}

interface FiltersProps {
  searchParams: WalletSearchParams
  onSearchParamsChange: (newParams: Partial<WalletSearchParams>) => void
  onRefresh: () => void
  isLoading: boolean
}

export function TronFilters({
  searchParams,
  onSearchParamsChange,
  onRefresh,
  isLoading
}: FiltersProps) {
  // State for form values
  const [walletAddress, setWalletAddress] = React.useState(searchParams.walletAddress || "")
  const [minBalance, setMinBalance] = React.useState(searchParams.minBalance || "")
  const [maxBalance, setMaxBalance] = React.useState(searchParams.maxBalance || "")
  const [startDate, setStartDate] = React.useState<Date | null>(searchParams.startDate || null)
  const [endDate, setEndDate] = React.useState<Date | null>(searchParams.endDate || null)
  const [status, setStatus] = React.useState(searchParams.executionFilter || "all")

  // Handle search form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newParams: Partial<WalletSearchParams> = {
      walletAddress: walletAddress || undefined,
      minBalance: minBalance || undefined,
      maxBalance: maxBalance || undefined,
      startDate: startDate,
      endDate: endDate,
      executionFilter: status === "all" ? undefined : status,
      page: 1, // Reset page when new search
    }
    onSearchParamsChange(newParams)
  }

  // Handle status change
  const handleStatusChange = (value: string) => {
    setStatus(value);
  }

  // Handle clear filters
  const handleClearFilters = () => {
    setWalletAddress("")
    setMinBalance("")
    setMaxBalance("")
    setStartDate(null)
    setEndDate(null)
    setStatus("all")
    onSearchParamsChange({
      walletAddress: undefined,
      minBalance: undefined,
      maxBalance: undefined,
      startDate: null,
      endDate: null,
      executionFilter: undefined,
      page: 1,
    })
  }

  // Handle refresh: reset filters and page, then trigger search (like Ethereum)
  const handleRefresh = () => {
    setWalletAddress("");
    setMinBalance("");
    setMaxBalance("");
    setStartDate(null);
    setEndDate(null);
    setStatus("all");
    onSearchParamsChange({
      walletAddress: undefined,
      minBalance: undefined,
      maxBalance: undefined,
      startDate: null,
      endDate: null,
      executionFilter: undefined,
      page: 1,
    });
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Top row with actions */}
      <div className="flex justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {/* Use the icon as a component, not a function call */}
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <DeleteAllButton chainId={Number(searchParams.chainId)} />
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="default" 
            size="sm"
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleClearFilters}
            disabled={isLoading}
          >
            Clear Filters
          </Button>
        </div>
      </div>
      {/* Filters form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Wallet address filter */}
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="wallet-address">Wallet Address</Label>
          <div className="relative">
            <Input
              id="wallet-address"
              placeholder="T..."
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
            />
          </div>
        </div>
        {/* Min Balance */}
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="min-balance">Min Balance</Label>
          <Input
            id="min-balance"
            type="number"
            placeholder="0"
            value={minBalance}
            onChange={(e) => setMinBalance(e.target.value)}
          />
        </div>
        {/* Max Balance */}
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="max-balance">Max Balance</Label>
          <Input
            id="max-balance"
            type="number"
            placeholder="100"
            value={maxBalance}
            onChange={(e) => setMaxBalance(e.target.value)}
          />
        </div>
        {/* Start Date */}
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="start-date">Start Date</Label>
          <DatePicker
            id="start-date"
            date={startDate as Date | undefined}
            setDate={(date) => setStartDate(date ?? null)}
            placeholder="From"
          />
        </div>
        {/* End Date */}
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="end-date">End Date</Label>
          <DatePicker
            id="end-date"
            date={endDate as Date | undefined}
            setDate={(date) => setEndDate(date ?? null)}
            placeholder="To"
          />
        </div>
        {/* Status filter */}
        <div className="flex flex-col space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select 
            value={status} 
            onValueChange={handleStatusChange}
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="executed">Executed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </form>
    </div>
  )
}
