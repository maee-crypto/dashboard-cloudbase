'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface RecentSale {
  socials: string;
  tokenAddress: string;
  amountInUSD: number;
}

export function RecentSales() {
  const [sales, setSales] = React.useState<RecentSale[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchSales = async () => {
      try {
        const response = await fetch('/api/stats/recent-sales');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch sales: ${response.statusText}`);
        }

        const data = await response.json();
        setSales(data.recentSales);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  if (loading) {
    return <div>Loading recent sales...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-8">
      {sales.map((sale, index) => (
        <div key={index} className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src={`/avatars/${index + 1}.png`} alt="Avatar" />
            <AvatarFallback>{sale.tokenAddress.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{sale.socials}</p>
            <p className="text-sm text-muted-foreground">{sale.tokenAddress}</p>
          </div>
          <div className="ml-auto font-medium">+${sale.amountInUSD.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}
