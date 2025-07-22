import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/ui/data-table";
import { PriceChange } from "@/components/ui/price-change";
import { Button } from "@/components/ui/button";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatLargeNumber } from "@/lib/utils";
import { BuyModal } from "@/components/market/buy-modal";
import { Loader2, Search } from "lucide-react";
import type { Coin } from "@shared/schema";
import type { User } from "@/App";

interface CoinTableProps {
  user: User | null;
  onSelectCoin?: (symbol: string) => void;
}

// Enhanced coin type with live market data
interface CoinWithMarketData extends Coin {
  marketData?: {
    price: string;
    change24h: string;
    marketCap: string;
    volume24h: string;
    high24h: string;
    low24h: string;
    image: string;
    lastUpdated: string;
  };
}

export function CoinTable({ user, onSelectCoin }: CoinTableProps) {
  const [selectedCoin, setSelectedCoin] = useState<CoinWithMarketData | null>(null);
  const [page, setPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const pageSize = 15; // Number of coins per page

  // Use the new market prices endpoint to get live data
  const { data: allCoins = [], isLoading } = useQuery({
    queryKey: ["/api/market/prices", { active: true }],
    queryFn: async ({ queryKey }) => {
      const [_path, params] = queryKey;
      const res = await fetch(`/api/market/prices?active=true`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch market data");
      return res.json() as Promise<CoinWithMarketData[]>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Filter coins based on search term - ensure coins is always treated as an array
  const coinsArray = Array.isArray(allCoins) ? allCoins : [];
  const filteredCoins = coinsArray.filter((coin) => {
    if (!coin) return false;
    const searchLower = searchTerm.toLowerCase();
    return (
      coin.name?.toLowerCase().includes(searchLower) ||
      coin.symbol?.toLowerCase().includes(searchLower)
    );
  });

  // Calculate total pages
  // Ensure filteredCoins is always an array
  const coinsArray2 = Array.isArray(filteredCoins) ? filteredCoins : [];
  const totalPages = Math.ceil(coinsArray2.length / pageSize);

  // Get current page of coins
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const coins = Array.isArray(filteredCoins) ? filteredCoins.slice(startIndex, endIndex) : [];

  // Define column types to fix TypeScript errors
  const columns: Array<{
    header: string;
    accessorKey: keyof CoinWithMarketData | ((row: CoinWithMarketData) => any);
    cell: (row: CoinWithMarketData) => React.ReactNode;
  }> = [
    {
      header: "Coin",
      accessorKey: "name",
      cell: (row: CoinWithMarketData) => (
        <div 
          className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors" 
          onClick={() => {
            if (onSelectCoin) onSelectCoin(row.symbol);
          }}
        >
          <div className="flex-shrink-0 h-10 w-10">
            <img
              className="h-10 w-10 rounded-full"
              src={
                row.marketData?.image || 
                row.logoUrl || 
                `https://cryptologos.cc/logos/${row.name.toLowerCase()}-${row.symbol.toLowerCase()}-logo.png`
              }
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
      accessorKey: "price",
      cell: (row: CoinWithMarketData) => (
        <div className="font-mono font-medium">
          {row.marketData 
            ? (
              <div className="flex flex-col">
                <span>{formatCurrency(row.marketData.price)}</span>
                {row.marketData.lastUpdated && (
                  <span className="text-xs text-gray-500">
                    Updated: {new Date(row.marketData.lastUpdated).toLocaleTimeString()}
                  </span>
                )}
              </div>
            ) 
            : formatCurrency(row.price)
          }
        </div>
      ),
    },
    {
      header: "24h Change",
      accessorKey: "change24h",
      cell: (row: CoinWithMarketData) => (
        <PriceChange 
          change={row.marketData?.change24h 
            ? parseFloat(row.marketData.change24h) 
            : row.change24h || 0
          } 
        />
      ),
    },
    {
      header: "Market Cap",
      accessorKey: "marketCap",
      cell: (row: CoinWithMarketData) => (
        <div>
          {formatLargeNumber(
            row.marketData?.marketCap
              ? parseFloat(row.marketData.marketCap)
              : row.marketCap || 0
          )}
        </div>
      ),
    },
    {
      header: "24h Volume",
      accessorKey: (row: CoinWithMarketData) => row.marketData?.volume24h || "N/A",
      cell: (row: CoinWithMarketData) => (
        <div className="text-gray-600">
          {row.marketData?.volume24h
            ? formatLargeNumber(parseFloat(row.marketData.volume24h))
            : "N/A"
          }
        </div>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: CoinWithMarketData) => (
        <div className="text-right">
          <Button
            variant="default"
            size="sm"
            onClick={() => setSelectedCoin(row)}
            disabled={!user}
            className="bg-green-600 hover:bg-green-700 text-white font-medium"
          >
            Buy {row.symbol}
          </Button>
        </div>
      ),
    },
  ];

  // Handle page changes
  const goToPage = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Create pagination items
  const paginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    // Add first page
    if (page > 3) {
      items.push(
        <PaginationItem key="first">
          <PaginationLink onClick={() => goToPage(1)}>1</PaginationLink>
        </PaginationItem>
      );

      if (page > 4) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <span className="px-4 py-2 text-sm text-muted-foreground">...</span>
          </PaginationItem>
        );
      }
    }

    // Add pages around current page
    const startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => goToPage(i)}
            isActive={i === page}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Add last page
    if (page < totalPages - 2) {
      if (page < totalPages - 3) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <span className="px-4 py-2 text-sm text-muted-foreground">...</span>
          </PaginationItem>
        );
      }

      items.push(
        <PaginationItem key="last">
          <PaginationLink onClick={() => goToPage(totalPages)}>
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page when searching
  };

  return (
    <>
      {isLoading ? (
        <div className="w-full py-10 flex justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading live market data...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center space-x-2 border rounded-md px-3 py-2 w-full max-w-md">
            <Search className="h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search by name or symbol..."
              value={searchTerm}
              onChange={handleSearch}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            />
          </div>

          {/* Total coins info */}
          <div className="text-sm text-muted-foreground">
            {searchTerm ? (
              <span>Showing {filteredCoins.length} results for "{searchTerm}"</span>
            ) : (
              <span>Showing {startIndex + 1}-{Math.min(endIndex, filteredCoins.length)} of {filteredCoins.length} cryptocurrencies</span>
            )}
          </div>

          {/* Table */}
          <DataTable
            data={coins}
            // @ts-ignore - We know the column types are correct, but TypeScript is struggling with the complex types
            columns={columns}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  {page === 1 ? (
                    <span className="flex items-center gap-1 px-2 py-2 text-sm text-muted-foreground">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6"/>
                      </svg>
                      Previous
                    </span>
                  ) : (
                    <PaginationPrevious
                      onClick={() => goToPage(page - 1)}
                    />
                  )}
                </PaginationItem>

                {paginationItems()}

                <PaginationItem>
                  {page === totalPages ? (
                    <span className="flex items-center gap-1 px-2 py-2 text-sm text-muted-foreground">
                      Next
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </span>
                  ) : (
                    <PaginationNext
                      onClick={() => goToPage(page + 1)}
                    />
                  )}
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      {selectedCoin && (
        <BuyModal
          coin={selectedCoin}
          isOpen={!!selectedCoin}
          onClose={() => setSelectedCoin(null)}
        />
      )}
    </>
  );
}