import React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatLargeNumber } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Coins, BarChart3, TrendingUp } from "lucide-react";

// Transaction type definition
type Transaction = {
  id: number;
  type: string;
  amount: string;
  totalValue: string;
  status: string;
  createdAt: string;
  coinSymbol: string;
  username: string;
};

// Stats type definition
type DashboardStats = {
  totalUsers: number;
  activeCoins: number;
  totalTransactions: number;
  totalVolume: number;
  pendingTransactions?: number;
  recentTransactions: Transaction[];
};

export function AdminDashboard() {
  const { toast } = useToast();

  const { data: dashboardData, isLoading, error } = useQuery<{ stats: DashboardStats }>({
    queryKey: ["/api/admin/dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/admin/dashboard", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      return await response.json();
    },
    retry: false,
  });

  const handleExportDatabase = async () => {
    try {
      const response = await fetch("/api/admin/export", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to export database");
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || "database_export.json";

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Database exported",
        description: "Database schema and data have been downloaded successfully.",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export database. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle error with useEffect instead of onError
  React.useEffect(() => {
    if (error) {
      toast({
        title: "Failed to load dashboard data",
        description: (error as Error)?.message || "An error occurred while fetching the dashboard data.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          <p className="font-medium">Failed to load dashboard data</p>
          <p className="text-sm">{(error as Error)?.message || "Please try again later."}</p>
        </div>
      </div>
    );
  }

  const { stats } = dashboardData;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your platform's performance and statistics.
          </p>
        </div>
        <Button onClick={handleExportDatabase} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Database
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coins</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCoins}</div>
            <p className="text-xs text-muted-foreground">Available for trading</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTransactions}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalVolume)}</div>
            <p className="text-xs text-muted-foreground">Platform trading volume</p>
          </CardContent>
        </Card>

        <Card className={stats.pendingTransactions && stats.pendingTransactions > 0 ? "border-orange-200 bg-orange-50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Transactions</CardTitle>
            <div className={`h-4 w-4 ${stats.pendingTransactions && stats.pendingTransactions > 0 ? "text-orange-600" : "text-muted-foreground"}`}>⏱️</div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.pendingTransactions && stats.pendingTransactions > 0 ? "text-orange-600" : ""}`}>
              {stats.pendingTransactions || 0}
            </div>
            {stats.pendingTransactions && stats.pendingTransactions > 0 ? (
              <p className="text-xs text-orange-600 mt-1">Requires attention</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">All approved</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>The latest transactions across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentTransactions.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No transactions yet</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground">
                <div>USER</div>
                <div>COIN</div>
                <div>AMOUNT</div>
                <div className="text-right">VALUE</div>
              </div>

              {stats.recentTransactions.map((transaction) => (
                <div key={transaction.id} className="grid grid-cols-4 items-center">
                  <div className="font-medium">{transaction.username}</div>
                  <div>
                    <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                      {transaction.coinSymbol}
                    </span>
                    <span className="ml-2 text-xs capitalize">{transaction.type}</span>
                  </div>
                  <div>{parseFloat(transaction.amount).toFixed(8)}</div>
                  <div className="text-right font-medium">{formatCurrency(parseFloat(transaction.totalValue))}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}