import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { PriceChange } from "@/components/ui/price-change";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortfolioValue, calculatePortfolioChange, getBestPerformingAsset, formatCurrency } from "@/lib/utils";
import { Wallet, PieChart, TrendingUp } from "lucide-react";
import type { User } from "@/App";

interface SummaryCardsProps {
  user: User | null;
}

export function SummaryCards({ user }: SummaryCardsProps) {
  const { data: holdings = [], isLoading } = useQuery({
    queryKey: ["/api/portfolio"],
    enabled: !!user,
  });
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  const portfolioValue = getPortfolioValue(holdings);
  const portfolioChange = calculatePortfolioChange(holdings);
  const bestAsset = getBestPerformingAsset(holdings);
  
  // Default values for non-authenticated users
  const displayValue = user ? formatCurrency(portfolioValue) : "$0.00";
  const displayChange = user ? portfolioChange : 0;
  const displayAssetCount = user ? holdings.length : 0;
  const displayBestAsset = user && bestAsset ? bestAsset.coin.name : "None";
  const displayBestAssetChange = user && bestAsset ? bestAsset.coin.change24h : 0;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Portfolio Value</h3>
            <Wallet className="text-primary-500 h-5 w-5" />
          </div>
          <p className="text-2xl font-semibold text-gray-900 mt-2">{displayValue}</p>
          <div className="mt-2 flex items-center text-sm">
            <PriceChange change={displayChange} suffix="%" />
            <span className="text-gray-500 ml-1">total</span>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Assets</h3>
            <PieChart className="text-primary-500 h-5 w-5" />
          </div>
          <p className="text-2xl font-semibold text-gray-900 mt-2">{displayAssetCount}</p>
          <div className="mt-2 text-sm text-gray-500">
            Different cryptocurrencies
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Best Performing</h3>
            <TrendingUp className={bestAsset ? "text-green-500 h-5 w-5" : "text-gray-500 h-5 w-5"} />
          </div>
          <p className="text-2xl font-semibold text-gray-900 mt-2">{displayBestAsset}</p>
          <div className="mt-2 flex items-center text-sm">
            <PriceChange change={displayBestAssetChange} suffix="%" />
            <span className="text-gray-500 ml-1">24h</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
