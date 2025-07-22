import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PriceChange } from "@/components/ui/price-change";
import { Button } from "@/components/ui/button";
import { CryptoChart } from "@/components/ui/crypto-chart";
import { WithdrawModal } from "./withdraw-modal";

interface AssetCardProps {
  name: string;
  symbol: string;
  amount: string;
  value: string;
  change: number;
  logo?: string;
  holding?: {
    id: number;
    amount: string;
    coin: {
      id: number;
      name: string;
      symbol: string;
      price: string;
    };
  };
}

export function AssetCard({
  name,
  symbol,
  amount,
  value,
  change,
  logo,
  holding,
}: AssetCardProps) {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  return (
    <>
      <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200 transform hover:-translate-y-1 transition-transform duration-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <img 
                src={logo || `https://cryptologos.cc/logos/${name.toLowerCase()}-${symbol.toLowerCase()}-logo.png`}
                alt={name}
                className="w-8 h-8 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://placehold.co/200x200/gray/white?text=" + symbol;
                }}
              />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-900">{name}</h3>
                <p className="text-xs text-gray-500">{symbol}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{amount}</p>
              <p className="text-xs text-gray-500">{value}</p>
            </div>
          </div>
          
          <div className="mt-2 h-[60px]">
            <CryptoChart change={change} />
          </div>
          
          <div className="mt-2 flex items-center justify-between">
            <PriceChange change={change} suffix="% (24h)" />
            <div className="flex gap-1">
              <Button variant="link" size="sm" className="text-primary-600 hover:text-primary-800 p-0">
                Buy More
              </Button>
              {holding && (
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-red-600 hover:text-red-800 p-0"
                  onClick={() => setShowWithdrawModal(true)}
                >
                  Withdraw
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {holding && (
        <WithdrawModal
          holding={holding}
          isOpen={showWithdrawModal}
          onClose={() => setShowWithdrawModal(false)}
        />
      )}
    </>
  );
}
