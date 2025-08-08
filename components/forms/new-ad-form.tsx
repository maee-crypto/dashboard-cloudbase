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

const addAdSchema = z.object({
  url: z.string().url({ message: 'Invalid URL' }).min(1, { message: 'URL is required' }),
  text: z.string().min(1, { message: 'Text is required' }),
  price: z.coerce.number().positive({ message: 'Price must be positive' }), // Coerce the input to a number
  dates: z.string().min(1, { message: 'Date is required' }),
});

type AddAdFormValues = z.infer<typeof addAdSchema>;

export const AddAdForm: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<AddAdFormValues>({
    resolver: zodResolver(addAdSchema),
    defaultValues: {
      url: '',
      text: '',
      price: 0,
      dates: '',
    }
  });

  const onSubmit = async (data: AddAdFormValues) => {
    try {
      setLoading(true);
      await axios.post('/api/ads', data);
      router.push('/dashboard/advertisements');
    } catch (error: any) {
      console.error('Failed to add ad:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading title="Add New Ad" description="Create a new ad entry" />
      </div>
      <Separator />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-8">
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL</FormLabel>
                <FormControl>
                  <Input disabled={loading} placeholder="Enter URL" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Text</FormLabel>
                <FormControl>
                  <Input disabled={loading} placeholder="Enter text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    disabled={loading}
                    placeholder="Enter price"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dates"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    disabled={loading}
                    placeholder="Select date"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button disabled={loading} className="ml-auto" type="submit">
            Add Ad
          </Button>
        </form>
      </Form>
    </>
  );
};
