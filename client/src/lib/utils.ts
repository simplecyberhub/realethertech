import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numValue);
}

export function formatLargeNumber(value: number | string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (numValue >= 1_000_000_000) {
    return `$${(numValue / 1_000_000_000).toFixed(1)}B`;
  } else if (numValue >= 1_000_000) {
    return `$${(numValue / 1_000_000).toFixed(1)}M`;
  } else if (numValue >= 1_000) {
    return `$${(numValue / 1_000).toFixed(1)}K`;
  }
  
  return formatCurrency(numValue);
}

export function formatCryptoAmount(value: number | string, symbol: string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return `${numValue.toFixed(numValue < 0.01 ? 6 : 2)} ${symbol}`;
}

export function getPortfolioValue(holdings: any[]): number {
  return holdings.reduce((total, holding) => {
    return total + Number(holding.amount) * Number(holding.coin.price);
  }, 0);
}

export function calculatePortfolioChange(holdings: any[]): number {
  let totalValue = 0;
  let totalPurchaseValue = 0;
  
  holdings.forEach(holding => {
    const currentValue = Number(holding.amount) * Number(holding.coin.price);
    const purchaseValue = Number(holding.amount) * Number(holding.purchasePrice);
    
    totalValue += currentValue;
    totalPurchaseValue += purchaseValue;
  });
  
  if (totalPurchaseValue === 0) return 0;
  
  return ((totalValue - totalPurchaseValue) / totalPurchaseValue) * 100;
}

export function getBestPerformingAsset(holdings: any[]): any | null {
  if (!holdings.length) return null;
  
  return holdings.reduce((best, current) => {
    const bestChange = Number(best.coin.change24h);
    const currentChange = Number(current.coin.change24h);
    
    return currentChange > bestChange ? current : best;
  }, holdings[0]);
}

export function generateRandomChartData(change: number): number[] {
  // Generate 12 data points with a trend matching the change percentage
  const dataPoints = [];
  let value = 100;
  const trend = 1 + (change / 100 / 12); // Distribute the change across 12 points
  
  for (let i = 0; i < 12; i++) {
    // Add some randomness around the trend
    const randomFactor = 0.995 + Math.random() * 0.01;
    value = value * trend * randomFactor;
    dataPoints.push(value);
  }
  
  return dataPoints;
}
