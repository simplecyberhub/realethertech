import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { Coin } from "@shared/schema";
import { PaymentModal } from "./payment-modal";

// Extend the PaymentData type to include paymentMethod
interface PaymentData {
  transactionHash: string;
  senderAddress: string;
  paymentMethod: string;
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Wallet, Bitcoin, CreditCard } from "lucide-react";

interface BuyModalProps {
  coin: Coin;
  isOpen: boolean;
  onClose: () => void;
}

const formSchema = z.object({
  amount: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val > 0, "Amount must be a positive number")
  )
});

type FormValues = z.infer<typeof formSchema>;

export function BuyModal({ coin, isOpen, onClose }: BuyModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "" as any, // Type assertion to handle string in the form but number in the schema
    },
  });

  const amount = form.watch("amount");
  const totalCost = amount ? Number(amount) * Number(coin.price) : 0;

  async function onSubmit(data: FormValues) {
    try {
      // Only cryptocurrency payments are supported
      setShowPaymentModal(true);
    } catch (error) {
      console.error("Error in form submission:", error);
      toast({
        title: "Error Occurred",
        description: "There was a problem processing your request. Please try again.",
        variant: "destructive",
      });
    }
  }

  async function processPayment(transactionDetails?: PaymentData) {
    setIsSubmitting(true);
    try {
      const requestData = {
        coinId: coin.id,
        amount: form.getValues("amount"),
        ...(transactionDetails && { 
          transactionHash: transactionDetails.transactionHash,
          senderAddress: transactionDetails.senderAddress,
          paymentMethod: transactionDetails.paymentMethod
        }),
      };

      await apiRequest("POST", "/api/portfolio/buy", requestData);

      // Invalidate portfolio queries to refresh
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });

      toast({
        title: "Purchase Successful!",
        description: `You've purchased ${amount} ${coin.symbol} for ${formatCurrency(totalCost)}.`,
      });

      onClose();
    } catch (error) {
      console.error("Failed to complete purchase:", error);
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCryptoPaymentConfirm(data: { transactionHash: string; senderAddress: string; paymentMethod: string }) {
    try {
      await processPayment({
        transactionHash: data.transactionHash,
        senderAddress: data.senderAddress,
        paymentMethod: data.paymentMethod
      });
    } catch (error) {
      console.error("Error processing crypto payment:", error);
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Failed to process cryptocurrency payment",
        variant: "destructive",
      });
    }
  }

  return (
    <>
      <Dialog open={isOpen && !showPaymentModal} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-lg font-semibold">
            Buy {coin.symbol}
          </DialogTitle>
          <div className="flex items-center space-x-2 mb-4"></div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount to buy</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">{coin.symbol}</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Total Cost</FormLabel>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <Input
                    type="text"
                    value={totalCost.toFixed(2)}
                    readOnly
                    className="bg-gray-50 pl-7"
                  />
                </div>
              </FormItem>

              <FormItem>
                <FormLabel>Payment Method</FormLabel>
                <div className="flex items-center space-x-2 border rounded-md p-3 bg-primary-50">
                  <Bitcoin className="h-5 w-5 text-primary-600" />
                  <div>
                    <p className="font-medium">Cryptocurrency</p>
                    <p className="text-xs text-muted-foreground">Pay using your crypto wallet</p>
                  </div>
                </div>
              </FormItem>
            </form>
          </Form>

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isSubmitting || !amount || totalCost <= 0}
              className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 text-md"
            >
              {isSubmitting ? "Processing..." : "Buy Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showPaymentModal && (
        <PaymentModal
          coin={coin}
          amount={String(amount)}
          totalCost={totalCost.toFixed(2)}
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onConfirmPayment={handleCryptoPaymentConfirm}
        />
      )}
    </>
  );
}