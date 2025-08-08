'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { ColumnDef } from '@tanstack/react-table';

// Define the data type for BotChannel
type BotChannel = {
  createdByUsername: string;
  groupUsername: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  dexName: string;
  paused: boolean;
  group_id: string;
};

export const columns: ColumnDef<BotChannel>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
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
    accessorKey: 'createdByUsername',
    header: 'Created By',
    cell: ({ row }) => (
      <a
        href={`https://t.me/${row.original.createdByUsername}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 underline"
      >
        {row.original.createdByUsername}
      </a>
    ),
  },
  {
    accessorKey: 'groupUsername',
    header: 'Group Username',
    cell: ({ row }) => (
      <a
        href={`https://t.me/${row.original.groupUsername}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 underline"
      >
        {row.original.groupUsername}
      </a>
    ),
  },
  {
    accessorKey: 'tokenAddress',
    header: 'Token Address',
  },
  {
    accessorKey: 'tokenName',
    header: 'Token Name',
  },
  {
    accessorKey: 'tokenSymbol',
    header: 'Token Symbol',
  },
  {
    accessorKey: 'dexName',
    header: 'DEX Name',
  },
];
