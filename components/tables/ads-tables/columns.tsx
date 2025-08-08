'use client';
import { Checkbox } from '@/components/ui/checkbox';
import { ColumnDef } from '@tanstack/react-table';
import { CellAction } from './cell-action'; // Assuming you will have actions like Edit/Delete

export interface AdCampaign {
  _id: string;
  uuid: string;
  url: string;
  text: string;
  status: string;
  dates: string;
  price: number;
  createdAt: number;
  paymentAddress: string;
  paymentMsgId: number;
  createdBy: string;
  __v: number;
}

export const columns: ColumnDef<AdCampaign>[] = [
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
    accessorKey: 'text',
    header: 'Ad Text',
  },
  {
    accessorKey: 'url',
    header: 'URL',
    cell: ({ row }) => {
      const fullUrl = row.original.url;
      const displayUrl = fullUrl.length > 15 ? `${fullUrl.slice(0, 15)}...` : fullUrl;

      return (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
          {displayUrl}
        </a>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
  },
  {
    accessorKey: 'dates',
    header: 'Date',
  },
  {
    accessorKey: 'price',
    header: 'Price',
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <CellAction
        data={row.original}
      />
    ),
  },
];
