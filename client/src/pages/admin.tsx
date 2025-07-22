import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoinManagement } from "@/components/admin/coin-management";
import { AddCoinForm } from "@/components/admin/add-coin-form";
import { AdminDashboard } from "@/components/admin/dashboard";
import { UserManagement } from "@/components/admin/user-management";
import { TransactionHistory } from "@/components/admin/transaction-history";
import { PaymentSettings } from "@/components/admin/payment-settings";
import { PendingActivities } from "@/components/admin/pending-activities";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ShieldAlert } from "lucide-react";
import type { User } from "@shared/schema";

interface AdminProps {
  user: any | null;
}

export default function Admin({ user }: AdminProps) {
  if (!user) {
    return (
      <div className="px-4 py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You must be logged in to access the admin panel.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Check if user has admin privileges
  if (!(user as any).isAdmin) {
    return (
      <div className="px-4 py-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Admin Access Required</AlertTitle>
          <AlertDescription>
            You need administrator privileges to access this area.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Admin Panel</h2>
        <p className="text-sm text-gray-500">
          Manage and monitor your Realethertech platform
        </p>
      </div>
      
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pending">Pending Activities</TabsTrigger>
          <TabsTrigger value="coins">Manage Coins</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payments">Payment Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="p-4 bg-white rounded-lg shadow">
          <AdminDashboard />
        </TabsContent>
        
        <TabsContent value="pending" className="p-4 bg-white rounded-lg shadow">
          <PendingActivities />
        </TabsContent>
        
        <TabsContent value="coins" className="p-4 bg-white rounded-lg shadow">
          <Tabs defaultValue="manage" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="manage">Manage Existing</TabsTrigger>
              <TabsTrigger value="add">Add New Coin</TabsTrigger>
            </TabsList>
            
            <TabsContent value="manage">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Listed Coins</h3>
              <p className="text-sm text-gray-500 mb-6">
                Enable or disable coins visible to users
              </p>
              
              <CoinManagement />
            </TabsContent>
            
            <TabsContent value="add">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Coin</h3>
              <p className="text-sm text-gray-500 mb-6">
                Manually add a new cryptocurrency to the platform
              </p>
              
              <AddCoinForm />
            </TabsContent>
          </Tabs>
        </TabsContent>
        
        <TabsContent value="users" className="p-4 bg-white rounded-lg shadow">
          <UserManagement />
        </TabsContent>
        
        <TabsContent value="transactions" className="p-4 bg-white rounded-lg shadow">
          <TransactionHistory />
        </TabsContent>
        
        <TabsContent value="payments" className="p-4 bg-white rounded-lg shadow">
          <PaymentSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
