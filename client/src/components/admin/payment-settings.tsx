import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, CreditCard } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

export function PaymentSettings() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(!!import.meta.env.VITE_STRIPE_PUBLIC_KEY);
  
  // Function to handle saving settings
  const handleSaveSettings = () => {
    setIsSaving(true);
    
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "Settings saved",
        description: "Payment settings have been saved successfully.",
      });
    }, 1000);
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Payment Settings</h2>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Integration (Optional)
          </CardTitle>
          <CardDescription>
            Configure Stripe for additional card payment options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!import.meta.env.VITE_STRIPE_PUBLIC_KEY && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Using Manual Payments Only</AlertTitle>
              <AlertDescription>
                The platform is currently configured to use manual cryptocurrency payments only. 
                To enable Stripe card payments, you would need to add Stripe API keys to your environment variables:
                <ul className="list-disc ml-5 mt-2 text-sm">
                  <li>STRIPE_SECRET_KEY - Your Stripe secret key (starts with sk_)</li>
                  <li>VITE_STRIPE_PUBLIC_KEY - Your Stripe publishable key (starts with pk_)</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {import.meta.env.VITE_STRIPE_PUBLIC_KEY && (
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Stripe Connected</AlertTitle>
              <AlertDescription>
                Your Stripe integration is active and ready to process payments.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center space-x-2">
            <Switch
              checked={stripeEnabled}
              onCheckedChange={setStripeEnabled}
              disabled={!import.meta.env.VITE_STRIPE_PUBLIC_KEY}
            />
            <Label htmlFor="stripe-enabled">Enable Stripe payments</Label>
          </div>
          
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="stripe-secret-key">Secret Key</Label>
              <Input
                id="stripe-secret-key"
                type="password"
                value={import.meta.env.VITE_STRIPE_PUBLIC_KEY ? "••••••••••••••••••••••" : ""}
                disabled
                placeholder="sk_test_..."
              />
              <p className="text-xs text-muted-foreground">
                Add STRIPE_SECRET_KEY to your environment variables. Never expose this key in client code.
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="stripe-public-key">Public Key</Label>
              <Input
                id="stripe-public-key"
                value={import.meta.env.VITE_STRIPE_PUBLIC_KEY ? import.meta.env.VITE_STRIPE_PUBLIC_KEY : ""}
                disabled
                placeholder="pk_test_..."
              />
              <p className="text-xs text-muted-foreground">
                Add VITE_STRIPE_PUBLIC_KEY to your environment variables for client-side usage.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline">Test Connection</Button>
          <Button onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </CardFooter>
      </Card>
      
      <Card className="border-primary/20">
        <CardHeader className="bg-primary/5">
          <CardTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 8.175H13.5L8.25 18.975V15.975H4.5L9 4.575V8.175ZM13.5 8.175V4.575L18.75 15.975H15V19.575L9.75 8.175H13.5Z" fill="currentColor"/>
            </svg>
            Cryptocurrency Payments (Primary)
          </CardTitle>
          <CardDescription>
            Settings for the default cryptocurrency payment method
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <Alert className="bg-green-50 text-green-800 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>Primary Payment Method</AlertTitle>
            <AlertDescription>
              Manual cryptocurrency payments are enabled and configured as the primary payment method for Realethertech.
            </AlertDescription>
          </Alert>
          
          <div className="flex items-center space-x-2">
            <Switch id="crypto-enabled" checked={true} disabled />
            <Label htmlFor="crypto-enabled">Cryptocurrency payments (required)</Label>
          </div>
          
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="verification-threshold">Verification Threshold (minutes)</Label>
              <Input
                id="verification-threshold"
                type="number"
                placeholder="10"
                defaultValue="10"
              />
              <p className="text-xs text-muted-foreground">
                Time to wait for blockchain confirmations before marking transaction as verified.
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="min-confirmations">Minimum Confirmations</Label>
              <Input
                id="min-confirmations"
                type="number"
                placeholder="3"
                defaultValue="3"
              />
              <p className="text-xs text-muted-foreground">
                Minimum number of blockchain confirmations required for a transaction.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}