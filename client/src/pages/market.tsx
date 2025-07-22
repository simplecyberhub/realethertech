import { useState } from "react";
import { CoinTable } from "@/components/market/coin-table";
import { CoinChart } from "@/components/market/coin-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@/App";

interface MarketProps {
  user: User | null;
}

export default function Market({ user }: MarketProps) {
  const [selectedCoinSymbol, setSelectedCoinSymbol] = useState<string>("BTC");
  const queryClient = useQueryClient();
  
  // Track when the last update happened
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Function to refresh market data
  const refreshMarketData = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/market/prices"],
    });
    setLastUpdate(new Date());
  };
  
  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Cryptocurrency Market</h2>
          <p className="text-sm text-gray-500">
            Explore, analyze, and purchase cryptocurrencies with real-time market data.
          </p>
        </div>
        <Button 
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
          onClick={refreshMarketData}
        >
          <RefreshCw className="h-4 w-4" /> 
          <span>Refresh Data</span>
        </Button>
      </div>
      
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Now with full CoinGecko integration!</h3>
            <div className="mt-1 text-sm text-blue-700">
              <p>Access live data for over 16,000 cryptocurrencies. Use the search box to find any coin by name or symbol.</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground mb-6">
        Last updated: {lastUpdate.toLocaleTimeString()}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <CoinChart symbol={selectedCoinSymbol} />
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border">
          <h3 className="text-lg font-medium mb-4">Market Highlights</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Total Cryptocurrencies</p>
              <p className="text-2xl font-bold">16,900+</p>
            </div>
            <div>
              <p className="text-sm font-medium">Available for Trading</p>
              <p className="text-2xl font-bold">All Coins</p>
            </div>
            <div>
              <p className="text-sm font-medium">Payment Methods</p>
              <p className="text-2xl font-bold">USDT & SOL</p>
            </div>
          </div>
        </div>
      </div>
      
      <Tabs defaultValue="all-coins" className="mb-6">
        <TabsList>
          <TabsTrigger value="all-coins">All Coins</TabsTrigger>
          <TabsTrigger value="stablecoins">Stablecoins</TabsTrigger>
          <TabsTrigger value="defi">DeFi</TabsTrigger>
        </TabsList>
        <TabsContent value="all-coins" className="mt-4">
          <CoinTable 
            user={user} 
            onSelectCoin={(symbol) => setSelectedCoinSymbol(symbol)}
          />
        </TabsContent>
        <TabsContent value="stablecoins" className="mt-4">
          <div className="text-center py-4">
            <p className="text-muted-foreground">Stablecoin filtering will be available soon.</p>
          </div>
        </TabsContent>
        <TabsContent value="defi" className="mt-4">
          <div className="text-center py-4">
            <p className="text-muted-foreground">DeFi token filtering will be available soon.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
