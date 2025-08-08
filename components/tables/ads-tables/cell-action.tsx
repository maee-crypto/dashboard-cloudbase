'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Check, X, MoreHorizontal } from 'lucide-react';
import axios from 'axios';

interface CellActionProps {
  data: {
    uuid: string;
    status: string;
  };
}

export const CellAction: React.FC<CellActionProps> = ({ data }) => {
  const [status, setStatus] = useState(data.status); // Initialize state with the current status
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: 'Paid' | 'Expired') => {
    try {
      setLoading(true);
      const response = await axios.put(`/api/ads/${data.uuid}`, { status: newStatus });
      setStatus(newStatus);
      window.location.reload(); // TODO: REPLACE!!!
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={loading}>
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => updateStatus('Paid')}>
          <Check className="mr-2 h-4 w-4" /> Enable (Paid)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateStatus('Expired')}>
          <X className="mr-2 h-4 w-4" /> Disable (Expired)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
