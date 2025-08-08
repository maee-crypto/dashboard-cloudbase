'use client';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const addFormSchema = z.object({
  tokenAddress: z.string().min(1, { message: 'Token Address is required' }),
  poolAddress: z.string().min(1, { message: 'Pool Address is required' }),
  paymentAddress: z.string().min(1, { message: 'Payment Address is required' }),
  amount: z.preprocess((value) => parseFloat(z.string().parse(value)), z.number().min(0, { message: 'Amount must be a positive number' })),
  duration: z.preprocess((value) => parseInt(z.string().parse(value), 10), z.number().min(0, { message: 'Duration must be a positive number' })),
  socials: z.string().min(1, { message: 'Socials URL is required' }),
  status: z.enum(["Pending", "Paid", "Expired", "Ended"], { required_error: 'Status is required' }),
  slot: z.enum(["1", "2", "3"], { required_error: 'Slot is required' }),
  expiresAt: z.string().min(1, { message: 'Expires At is required' }),
});

type AddFormValues = z.infer<typeof addFormSchema>;

export const AddForm: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<AddFormValues>({
    resolver: zodResolver(addFormSchema),
    defaultValues: {
      tokenAddress: '',
      poolAddress: '',
      paymentAddress: '',
      amount: 0,
      duration: 0,
      socials: '',
      status: 'Pending',
      slot: '1',
      expiresAt: '',
    }
  });

  const onSubmit = async (data: AddFormValues) => {
    try {
      setLoading(true);

      // Prepare data for submission, converting `expiresAt` to Unix timestamp
      const formattedData = {
        ...data,
        expiresAt: new Date(data.expiresAt).getTime(),
        slot: parseInt(data.slot, 10), // Convert slot to an integer
      };

      // Make a POST request to add a new trend
      await axios.post('/api/trending', formattedData);
      router.push('/dashboard/trending');
    } catch (error: any) {
      console.error('Failed to add trend:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading title="Add New Trend" description="Create a new trend entry" />
      </div>
      <Separator />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-8">
          <FormField
            control={form.control}
            name="tokenAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Token Address</FormLabel>
                <FormControl>
                  <Input disabled={loading} placeholder="Enter token address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="poolAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pool Address</FormLabel>
                <FormControl>
                  <Input disabled={loading} placeholder="Enter pool address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="paymentAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Address</FormLabel>
                <FormControl>
                  <Input disabled={loading} placeholder="Enter payment address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    disabled={loading}
                    placeholder="Enter amount"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    disabled={loading}
                    placeholder="Enter duration"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="socials"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Socials URL</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    disabled={loading}
                    placeholder="Enter socials URL"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="expiresAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expires At</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <FormControl>
                  <Select
                    disabled={loading}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as 'Pending' | 'Paid' | 'Expired' | 'Ended')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                      <SelectItem value="Ended">Ended</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slot"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slot</FormLabel>
                <FormControl>
                  <Select
                    disabled={loading}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as '1' | '2' | '3')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select slot" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button disabled={loading} className="ml-auto" type="submit">
            Add Trend
          </Button>
        </form>
      </Form>
    </>
  );
};
