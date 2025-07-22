import axios from 'axios';
import { db } from '../db';
import { coins } from '@shared/schema';
import { eq, or, desc, sql } from 'drizzle-orm';

// CoinGecko API base URL
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

// API key from environment variables (optional)
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

// Helper function to get request headers
function getRequestHeaders() {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = COINGECKO_API_KEY;
  }

  return headers;
}

// Dynamic mapping of coin symbols to CoinGecko IDs
// Will be populated from the API
let symbolToCoingeckoId: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'DOGE': 'dogecoin',
  'ADA': 'cardano',
  'DOT': 'polkadot',
  'AVAX': 'avalanche-2',
  'LINK': 'chainlink',
  'LTC': 'litecoin',
  'MATIC': 'matic-network',
  'TON': 'toncoin',
  'SHIB': 'shiba-inu',
  'DAI': 'dai',
  'UNI': 'uniswap',
  'ATOM': 'cosmos',
  'NEAR': 'near',
  'ALGO': 'algorand',
  'ICP': 'internet-computer',
  'APT': 'aptos',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'GRT': 'the-graph',
  'IMX': 'immutable-x',
  'FIL': 'filecoin',
  'SAND': 'the-sandbox',
  'AXS': 'axie-infinity',
  'RNDR': 'render-token',
  'BAT': 'basic-attention-token',
  'PEPE': 'pepe',
};

// Inverse mapping from CoinGecko ID to symbol
let coinGeckoIdToSymbol: Record<string, string> = {};

// Initialize the inverse mapping
Object.entries(symbolToCoingeckoId).forEach(([symbol, id]) => {
  coinGeckoIdToSymbol[id] = symbol;
});

// Define the return type for coin market data
interface CoinMarketData {
  symbol: string;
  price: string;
  marketCap: string;
  change24h: string;
  lastUpdated: string;
  image: string;
  volume24h: string;
  high24h: string;
  low24h: string;
}

/**
 * Fetches current market data for multiple coins from CoinGecko API
 * Uses batching to avoid URI too large errors and implements rate limiting
 */
export async function fetchCoinMarketData(symbols: string[]): Promise<CoinMarketData[]> {
  try {
    // Limit to maximum 200 coins to avoid overwhelming the API
    const limitedSymbols = symbols.slice(0, 200);
    
    // Filter symbols to only include ones in our mapping
    let knownSymbols = limitedSymbols.filter(symbol => symbolToCoingeckoId[symbol]);

    // If we have very few known symbols, prioritize the most important ones
    if (knownSymbols.length < 50) {
      // Priority coins that should always be included
      const priorityCoins = ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'USDT', 'USDC', 'ADA', 'DOGE', 'MATIC'];
      const priorityKnownCoins = priorityCoins.filter(symbol => 
        limitedSymbols.includes(symbol) && symbolToCoingeckoId[symbol]
      );
      
      // Add other known coins up to a reasonable limit
      const otherKnownCoins = knownSymbols
        .filter(symbol => !priorityCoins.includes(symbol))
        .slice(0, Math.max(0, 100 - priorityKnownCoins.length));
      
      knownSymbols = [...priorityKnownCoins, ...otherKnownCoins];
    }

    if (knownSymbols.length === 0) {
      console.warn('No known coin symbols provided to fetchCoinMarketData');
      return [];
    }

    console.log(`Fetching market data for ${knownSymbols.length} coins`);

    // Map symbols to CoinGecko IDs
    const coinIds = knownSymbols
      .map(symbol => symbolToCoingeckoId[symbol])
      .filter(Boolean); // Remove any undefined values

    // Process coins in smaller batches to avoid URI too large errors and rate limits
    const batchSize = 30; // Further reduced batch size
    const allResults: CoinMarketData[] = [];
    const maxRetries = 2;

    for (let i = 0; i < coinIds.length; i += batchSize) {
      const batchIds = coinIds.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(coinIds.length / batchSize);
      
      let retryCount = 0;
      let success = false;

      while (retryCount <= maxRetries && !success) {
        try {
          console.log(`Processing batch ${batchNumber}/${totalBatches} (${batchIds.length} coins)${retryCount > 0 ? ` - Retry ${retryCount}` : ''}`);
          
          // Make API request for this batch
          const response = await axios.get(`${COINGECKO_API_URL}/coins/markets`, {
            params: {
              vs_currency: 'usd',
              ids: batchIds.join(','),
              order: 'market_cap_desc',
              per_page: batchSize,
              page: 1,
              sparkline: false,
              price_change_percentage: '24h',
            },
            headers: getRequestHeaders(),
            timeout: 15000 // Increased timeout
          });

          if (response.status === 200) {
            // Process the response data for this batch
            const batchResults = response.data.map((coin: any): CoinMarketData => {
              // Find our symbol from the CoinGecko ID
              const symbol = coinGeckoIdToSymbol[coin.id] || coin.symbol.toUpperCase();

              return {
                symbol,
                price: coin.current_price?.toString() || '0',
                marketCap: coin.market_cap?.toString() || '0',
                change24h: coin.price_change_percentage_24h?.toString() || '0',
                lastUpdated: new Date().toISOString(),
                image: coin.image || '',
                volume24h: coin.total_volume?.toString() || '0',
                high24h: coin.high_24h?.toString() || '0',
                low24h: coin.low_24h?.toString() || '0',
              };
            });

            allResults.push(...batchResults);
            success = true;
            console.log(`Batch ${batchNumber}/${totalBatches} completed: ${batchResults.length} coins updated`);
          }
        } catch (batchError: any) {
          retryCount++;
          const errorMessage = batchError?.response?.status === 429 ? 'Rate limited' : batchError?.message || 'Unknown error';
          console.warn(`Batch ${batchNumber}/${totalBatches} failed (attempt ${retryCount}):`, errorMessage);
          
          if (retryCount <= maxRetries) {
            // Exponential backoff for retries
            const delay = Math.pow(2, retryCount) * 2000; // 4s, 8s delays
            console.log(`Waiting ${delay/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Add a delay between successful batches to respect rate limits
      if (success && i + batchSize < coinIds.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between batches
      }
    }

    console.log(`Market data fetch completed: ${allResults.length} coins updated`);
    return allResults;
  } catch (error) {
    console.error('Error fetching coin market data:', error);
    return [];
  }
}

/**
 * Fetches price chart data for a specific coin from CoinGecko API
 * If API fails, returns simulated price data based on the coin's current price
 */
export async function fetchCoinChartData(symbol: string, days: number = 7) {
  try {
    // Check if we have a mapping for this symbol
    let coinId = symbolToCoingeckoId[symbol];

    // If not found, try to refresh our mappings
    if (!coinId) {
      console.log(`No CoinGecko ID found for symbol: ${symbol}, refreshing mappings...`);
      await fetchAllCoins();
      coinId = symbolToCoingeckoId[symbol];

      // If still not found, try to find it by symbol (case insensitive)
      if (!coinId) {
        console.warn(`Still no CoinGecko ID found for symbol: ${symbol}`);
        return generateSimulatedChartData(symbol, days);
      }
    }

    try {
      const response = await axios.get(
        `${COINGECKO_API_URL}/coins/${coinId}/market_chart`, 
        {
          params: {
            vs_currency: 'usd',
            days: days,
            interval: days > 90 ? 'daily' : days > 30 ? '4h' : '1h'
          },
          headers: getRequestHeaders(),
          timeout: 15000 // 15 second timeout
        }
      );

      if (response.status !== 200) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      // Format data for charts
      const prices = response.data.prices.map((price: [number, number]) => ({
        timestamp: price[0],
        value: price[1]
      }));

      return {
        symbol,
        coinId,
        days,
        prices,
        source: 'api'
      };
    } catch (apiError: any) {
      console.warn(`CoinGecko API failed for ${symbol}, using fallback data:`, apiError.message || 'Unknown error');
      return generateSimulatedChartData(symbol, days); 
    }
  } catch (error) {
    console.error(`Error in chart data processing for ${symbol}:`, error);
    return generateSimulatedChartData(symbol, days);
  }
}

/**
 * Generates simulated chart data when API is unavailable
 * Creates realistic-looking price movements based on the coin's metadata
 */
async function generateSimulatedChartData(symbol: string, days: number) {
  try {
    // Get current price and info about the coin from our database
    const coin = await db.select().from(coins).where(eq(coins.symbol, symbol)).limit(1);

    if (!coin || coin.length === 0) {
      console.warn(`No coin found with symbol ${symbol} for generating chart data`);
      return null;
    }

    const baseCoin = coin[0];
    const currentPrice = parseFloat(baseCoin.price);
    const change24h = baseCoin.change24h ? parseFloat(baseCoin.change24h) : 0;

    // Number of data points based on days
    const numPoints = days <= 1 ? 24 : days <= 7 ? days * 24 : days <= 30 ? days * 6 : days;

    // Generate timestamps (every hour for 1 day, every 4 hours for 7 days, daily for longer periods)
    const now = Date.now();
    const interval = days <= 1 ? 3600000 : days <= 7 ? 4 * 3600000 : 24 * 3600000; // in milliseconds

    // Volatility factor depending on coin (Bitcoin is less volatile than altcoins)
    const volatilityFactor = symbol === 'BTC' ? 0.02 : 
                             symbol === 'ETH' ? 0.03 : 
                             ['USDT', 'USDC', 'DAI'].includes(symbol) ? 0.002 : 0.05;

    // Trend direction based on 24h change
    const trendDirection = change24h >= 0 ? 1 : -1;
    const trendStrength = Math.min(Math.abs(change24h) / 10, 0.2) * trendDirection;

    let price = currentPrice;
    const prices = [];

    // Generate data points working backward from current time
    for (let i = 0; i < numPoints; i++) {
      const timestamp = now - (interval * i);

      // Calculate price movement with random walk + trend
      const randomFactor = (Math.random() - 0.5) * volatilityFactor;
      const trendFactor = trendStrength * (1 - (i / numPoints)); // Trend weakens as we go back in time

      // Apply movement, stronger at recent times
      const priceDelta = price * (randomFactor + trendFactor * 0.1);
      price = price - priceDelta; // Going backward in time

      prices.unshift({
        timestamp,
        value: Math.max(price, 0.01) // Ensure price doesn't go below 0.01
      });
    }

    return {
      symbol,
      coinId: symbolToCoingeckoId[symbol] || symbol.toLowerCase(),
      days,
      prices,
      source: 'simulated'
    };
  } catch (error) {
    console.error(`Error generating simulated data for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetches all available coins from CoinGecko and their metadata
 * This will be used to refresh our mapping of symbols to coin IDs
 */
export async function fetchAllCoins() {
  try {
    console.log('Fetching complete coin list from CoinGecko...');
    const response = await axios.get(`${COINGECKO_API_URL}/coins/list`, {
      timeout: 15000 // 15 second timeout
    });

    if (response.status !== 200) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const coinList = response.data;

    // Update our mappings
    for (const coin of coinList) {
      if (coin.symbol && coin.id) {
        // Use uppercase symbol for consistency
        const symbol = coin.symbol.toUpperCase();

        // Only add if we don't already have this symbol mapping
        // or if the existing mapping is for a different coin than Bitcoin, Ethereum, etc.
        // This ensures our preferred mappings don't get overwritten
        if (!symbolToCoingeckoId[symbol] || !Object.values(symbolToCoingeckoId).includes(coin.id)) {
          symbolToCoingeckoId[symbol] = coin.id;
          coinGeckoIdToSymbol[coin.id] = symbol;
        }
      }
    }

    console.log(`Updated coin mappings with ${coinList.length} coins from CoinGecko`);
    return true;
  } catch (error) {
    console.error('Error fetching complete coin list:', error);
    return false;
  }
}

/**
 * Fetches top cryptocurrency market data from CoinGecko by market cap
 */
export async function fetchTopMarketCoins(limit = 250) {
  try {
    console.log(`Fetching top ${limit} cryptocurrencies by market cap from CoinGecko...`);

    // Make multiple calls if needed (100 per page max from CoinGecko)
    const results = [];
    const pages = Math.ceil(limit / 100);

    for (let page = 1; page <= pages; page++) {
      const perPage = page === pages ? (limit % 100 || 100) : 100;

      const response = await axios.get(`${COINGECKO_API_URL}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: perPage,
          page: page,
          sparkline: false,
          price_change_percentage: '24h'
        },
        timeout: 15000 // 15 second timeout
      });

      if (response.status !== 200) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      results.push(...response.data);
    }

    console.log(`Retrieved ${results.length} top cryptocurrencies`);
    return results;
  } catch (error) {
    console.error('Error fetching top market coins:', error);
    return [];
  }
}

/**
 * Syncs top cryptocurrencies from CoinGecko to our database
 */
export async function syncTopCoinsToDatabase(limit = 250) {
  try {
    // First, update our coin ID mappings
    await fetchAllCoins();

    // Fetch top cryptocurrencies
    const topCoins = await fetchTopMarketCoins(limit);

    if (topCoins.length === 0) {
      console.warn('No top cryptocurrencies fetched from CoinGecko');
      return { added: 0, updated: 0, errors: 0 };
    }

    let added = 0;
    let updated = 0;
    let errors = 0;

    // Get existing coins for efficient comparison
    const existingCoins = await db.select().from(coins);
    const existingSymbols = new Set(existingCoins.map(c => c.symbol));

    // Process each top coin
    for (const coin of topCoins) {
      try {
        const symbol = coin.symbol.toUpperCase();
        // Store the CoinGecko ID mapping if we don't have it
        if (!symbolToCoingeckoId[symbol]) {
          symbolToCoingeckoId[symbol] = coin.id;
          coinGeckoIdToSymbol[coin.id] = symbol;
        }

        const coinData = {
          name: coin.name,
          symbol: symbol,
          description: `${coin.name} (${symbol}) is one of the top cryptocurrencies by market capitalization.`,
          price: coin.current_price.toString(),
          marketCap: coin.market_cap.toString(),
          change24h: coin.price_change_percentage_24h?.toString() || '0',
          isActive: true,
          logoUrl: coin.image,
          metadata: {
            coingeckoId: coin.id,
            lastPriceUpdate: new Date().toISOString(),
            image: coin.image,
            volume24h: coin.total_volume.toString(),
            high24h: coin.high_24h.toString(),
            low24h: coin.low_24h.toString(),
            rank: coin.market_cap_rank.toString()
          }
        };

        if (existingSymbols.has(symbol)) {
          // Update existing coin
          await db.update(coins)
            .set(coinData)
            .where(eq(coins.symbol, symbol));
          updated++;
        } else {
          // Add new coin
          await db.insert(coins).values(coinData);
          added++;
        }
      } catch (error) {
        console.error(`Error processing coin ${coin.symbol}:`, error);
        errors++;
      }
    }

    console.log(`Sync complete: ${added} coins added, ${updated} coins updated, ${errors} errors`);
    return { added, updated, errors };
  } catch (error) {
    console.error('Error syncing top coins to database:', error);
    return { added: 0, updated: 0, errors: -1 };
  }
}

/**
 * Syncs DeFi cryptocurrencies from CoinGecko to our database
 */
export async function syncDeFiCoinsFromCoinGecko() {
  try {
    console.log('Starting DeFi cryptocurrency import from CoinGecko...');

    // First, update our coin ID mappings
    await fetchAllCoins();

    // Get DeFi coins from CoinGecko using the markets endpoint with DeFi category
    const response = await axios.get(`${COINGECKO_API_URL}/coins/markets`, {
      params: {
        vs_currency: 'usd',
        category: 'decentralized-finance-defi',
        order: 'market_cap_desc',
        per_page: 250, // Get top 250 DeFi coins
        page: 1,
        sparkline: false,
        price_change_percentage: '24h',
      },
      headers: getRequestHeaders(),
      timeout: 30000
    });

    if (response.status !== 200) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const defiCoins = response.data;
    console.log(`Found ${defiCoins.length} DeFi cryptocurrencies on CoinGecko`);

    let totalAdded = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    // Get existing coins for efficient comparison
    const existingCoins = await db.select().from(coins);
    const existingSymbols = new Set(existingCoins.map(c => c.symbol.toUpperCase()));

    // Process each DeFi coin
    for (const coin of defiCoins) {
      try {
        const symbol = coin.symbol.toUpperCase();

        // Update our mapping
        symbolToCoingeckoId[symbol] = coin.id;
        coinGeckoIdToSymbol[coin.id] = symbol;

        const coinData = {
          name: coin.name,
          symbol: symbol,
          description: `${coin.name} (${symbol}) - A DeFi cryptocurrency available for trading.`,
          price: coin.current_price !== null ? coin.current_price.toString() : '0',
          marketCap: coin.market_cap !== null ? coin.market_cap.toString() : '0',
          change24h: coin.price_change_percentage_24h !== null ? coin.price_change_percentage_24h.toString() : '0',
          isActive: true,
          logoUrl: coin.image || null,
          metadata: {
            coingeckoId: coin.id,
            lastPriceUpdate: new Date().toISOString(),
            image: coin.image || null,
            volume24h: coin.total_volume !== null ? coin.total_volume.toString() : '0',
            high24h: coin.high_24h !== null ? coin.high_24h.toString() : '0',
            low24h: coin.low_24h !== null ? coin.low_24h.toString() : '0',
            rank: coin.market_cap_rank !== null ? coin.market_cap_rank.toString() : '999999',
            category: 'defi'
          }
        };

        if (existingSymbols.has(symbol)) {
          // Update existing coin
          await db.update(coins)
            .set(coinData)
            .where(eq(coins.symbol, symbol));
          totalUpdated++;
        } else {
          // Add new coin
          await db.insert(coins).values(coinData);
          totalAdded++;
          existingSymbols.add(symbol);
        }

      } catch (coinError) {
        console.error(`Error processing DeFi coin ${coin.symbol}:`, coinError);
        totalErrors++;
      }
    }

    console.log(`DeFi sync complete: ${totalAdded} coins added, ${totalUpdated} coins updated, ${totalErrors} errors`);
    return { added: totalAdded, updated: totalUpdated, errors: totalErrors, total: defiCoins.length };

  } catch (error) {
    console.error('Error in DeFi cryptocurrency sync:', error);
    return { added: 0, updated: 0, errors: -1, total: 0 };
  }
}

/**
 * Syncs ALL cryptocurrencies from CoinGecko to our database (comprehensive import)
 */
export async function syncAllCoinsFromCoinGecko() {
  try {
    console.log('Starting comprehensive cryptocurrency import from CoinGecko...');

    // First, update our coin ID mappings
    await fetchAllCoins();

    // Get the complete list of coins from CoinGecko
    const response = await axios.get(`${COINGECKO_API_URL}/coins/list`, {
      headers: getRequestHeaders(),
      timeout: 30000 // 30 second timeout
    });

    if (response.status !== 200) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const allCoins = response.data;
    console.log(`Found ${allCoins.length} cryptocurrencies on CoinGecko`);

    // Process coins in batches to avoid API limits and database timeouts
    const batchSize = 100;
    const batches = Math.ceil(allCoins.length / batchSize);

    let totalAdded = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    // Get existing coins for efficient comparison
    const existingCoins = await db.select().from(coins);
    const existingSymbols = new Set(existingCoins.map(c => c.symbol.toUpperCase()));

    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, allCoins.length);
      const batch = allCoins.slice(startIndex, endIndex);

      console.log(`Processing batch ${batchIndex + 1}/${batches} (coins ${startIndex + 1}-${endIndex})`);

      // Get market data for this batch
      const coinIds = batch.map(coin => coin.id);

      try {
        const marketResponse = await axios.get(`${COINGECKO_API_URL}/coins/markets`, {
          params: {
            vs_currency: 'usd',
            ids: coinIds.join(','),
            order: 'market_cap_desc',
            per_page: batchSize,
            page: 1,
            sparkline: false,
            price_change_percentage: '24h',
          },
          headers: getRequestHeaders(),
          timeout: 30000
        });

        const marketData = marketResponse.data;

        // Process each coin in the batch
        for (const coin of batch) {
          try {
            const symbol = coin.symbol.toUpperCase();
            const marketInfo = marketData.find(m => m.id === coin.id);

            // Update our mapping
            symbolToCoingeckoId[symbol] = coin.id;
            coinGeckoIdToSymbol[coin.id] = symbol;

            const coinData = {
              name: coin.name,
              symbol: symbol,
              description: `${coin.name} (${symbol}) - A cryptocurrency available for trading.`,
              price: marketInfo && marketInfo.current_price !== null ? marketInfo.current_price.toString() : '0',
              marketCap: marketInfo && marketInfo.market_cap !== null ? marketInfo.market_cap.toString() : '0',
              change24h: marketInfo && marketInfo.price_change_percentage_24h !== null ? marketInfo.price_change_percentage_24h.toString() : '0',
              isActive: true,
              logoUrl: marketInfo && marketInfo.image ? marketInfo.image : null,
              metadata: {
                coingeckoId: coin.id,
                lastPriceUpdate: new Date().toISOString(),
                image: marketInfo && marketInfo.image ? marketInfo.image : null,
                volume24h: marketInfo && marketInfo.total_volume !== null ? marketInfo.total_volume.toString() : '0',
                high24h: marketInfo && marketInfo.high_24h !== null ? marketInfo.high_24h.toString() : '0',
                low24h: marketInfo && marketInfo.low_24h !== null ? marketInfo.low_24h.toString() : '0',
                rank: marketInfo && marketInfo.market_cap_rank !== null ? marketInfo.market_cap_rank.toString() : '999999'
              }
            };

            if (existingSymbols.has(symbol)) {
              // Update existing coin
              await db.update(coins)
                .set(coinData)
                .where(eq(coins.symbol, symbol));
              totalUpdated++;
            } else {
              // Add new coin
              await db.insert(coins).values(coinData);
              totalAdded++;
              existingSymbols.add(symbol); // Add to set to prevent future duplicates
            }

          } catch (coinError) {
            console.error(`Error processing coin ${coin.symbol}:`, coinError);
            totalErrors++;
          }
        }

      } catch (batchError) {
        console.error(`Error processing batch ${batchIndex + 1}:`, batchError);
        totalErrors += batch.length;
      }

      // Wait between batches to avoid rate limits
      if (batchIndex < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }

      // Log progress every 10 batches
      if ((batchIndex + 1) % 10 === 0) {
        console.log(`Progress: ${batchIndex + 1}/${batches} batches completed. Added: ${totalAdded}, Updated: ${totalUpdated}, Errors: ${totalErrors}`);
      }
    }

    console.log(`Comprehensive sync complete: ${totalAdded} coins added, ${totalUpdated} coins updated, ${totalErrors} errors`);
    return { added: totalAdded, updated: totalUpdated, errors: totalErrors, total: allCoins.length };

  } catch (error) {
    console.error('Error in comprehensive cryptocurrency sync:', error);
    return { added: 0, updated: 0, errors: -1, total: 0 };
  }
}

/**
 * Updates active coins in our database with the latest market data
 * Prioritizes important coins and limits total processing to avoid rate limits
 */
export async function updateAllCoinsMarketData() {
  try {
    // Get all active coins from the database
    const allActiveCoins = await db.select().from(coins).where(eq(coins.isActive, true));

    // Skip if no coins found
    if (allActiveCoins.length === 0) {
      console.warn('No active coins found in database to update');
      return { updated: 0, errors: 0 };
    }

    // Priority coins that should always be updated
    const prioritySymbols = ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'USDT', 'USDC', 'ADA', 'DOGE', 'MATIC', 'LINK', 'DOT', 'AVAX', 'UNI', 'LTC'];
    
    // Separate priority coins from others
    const priorityCoins = allActiveCoins.filter(coin => prioritySymbols.includes(coin.symbol));
    const otherCoins = allActiveCoins.filter(coin => !prioritySymbols.includes(coin.symbol));
    
    // Limit total coins to process (prioritize important ones)
    const maxCoinsToUpdate = 150; // Reduced from processing all coins
    const maxOtherCoins = Math.max(0, maxCoinsToUpdate - priorityCoins.length);
    
    // Select coins to update: all priority coins + limited other coins
    const selectedCoins = [...priorityCoins, ...otherCoins.slice(0, maxOtherCoins)];
    const ourSymbols = selectedCoins.map(coin => coin.symbol);

    console.log(`Updating ${selectedCoins.length} coins (${priorityCoins.length} priority, ${selectedCoins.length - priorityCoins.length} others) out of ${allActiveCoins.length} total active coins`);

    let totalUpdated = 0;
    let totalErrors = 0;

    try {
      // Fetch market data for all selected coins at once
      const marketData = await fetchCoinMarketData(ourSymbols);

      // Update each coin with the latest market data
      for (const coin of selectedCoins) {
        // Find market data for this coin
        const data = marketData.find((marketItem: CoinMarketData) => marketItem.symbol === coin.symbol);

        if (data) {
          // Update coin with new market data
          try {
            const coinMetadata = coin.metadata ? (coin.metadata as Record<string, any>) : {};

            await db.update(coins)
              .set({
                price: data.price,
                marketCap: data.marketCap,
                change24h: data.change24h,
                metadata: {
                  ...coinMetadata,
                  lastPriceUpdate: new Date().toISOString(),
                  image: data.image,
                  volume24h: data.volume24h,
                  high24h: data.high24h,
                  low24h: data.low24h
                }
              })
              .where(eq(coins.id, coin.id));

            totalUpdated++;
          } catch (error) {
            console.error(`Error updating coin ${coin.symbol}:`, error);
            totalErrors++;
          }
        } else {
          // Only log missing data for priority coins to reduce noise
          if (prioritySymbols.includes(coin.symbol)) {
            console.warn(`No market data found for priority coin ${coin.symbol}`);
          }
        }
      }

      console.log(`Market data update complete: ${totalUpdated} updated, ${totalErrors} errors`);
    } catch (batchError) {
      console.error(`Error processing market data update:`, batchError);
      totalErrors = selectedCoins.length;
    }

    return { updated: totalUpdated, errors: totalErrors };
  } catch (error) {
    console.error('Error in updateAllCoinsMarketData:', error);
    return { updated: 0, errors: -1 };
  }
}