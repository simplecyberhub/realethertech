import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { formatCurrency, formatCryptoAmount } from "@/lib/utils";

const withdrawalSchema = z.object({
  amount: z.number().min(0.00000001, "Amount must be greater than 0"),
  withdrawalAddress: z.string().min(1, "Withdrawal address is required"),
});

type FormValues = z.infer<typeof withdrawalSchema>;

interface WithdrawModalProps {
  holding: {
    id: number;
    amount: string;
    coin: {
      id: number;
      name: string;
      symbol: string;
      price: string;
      isLocked?: boolean;
    };
  };
  isOpen: boolean;
  onClose: () => void;
}

export function WithdrawModal({
  holding,
  isOpen,
  onClose,
}: WithdrawModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amount: 0,
      withdrawalAddress: "",
    },
  });

  const amount = form.watch("amount");
  const totalValue = amount ? amount * Number(holding.coin.price) : 0;
  const maxAmount = parseFloat(holding.amount);
  const isCoinLocked = holding.coin.isLocked;

  const withdrawMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("POST", "/api/portfolio/withdraw", {
        coinId: holding.coin.id,
        amount: data.amount,
        withdrawalAddress: data.withdrawalAddress,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      toast({
        title: "Withdrawal Submitted",
        description: "Your withdrawal request has been submitted and will be processed within 24-48 hours.",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message || "Failed to submit withdrawal request",
        variant: "destructive",
      });
    },
  });

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      await withdrawMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleMaxClick = () => {
    form.setValue("amount", maxAmount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw {holding.coin.symbol}</DialogTitle>
          <DialogDescription>
            Submit a withdrawal request for your {holding.coin.name}
          </DialogDescription>
        </DialogHeader>

        {isCoinLocked ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              The selected cryptocurrency is currently locked and cannot be
              withdrawn at this time. Please try again after the lock period has
              expired.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              All Withdrawals require manual verification and may take 24-48
              hours to process.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            style={{ opacity: isCoinLocked ? 0.6 : 1 }}
          >
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Available Balance:</span>
                <span>
                  {formatCryptoAmount(holding.amount, holding.coin.symbol)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Current Price:</span>
                <span>{formatCurrency(Number(holding.coin.price))}</span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Withdraw</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        disabled={isCoinLocked}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isCoinLocked}
                        onClick={handleMaxClick}
                      >
                        Max
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Maximum:{" "}
                    {formatCryptoAmount(holding.amount, holding.coin.symbol)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="withdrawalAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Withdrawal Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your wallet address"
                      disabled={isCoinLocked}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the wallet address where you want to receive your{" "}
                    {holding.coin.symbol}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {amount > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Withdrawal Amount:</span>
                    <span>
                      {formatCryptoAmount(
                        amount.toString(),
                        holding.coin.symbol,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Value:</span>
                    <span>{formatCurrency(totalValue)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  amount <= 0 ||
                  amount > maxAmount ||
                  isCoinLocked
                }
                className="flex-1"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isCoinLocked ? "Withdrawal Locked" : "Submit Withdrawal"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
