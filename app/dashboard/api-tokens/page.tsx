"use client";
import { useState, useEffect } from 'react';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Copy, 
  Plus,
  Key,
  Trash,
  ShieldX,
  MoreHorizontal
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { tokenManagementApi } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';

interface ApiToken {
  id: string;
  name: string;
  expiresAt: string;
  lastUsed?: string;
  isRevoked: boolean;
  createdAt: string;
  description?: string;
}

export default function ApiTokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // New token form
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [expiresIn, setExpiresIn] = useState('86400'); // 24 hours
  const [description, setDescription] = useState('');
  
  // Token display after creation
  const [generatedToken, setGeneratedToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showNewToken, setShowNewToken] = useState(false);
  
  const fetchTokens = async () => {
    try {
      setIsLoading(true);
      const response = await tokenManagementApi.getTokens();
      
      if (response.success) {
        setTokens(response.data);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to fetch tokens",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
      toast({
        title: "Error",
        description: "Failed to fetch tokens. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchTokens();
  }, []);
  
  const handleCreateToken = async () => {
    try {
      setIsLoading(true);
      
      const response = await tokenManagementApi.createToken({
        name: serviceName,
        expiresIn: parseInt(expiresIn, 10),
        description
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create token');
      }
      
      setGeneratedToken(response.data.token);
      setExpiresAt(response.data.expiresAt);
      setShowNewToken(true);
      
      // Close the create dialog and reset form
      setIsCreateDialogOpen(false);
      resetForm();
      
      // Refresh token list
      fetchTokens();
      
      toast({
        title: "Success",
        description: "API token created successfully!",
      });
    } catch (error) {
      console.error('Error creating token:', error);
      toast({
        title: "Error",
        description: "Failed to create API token. Try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRevokeToken = async (id: string) => {
    try {
      setIsLoading(true);
      
      const response = await tokenManagementApi.revokeToken(id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to revoke token');
      }
      
      // Update tokens list
      setTokens(tokens.map(token => 
        token.id === id ? { ...token, isRevoked: true } : token
      ));
      
      toast({
        title: "Success",
        description: "Token revoked successfully",
      });
    } catch (error) {
      console.error('Error revoking token:', error);
      toast({
        title: "Error",
        description: "Failed to revoke token. Try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteToken = async (id: string) => {
    try {
      setIsLoading(true);
      
      const response = await tokenManagementApi.deleteToken(id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete token');
      }
      
      // Remove from tokens list
      setTokens(tokens.filter(token => token.id !== id));
      
      toast({
        title: "Success",
        description: "Token deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting token:', error);
      toast({
        title: "Error",
        description: "Failed to delete token. Try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCopyToken = () => {
    navigator.clipboard.writeText(generatedToken);
    toast({
      title: "Copied!",
      description: "Token copied to clipboard",
    });
  };
  
  const resetForm = () => {
    setServiceName('');
    setExpiresIn('86400');
    setDescription('');
  };

  return (
    <PageContainer scrollable={true}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">API Tokens</h2>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1">
                <Plus className="h-4 w-4" />
                Generate New Token
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New API Token</DialogTitle>
                <DialogDescription>
                  Generate a new token for external services to access the API.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="service-name">Service Name</Label>
                  <Input 
                    id="service-name" 
                    placeholder="e.g., External Website" 
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expires-in">Expires In (seconds)</Label>
                  <Input 
                    id="expires-in" 
                    placeholder="86400 (24 hours)"
                    type="number" 
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default: 86400 seconds (24 hours)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea 
                    id="description" 
                    placeholder="What this token will be used for" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleCreateToken} 
                  disabled={!serviceName || isLoading}
                >
                  Generate Token
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Token list */}
        <Card>
          <CardHeader>
            <CardTitle>Your API Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <p>Loading tokens...</p>
              </div>
            ) : tokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Key className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No API tokens found</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Create a token to allow external services to access the API.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-1">
                  <Plus className="h-4 w-4" />
                  Generate New Token
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {tokens.map((token) => (
                  <div 
                    key={token.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{token.name}</span>
                        <Badge variant={token.isRevoked ? "destructive" : "outline"}>
                          {token.isRevoked ? "Revoked" : "Active"}
                        </Badge>
                      </div>
                      {token.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {token.description}
                        </p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Created: {format(new Date(token.createdAt), 'MMM d, yyyy')}</span>
                        <span>Expires: {format(new Date(token.expiresAt), 'MMM d, yyyy')}</span>
                        {token.lastUsed && (
                          <span>Last used: {format(new Date(token.lastUsed), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {!token.isRevoked && (
                          <DropdownMenuItem
                            className="text-amber-600 dark:text-amber-400"
                            onClick={() => handleRevokeToken(token.id)}
                          >
                            <ShieldX className="h-4 w-4 mr-2" />
                            Revoke Token
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-destructive" 
                          onClick={() => handleDeleteToken(token.id)}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete Token
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Newly generated token */}
        {showNewToken && (
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="text-green-600 dark:text-green-400 flex items-center gap-2">
                <Key className="h-5 w-5" />
                Token Generated Successfully
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/50 p-4 text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> This token will only be displayed once. Make sure to copy it now.
              </div>
              <div className="space-y-2">
                <Label>Token (copy this value)</Label>
                <div className="relative">
                  <Input 
                    readOnly 
                    value={generatedToken} 
                    className="pr-10 font-mono text-xs"
                  />
                  <Button
                    variant="ghost"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={handleCopyToken}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Expires At</Label>
                <p className="text-sm">{new Date(expiresAt).toLocaleString()}</p>
              </div>
              <div className="rounded-md bg-muted p-4">
                <h4 className="mb-2 font-medium">How to use:</h4>
                <p className="text-sm text-muted-foreground">
                  Add this token in the Authorization header when making requests to the API:
                </p>
                <pre className="mt-2 rounded-md bg-slate-950 p-4 text-xs">
                  <code className="text-white">Authorization: Bearer {"{token}"}</code>
                </pre>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowNewToken(false)}
              >
                Done
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </PageContainer>
  );
} 