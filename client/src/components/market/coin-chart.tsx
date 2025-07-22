import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface CoinChartProps {
  symbol: string;
}

interface ChartDataPoint {
  timestamp: number;
  value: number;
}

interface ChartData {
  symbol: string;
  coinId: string;
  days: number;
  prices: ChartDataPoint[];
}

export function CoinChart({ symbol }: CoinChartProps) {
  const [timeRange, setTimeRange] = useState('7');
  const [dataSource, setDataSource] = useState<'api' | 'simulated' | null>(null);
  
  const { data: chartData, isLoading, error } = useQuery<ChartData>({
    queryKey: ['/api/market/chart', symbol, timeRange],
    queryFn: async ({ queryKey }) => {
      const [_path, symbol, days] = queryKey;
      const response = await fetch(`/api/market/chart/${symbol}?days=${days}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }
      
      // Check if the data is simulated (from the header)
      const source = response.headers.get('X-Data-Source');
      setDataSource(source === 'simulated' ? 'simulated' : 'api');
      
      return response.json();
    },
    enabled: !!symbol,
    refetchInterval: 60000, // Refresh every minute
  });

  // Generate chart 
  const generateChart = () => {
    if (!chartData || !chartData.prices || chartData.prices.length === 0) {
      return null;
    }

    // Format the timestamps to be human-readable dates
    const formattedData = chartData.prices.map(point => ({
      date: new Date(point.timestamp).toLocaleDateString(),
      price: point.value
    }));

    // Find min and max price for y-axis
    const minPrice = Math.min(...formattedData.map(d => d.price)) * 0.99;
    const maxPrice = Math.max(...formattedData.map(d => d.price)) * 1.01;
    
    // Calculate data for the SVG path
    const width = 600;
    const height = 300;
    const padding = 40;
    
    // Map data points to SVG coordinates
    const points = formattedData.map((point, i) => {
      const x = padding + (i / (formattedData.length - 1)) * (width - padding * 2);
      const y = height - padding - ((point.price - minPrice) / (maxPrice - minPrice)) * (height - padding * 2);
      return [x, y];
    });
    
    // Generate the path
    const pathData = points.map((point, i) => 
      (i === 0 ? 'M' : 'L') + point[0] + ',' + point[1]
    ).join(' ');
    
    // Calculate if trend is up or down
    const firstPrice = formattedData[0].price;
    const lastPrice = formattedData[formattedData.length - 1].price;
    const priceChange = lastPrice - firstPrice;
    const percentChange = (priceChange / firstPrice) * 100;
    const trendColor = priceChange >= 0 ? '#22c55e' : '#ef4444';
    
    return (
      <div className="mt-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-lg font-semibold">{formatCurrency(lastPrice)}</div>
            <div className={`text-sm ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {priceChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {formattedData[0].date} - {formattedData[formattedData.length - 1].date}
          </div>
        </div>
        
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mt-2">
          {/* Path for the line */}
          <path 
            d={pathData} 
            fill="none" 
            stroke={trendColor} 
            strokeWidth="2"
          />
          
          {/* Add a gradient fill under the line */}
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={trendColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
          </linearGradient>
          
          <path 
            d={`${pathData} L${points[points.length-1][0]},${height-padding} L${points[0][0]},${height-padding} Z`} 
            fill="url(#gradient)" 
          />
        </svg>
      </div>
    );
  };
  
  // Handle time range change
  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{symbol} Price Chart</CardTitle>
              {dataSource === 'simulated' && (
                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                  Simulated Data
                </span>
              )}
            </div>
            <CardDescription>
              {dataSource === 'simulated' 
                ? "API rate limit exceeded, showing market trend simulation based on current price"
                : "Historical price data"}
            </CardDescription>
          </div>
          <Select value={timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">24 Hours</SelectItem>
              <SelectItem value="7">7 Days</SelectItem>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="90">3 Months</SelectItem>
              <SelectItem value="365">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-[300px] text-red-500">
            Error loading chart data
          </div>
        ) : (
          generateChart()
        )}
      </CardContent>
    </Card>
  );
}