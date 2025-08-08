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

const updateFormSchema = z.object({
  expiresAt: z.string().min(1, { message: 'Expires At is required' }),
  status: z.enum(["Pending", "Paid", "Expired", "Ended"], { required_error: 'Status is required' }),
  slot: z.enum(["1", "2", "3"], { required_error: 'Slot is required' }),
  amount: z.number().min(0, { message: 'Amount must be a positive number' }),
  duration: z.number().min(0, { message: 'Duration must be a positive number' }),
});

type UpdateFormValues = z.infer<typeof updateFormSchema>;

interface UpdateFormProps {
  initialData: {
    uuid: string;
    expiresAt: string;
    amount: number;
    duration: number;
    status: 'Pending' | 'Paid' | 'Expired' | 'Ended';
    slot: '1' | '2' | '3';
  };
}

export const UpdateForm: React.FC<UpdateFormProps> = ({ initialData }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<UpdateFormValues>({
    resolver: zodResolver(updateFormSchema),
    defaultValues: {
      expiresAt: initialData.expiresAt,
      status: initialData.status,
      slot: String(initialData.slot) as '1' | '2' | '3', // Explicitly type the slot value
      amount: initialData.amount,
      duration: initialData.duration,
    }
  });  

  const onSubmit = async (data: UpdateFormValues) => {
    try {
      setLoading(true);
      // Make a PUT request to update the data
      await axios.put(`/api/trending/${initialData.uuid}`, data);
      router.refresh();
      router.push(`/dashboard/trending`);
    } catch (error: any) {
      console.error('Failed to update:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading title="Update Trend" description="Edit the trend details" />
      </div>
      <Separator />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-8">
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
            name="expiresAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expires At</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    disabled={loading}
                    {...field}
                    value={new Date(field.value).toISOString().substring(0, 16)}
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
                    value={String(field.value)} // Convert the value to a string if needed
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
            Save Changes
          </Button>
        </form>
      </Form>
    </>
  );
};
