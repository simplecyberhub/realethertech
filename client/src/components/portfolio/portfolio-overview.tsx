import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceChange } from "@/components/ui/price-change";
import { formatCurrency, formatCryptoAmount, getPortfolioValue, calculatePortfolioChange } from "@/lib/utils";
import { AssetCard } from "@/components/portfolio/asset-card";
import { ScreenshotShare } from "@/components/portfolio/screenshot-share";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { User } from "@/App";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Share } from "lucide-react";

interface PortfolioOverviewProps {
  user: User | null;
}

export function PortfolioOverview({ user }: PortfolioOverviewProps) {
  const portfolioRef = useRef<HTMLDivElement>(null);

  const { data: holdings = [], isLoading, error, refetch } = useQuery<any[]>({
    queryKey: ["/api/portfolio"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch portfolio: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!user,
    retry: 3,
    retryDelay: 1000,
  });

  const portfolioValue = getPortfolioValue(holdings);
  const portfolioChange = calculatePortfolioChange(holdings);

  if (!user) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Authentication required</AlertTitle>
        <AlertDescription>
          Please log in to view your portfolio
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load portfolio data. Please try again later.
          <button 
            onClick={() => refetch()} 
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="p-4">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex justify-between mb-4">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-16 w-full mb-2" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No assets</AlertTitle>
        <AlertDescription>
          You haven't purchased any cryptocurrencies yet. Visit the Market tab to buy your first crypto.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Portfolio Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(portfolioValue)}
            </p>
            <PriceChange 
              change={portfolioChange} 
              className="mt-1"
              suffix="% (total)" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{holdings.length}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Different cryptocurrencies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Best Performing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {holdings.length > 0 && (
              <>
                <p className="text-2xl font-semibold">
                  {holdings.reduce((best, current) => {
                    return Number(current.coin.change24h) > Number(best.coin.change24h) ? current : best;
                  }, holdings[0]).coin.name}
                </p>
                <PriceChange 
                  change={holdings.reduce((best, current) => {
                    return Number(current.coin.change24h) > Number(best.coin.change24h) ? current : best;
                  }, holdings[0]).coin.change24h || 0}
                  className="mt-1"
                  suffix="% (24h)"
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Your Holdings</h3>
          <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogTitle>Share Portfolio</DialogTitle>
            <DialogDescription>
              Share a screenshot of your portfolio performance.
            </DialogDescription>
            <ScreenshotShare portfolioValue={portfolioValue} targetRef={portfolioRef}/>
          </DialogContent>
        </Dialog>
        </div>

        <div 
          ref={portfolioRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 screenshot-target-container"
        >
          {holdings.map((holding: any) => (
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
      </div>
    </div>
  );
}