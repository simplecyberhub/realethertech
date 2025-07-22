import { useQuery } from "@tanstack/react-query";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CoinTable } from "@/components/market/coin-table";
import { AssetCard } from "@/components/portfolio/asset-card";
import { formatCryptoAmount, formatCurrency } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import type { User } from "@/App";

interface DashboardProps {
  user: User | null;
}

export default function Dashboard({ user }: DashboardProps) {
  const { data: holdings = [], isLoading: holdingsLoading } = useQuery({
    queryKey: ["/api/portfolio"],
    enabled: !!user,
  });

  const { data: coins = [], isLoading: coinsLoading } = useQuery({
    queryKey: ["/api/coins", { active: true }],
    queryFn: async ({ queryKey }) => {
      const [_path, params] = queryKey;
      const res = await fetch(`/api/coins?active=true`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch coins");
      return res.json();
    },
  });

  const isLoading = holdingsLoading || coinsLoading;
  const topCoins = coins.slice(0, 4);
  const userAssets = holdings.slice(0, 3);

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">
          Welcome back, {user ? user.username : "Guest"}. Here's your crypto overview.
        </p>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="mb-6">
        <SummaryCards user={user} />
      </div>

      {/* Market Overview Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Market Overview</h2>
          <Link href="/market" className="text-sm font-medium text-primary-600 hover:text-primary-800">
            View All
          </Link>
        </div>

        {isLoading ? (
          <div>Loading market data...</div>
        ) : (
          <CoinTable user={user} />
        )}
      </div>

      {/* Your Portfolio Section */}
      {user ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Your Portfolio</h2>
            <Link href="/portfolio" className="text-sm font-medium text-primary-600 hover:text-primary-800">
              View Details
            </Link>
          </div>

          {holdingsLoading ? (
            <div>Loading portfolio data...</div>
          ) : userAssets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userAssets.map((holding) => (
                <AssetCard
                  key={holding.id}
                  name={holding.coin.name}
                  symbol={holding.coin.symbol}
                  amount={formatCryptoAmount(holding.amount, holding.coin.symbol)}
                  value={formatCurrency(Number(holding.amount) * Number(holding.coin.price))}
                  change={Number(holding.coin.change24h)}
                  logo={holding.coin.logoUrl}
                  holding={holding}
                />
              ))}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No portfolio assets</AlertTitle>
              <AlertDescription>
                You haven't purchased any cryptocurrencies yet.
                <Link href="/market" className="ml-2 underline text-primary-600">
                  Buy your first crypto
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication required</AlertTitle>
          <AlertDescription>
            Please log in to view your portfolio
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}