import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { tokenApi } from '@/lib/api-client';

const formSchema = z.object({
  name: z.string().min(1, 'Token name is required'),
  address: z.string().min(1, 'Token address is required'),
  chainId: z.string().min(1, 'Chain ID is required'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddTokenModal({ isOpen, onClose, onSuccess }: AddTokenModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      address: '',
      chainId: '',
      description: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const response = await tokenApi.create({
        ...data,
        isEnabled: true,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to add token');
      }

      toast({
        title: 'Success',
        description: 'Token has been successfully added',
        variant: 'default',
      });

      onSuccess?.();
      onClose();
      form.reset();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add token',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Token</DialogTitle>
          <DialogDescription>
            Enter the token details to add it to the whitelist.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Token Name</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="e.g. USDT"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Token Address</Label>
            <Input
              id="address"
              {...form.register('address')}
              placeholder="Enter token contract address"
            />
            {form.formState.errors.address && (
              <p className="text-sm text-red-500">{form.formState.errors.address.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="chainId">Chain ID</Label>
            <Input
              id="chainId"
              {...form.register('chainId')}
              placeholder="e.g. 3448148188"
            />
            {form.formState.errors.chainId && (
              <p className="text-sm text-red-500">{form.formState.errors.chainId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              {...form.register('description')}
              placeholder="Enter token description"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Token
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
