import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { CopyIcon, CheckIcon, ExternalLinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Coin } from "@shared/schema";

const paymentSchema = z.object({
  transactionHash: z.string().min(10, "Please enter a valid transaction hash"),
  senderAddress: z.string().min(10, "Please enter a valid sender address"),
  paymentMethod: z.string(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface PaymentModalProps {
  coin: Coin;
  amount: string;
  totalCost: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirmPayment: (data: PaymentFormValues) => Promise<void>;
}

export function PaymentModal({ 
  coin, 
  amount, 
  totalCost, 
  isOpen, 
  onClose, 
  onConfirmPayment 
}: PaymentModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("payment-options");
  const [paymentMethod, setPaymentMethod] = useState<"USDT" | "SOL">("USDT");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      transactionHash: "",
      senderAddress: "",
      paymentMethod: paymentMethod,
    },
  });

  // Define fixed wallet addresses for USDT and SOL
  const paymentAddresses = {
    "USDT": "0xF7654C23c1F10C5c426dF29C01fC4912b83a4F3E", // USDT on Ethereum/Tron
    "SOL": "5RpUwQ8iqUKKvgxz6zsJ2kLBzxUVsjuPXpNQVpg6hB4U", // Solana
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);

    toast({
      title: "Copied!",
      description: `${type} copied to clipboard.`,
    });

    // Reset copied state after 3 seconds
    setTimeout(() => {
      setCopied(null);
    }, 3000);
  };

  const networkExplorerUrl = (symbol: string) => {
    const explorers = {
      "USDT": "https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7",
      "SOL": "https://solscan.io",
    };

    return explorers[symbol as keyof typeof explorers];
  };

  const selectPaymentMethod = (method: "USDT" | "SOL") => {
    setPaymentMethod(method);
    form.setValue("paymentMethod", method);
    setActiveTab("payment-details");
  };

  // Update payment method when it changes
  useEffect(() => {
    form.setValue("paymentMethod", paymentMethod);
  }, [paymentMethod, form]);

  async function onSubmit(data: PaymentFormValues) {
    setIsLoading(true);
    try {
      await onConfirmPayment(data);
      form.reset();
      onClose();

      toast({
        title: "Payment Submitted",
        description: "Your transaction information has been recorded. The coins will be added to your portfolio once the cryptocurrency payment is verified by our team.",
      });
    } catch (error) {
      console.error("Payment submission error:", error);
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "There was an error submitting your payment. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Purchase with Cryptocurrency</DialogTitle>
          <DialogDescription>
            Select a payment method to buy {amount} {coin.symbol} (${totalCost})
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="payment-options">Payment Options</TabsTrigger>
              <TabsTrigger value="payment-details">Payment Details</TabsTrigger>
              <TabsTrigger value="confirm">Confirm</TabsTrigger>
            </TabsList>

            {/* Step 1: Select payment method */}
            <TabsContent value="payment-options" className="space-y-4 mt-4">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Select Payment Method:</strong> We currently accept USDT and SOL for all crypto payments.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div 
                  className={`rounded-lg border p-4 cursor-pointer hover:border-primary hover:bg-primary-50 transition-colors ${paymentMethod === 'USDT' ? 'border-primary bg-primary-50' : ''}`}
                  onClick={() => selectPaymentMethod('USDT')}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-700 font-bold">$</span>
                    </div>
                    <div>
                      <p className="font-medium">USDT (Tether)</p>
                      <p className="text-xs text-muted-foreground">ERC-20 token on Ethereum network</p>
                    </div>
                  </div>
                </div>

                <div 
                  className={`rounded-lg border p-4 cursor-pointer hover:border-primary hover:bg-primary-50 transition-colors ${paymentMethod === 'SOL' ? 'border-primary bg-primary-50' : ''}`}
                  onClick={() => selectPaymentMethod('SOL')}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-700 font-bold">S</span>
                    </div>
                    <div>
                      <p className="font-medium">SOL (Solana)</p>
                      <p className="text-xs text-muted-foreground">Native Solana blockchain token</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (paymentMethod) {
                      setActiveTab("payment-details");
                    } else {
                      toast({
                        title: "No payment method selected",
                        description: "Please select a payment method to continue",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Continue
                </Button>
              </div>
            </TabsContent>

            {/* Step 2: Payment Details */}
            <TabsContent value="payment-details" className="space-y-4 mt-4">
              <div className="rounded-lg border p-4">
                <div className="flex flex-col space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-1 text-gray-500">Send Exactly</p>
                    <p className="text-lg font-bold">${totalCost} worth of {paymentMethod}</p>
                    <p className="text-sm text-gray-500">(To purchase {amount} {coin.symbol})</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-1 text-gray-500">To This {paymentMethod} Address</p>
                    <div className="flex items-center space-x-2">
                      <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm break-all">
                        {paymentAddresses[paymentMethod]}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => copyToClipboard(paymentAddresses[paymentMethod], "Address")}
                        className="h-8 w-8"
                      >
                        {copied === "Address" ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <p className="text-sm text-gray-500">
                  * After sending, click on "Continue" to enter your transaction details
                </p>
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-gray-500">View {paymentMethod} network explorer:</p>
                  <a 
                    href={networkExplorerUrl(paymentMethod)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 hover:underline"
                  >
                    {networkExplorerUrl(paymentMethod).replace("https://", "")}
                    <ExternalLinkIcon className="ml-1 h-3 w-3" />
                  </a>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab("payment-options")}
                >
                  Back
                </Button>
                <Button onClick={() => setActiveTab("confirm")} className="bg-primary">
                  Continue
                </Button>
              </div>
            </TabsContent>

            {/* Step 3: Confirm Transaction */}
            <TabsContent value="confirm" className="space-y-4 mt-4">
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-800">
                  <strong>Important:</strong> Please ensure you've completed the {paymentMethod} transfer before submitting this form. Your purchase will be manually verified by our team.
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Hidden field to store the payment method */}
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <input type="hidden" {...field} />
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transactionHash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transaction Hash / ID</FormLabel>
                        <FormControl>
                          <Input placeholder={paymentMethod === "USDT" ? "0x1234..." : "5jb3..."} {...field} />
                        </FormControl>
                        <FormDescription>
                          Enter the transaction hash or ID from your {paymentMethod} wallet
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="senderAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your {paymentMethod} Wallet Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Your wallet address" {...field} />
                        </FormControl>
                        <FormDescription>
                          Enter the {paymentMethod} wallet address you sent the payment from
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setActiveTab("payment-details")}
                    >
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium px-6"
                    >
                      {isLoading ? "Processing..." : "Confirm Purchase"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}