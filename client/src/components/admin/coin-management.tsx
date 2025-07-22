import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import { PriceChange } from "@/components/ui/price-change";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatLargeNumber } from "@/lib/utils";
import type { Coin } from "@shared/schema";
import {
  Badge,
  Check,
  X,
  Trash2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Download, RefreshCw, Plus } from "lucide-react";

export function CoinManagement() {
  const { toast } = useToast();
  const [coinToDelete, setCoinToDelete] = useState<Coin | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: coins = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/coins"],
    queryFn: async () => {
      const response = await fetch("/api/coins", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch coins");
      }
      return await response.json();
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/coins/${id}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coins"] });
      toast({
        title: "Status updated",
        description: "The coin status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update status",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const toggleLockMutation = useMutation({
    mutationFn: async ({ id, isLocked }: { id: number; isLocked: boolean }) => {
      await apiRequest("PATCH", `/api/coins/${id}/toggle-lock`, { isLocked });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coins"] });
      toast({
        title: "Lock status updated",
        description: "The coin lock status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update lock status",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteCoinMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/coins/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coins"] });
      toast({
        title: "Coin deleted",
        description: "The coin has been deleted successfully.",
      });
      setCoinToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to delete coin",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSyncTopCoins = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const response = await fetch('/api/market/sync-top-coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to sync coins');
      }

      const result = await response.json();
      toast({
        title: "Sync Complete",
        description: `Added ${result.added} new coins, updated ${result.updated} existing coins`,
      });

      // Refresh the coins list
      refetch();
    } catch (error) {
      console.error('Error syncing coins:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync coins from CoinGecko. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncDeFiCoins = async () => {
    if (isSyncing) return;

    const confirmed = window.confirm(
      "This will sync DeFi cryptocurrencies from CoinGecko. This may take a few minutes. Are you sure you want to continue?"
    );

    if (!confirmed) return;

    setIsSyncing(true);
    try {
      const response = await fetch('/api/market/sync-defi-coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to sync DeFi coins');
      }

      const result = await response.json();
      toast({
        title: "DeFi Sync Complete",
        description: `Processed ${result.total} DeFi coins: Added ${result.added} new, updated ${result.updated} existing, ${result.errors} errors`,
      });

      // Refresh the coins list
      refetch();
    } catch (error) {
      console.error('Error syncing DeFi coins:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync DeFi coins from CoinGecko. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncAllCoins = async () => {
    if (isSyncing) return;

    const confirmed = window.confirm(
      "This will sync ALL cryptocurrencies (16,000+) from CoinGecko. This process may take several minutes. Are you sure you want to continue?"
    );

    if (!confirmed) return;

    setIsSyncing(true);
    try {
      const response = await fetch('/api/market/sync-all-coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to sync all coins');
      }

      const result = await response.json();
      toast({
        title: "Comprehensive Sync Complete",
        description: `Processed ${result.total} coins: Added ${result.added} new, updated ${result.updated} existing, ${result.errors} errors`,
      });

      // Refresh the coins list
      refetch();
    } catch (error) {
      console.error('Error syncing all coins:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync all coins from CoinGecko. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddSpecificCoins = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/market/add-specific-coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to add specific coins');
      }

      const result = await response.json();
      toast({
        title: "Specific Coins Added",
        description: `Added ${result.added} new coins, updated ${result.updated} existing. HXAI, HLIX, and VONE are now available.`,
      });

      // Refresh the coins list
      refetch();
    } catch (error) {
      console.error('Error adding specific coins:', error);
      toast({
        title: "Add Failed",
        description: "Failed to add specific coins. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const columns = [
    {
      header: "Coin",
      accessorKey: "name",
      cell: (row: Coin) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <img
              className="h-10 w-10 rounded-full"
              src={row.logoUrl || `https://cryptologos.cc/logos/${row.name.toLowerCase()}-${row.symbol.toLowerCase()}-logo.png`}
              alt={row.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://placehold.co/200x200/gray/white?text=" + row.symbol;
              }}
            />
          </div>
          <div className="ml-4">
            <div className="font-medium text-gray-900">{row.name}</div>
            <div className="text-sm text-gray-500">{row.symbol}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Price",
      accessorKey: (row: Coin) => formatCurrency(row.price),
    },
    {
      header: "24h Change",
      accessorKey: "change24h",
      cell: (row: Coin) => <PriceChange change={row.change24h || 0} />,
    },
    {
      header: "Market Cap",
      accessorKey: (row: Coin) => formatLargeNumber(row.marketCap || 0),
    },
    {
      header: "Status",
      accessorKey: "isActive",
      cell: (row: Coin) => (
        <Badge variant={row.isActive ? "success" : "secondary"} className="px-2 py-1">
          {row.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: Coin) => (
        <div className="flex justify-end space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className={row.isActive ? "text-red-600 hover:text-red-800" : "text-blue-600 hover:text-blue-800"}
            onClick={() => toggleStatusMutation.mutate({ id: row.id, isActive: !row.isActive })}
            disabled={toggleStatusMutation.isPending}
          >
            {row.isActive ? (
              <>
                <X className="w-4 h-4 mr-1" /> Disable
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-1" /> Enable
              </>
            )}
          </Button>

          {!row.isDefault && (
            <AlertDialog open={coinToDelete?.id === row.id} onOpenChange={(open) => !open && setCoinToDelete(null)}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-800"
                  onClick={() => setCoinToDelete(row)}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Coin</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {row.name} ({row.symbol})? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => deleteCoinMutation.mutate(row.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <div>Loading coins...</div>;
  }

  return (
    <>
        <div className="flex justify-end space-x-2">
          <Button 
            onClick={handleSyncTopCoins}
            disabled={isSyncing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing Top 250...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Sync Top 250 from CoinGecko
              </>
            )}
          </Button>

          <Button 
            onClick={handleSyncDeFiCoins}
            disabled={isSyncing}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing DeFi Coins...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Sync DeFi Coins (250+)
              </>
            )}
          </Button>

          <Button 
            onClick={handleSyncAllCoins}
            disabled={isSyncing}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing All Coins...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Sync ALL Coins (16,000+)
              </>
            )}
          </Button>

          <Button 
            onClick={handleAddSpecificCoins}
            disabled={isSyncing}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add HXAI, HLIX, VONE
              </>
            )}
          </Button>
        </div>

        <DataTable
          data={coins}
          columns={columns}
          searchable
          searchKeys={["name", "symbol"]}
        />
    </>
  );
}