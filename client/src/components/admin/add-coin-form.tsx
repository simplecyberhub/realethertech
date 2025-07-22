import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  symbol: z.string().min(1, "Symbol is required")
    .max(10, "Symbol must be 10 characters or less")
    .toUpperCase(),
  price: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val > 0, "Price must be a positive number")
  ),
  logoUrl: z.string().url("Must be a valid URL").optional().nullable(),
  description: z.string().optional(),
  marketCap: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val > 0, "Market cap must be a positive number").optional().nullable()
  ),
  change24h: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val), "Change must be a number").optional().nullable()
  ),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export function AddCoinForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      symbol: "",
      price: undefined,
      logoUrl: "",
      description: "",
      marketCap: undefined,
      change24h: undefined,
      isActive: true,
    },
  });

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/coins", data);

      // Reset form
      form.reset({
        name: "",
        symbol: "",
        price: undefined,
        logoUrl: "",
        description: "",
        marketCap: undefined,
        change24h: undefined,
        isActive: true,
      });

      // Invalidate coins query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/coins"] });

      toast({
        title: "Success!",
        description: `${data.name} (${data.symbol}) has been added.`,
      });
    } catch (error) {
      console.error("Failed to add coin:", error);
      toast({
        title: "Failed to add coin",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coin Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Bitcoin" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="symbol"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Symbol</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. BTC" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Price (USD)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      placeholder="0.00" 
                      className="pl-7" 
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="change24h"
            render={({ field }) => (
              <FormItem>
                <FormLabel>24h Change (%)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/logo.png" {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>
                URL to the cryptocurrency logo image
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="marketCap"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Market Cap (USD)</FormLabel>
              <FormControl>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <Input 
                    type="number" 
                    step="1" 
                    min="0"
                    placeholder="0" 
                    className="pl-7" 
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Brief description about the cryptocurrency" 
                  className="resize-none" 
                  rows={3}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active Status</FormLabel>
                <FormDescription>
                  Make this coin visible to users immediately
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Coin"}
          </Button>
        </div>
      </form>
    </Form>
  );
}