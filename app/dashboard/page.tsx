"use client";
import { useState, useEffect } from 'react';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  Filter, 
  Search, 
  ShieldAlert, 
  Trash, 
  Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddTokenModal } from '@/components/modals/add-token-modal';
import { getChainName } from '@/lib/utils/chains';
import { tokenApi } from '@/lib/api-client';

// Define the Token interface
interface Token {
  id: string;
  name: string;
  address: string;
  chainId: string;
  isEnabled: boolean;
  description: string; // Kept for potential future use, though not displayed
  createdAt: string;
  updatedAt: string;
}

export default function Page() {
  // State from token-approval page
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch logic from token-approval page
  const fetchTokens = async () => {
    try {
      setIsLoading(true);
      const response = await tokenApi.getAll();
      if (response.success) {
        setTokens(response.data);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  // Handler functions from token-approval page
  const handleAddToken = () => {
    setIsAddModalOpen(true);
  };

  const handleTokenToggle = async (tokenId: string) => {
    try {
      const response = await tokenApi.toggle(tokenId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to toggle token status');
      }
      
      setTokens(tokens.map(token => 
        token.id === tokenId ? { ...token, isEnabled: response.data.isEnabled } : token
      ));
    } catch (error) {
      console.error('Error toggling token status:', error);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    try {
      const response = await tokenApi.delete(tokenId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete token');
      }
      setTokens(tokens.filter(token => token.id !== tokenId));
    } catch (error) {
      console.error('Error deleting token:', error);
    }
  };

  // Filter logic from token-approval page
  const filteredTokens = tokens.filter(token => 
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageContainer scrollable={true}>
      <div className="space-y-2">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Hi, Welcome back 👋
          </h2>
        </div>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview & Tokens</TabsTrigger>
            <TabsTrigger value="analytics" disabled>
              Analytics
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">

            {/* Token Approval Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Token Approval Management</CardTitle>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="search-tokens" className="sr-only">Search tokens</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="search-tokens" 
                      placeholder="Search by token or address" 
                      className="pl-8 max-w-[260px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Network</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">Loading tokens...</TableCell>
                      </TableRow>
                    ) : filteredTokens.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">No tokens found</TableCell>
                      </TableRow>
                    ) : (
                      filteredTokens.map((token) => (
                        <TableRow key={token.id}>
                          <TableCell className="font-medium">{token.name}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {`${token.address.substring(0, 6)}...${token.address.substring(token.address.length - 4)}`}
                          </TableCell>
                          <TableCell>{getChainName(token.chainId)}</TableCell>
                          <TableCell>
                            <Badge variant={token.isEnabled ? 'default' : 'destructive'}>
                              {token.isEnabled ? 'Approved' : 'Blocked'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => handleTokenToggle(token.id)}
                              >
                                {token.isEnabled ? (
                                  <ShieldAlert className="h-4 w-4" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => handleDeleteToken(token.id)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="text-xs text-muted-foreground">
                  Showing {filteredTokens.length} tokens ({filteredTokens.filter(t => t.isEnabled).length} approved)
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1"
                  onClick={handleAddToken}
                >
                  <Plus className="h-4 w-4" />
                  Add Token
                </Button>
              </CardFooter>
            </Card>
            {/* End Token Approval Section */}

          </TabsContent>
        </Tabs>
      </div>
      {/* Add Token Modal */}
      <AddTokenModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          fetchTokens(); // Refresh token list on success
        }}
      />
    </PageContainer>
  );
}