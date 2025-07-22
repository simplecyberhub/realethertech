import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import type { Session } from "express-session";
import Stripe from "stripe";
import { sql, eq, desc, and, count, sum } from "drizzle-orm";
import { db } from "./db";

// Extend the session to include our custom fields
declare module "express-session" {
  interface Session {
    userId?: number;
  }
}

// Add user property to Express Request object
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}
import { storage } from "./storage";
import * as schema from "@shared/schema";
import { 
  addCoinSchema, 
  purchaseCoinSchema,
  userLoginSchema,
  transactions,
  type Coin
} from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { 
  fetchCoinMarketData, 
  fetchCoinChartData, 
  updateAllCoinsMarketData,
  syncTopCoinsToDatabase,
  fetchAllCoins,
  syncAllCoinsFromCoinGecko,
  syncDeFiCoinsFromCoinGecko
} from './services/cryptoService';

const PgStore = connectPgSimple(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up an interval to update cryptocurrency prices regularly (reduced frequency)
  const updateInterval = 10 * 60 * 1000; // 10 minutes (increased from 5 minutes)

  // Initial update and synchronization at startup
  setTimeout(async () => {
    try {
      // First, refresh our coin mappings (but don't fetch all coins to avoid rate limits)
      console.log("Initializing cryptocurrency service...");

      // Second, sync top coins if we don't have many coins yet (reduced number)
      const activeCoins = await db.select().from(schema.coins).where(eq(schema.coins.isActive, true));
      if (activeCoins.length < 20) {
        console.log("Syncing top cryptocurrencies from CoinGecko...");
        const syncResult = await syncTopCoinsToDatabase(50); // Reduced from 100 to 50
        console.log(`Synced top cryptocurrencies: ${syncResult.added} added, ${syncResult.updated} updated`);
      }

      // Wait a bit longer before first market data update
      setTimeout(async () => {
        try {
          console.log("Performing initial market data update...");
          const result = await updateAllCoinsMarketData();
          console.log(`Initial update complete: ${result.updated} coins updated, ${result.errors} errors`);
        } catch (error) {
          console.error("Error during initial market data update:", error);
        }
      }, 5000); // Wait additional 5 seconds

    } catch (error) {
      console.error("Error during startup cryptocurrency synchronization:", error);
    }
  }, 15000); // Increased from 10 to 15 seconds

  // Regular updates with better error handling
  setInterval(async () => {
    try {
      console.log("Scheduled market data update starting...");
      const result = await executeWithRetry(() => updateAllCoinsMarketData());
      console.log(`Scheduled update complete: ${result.updated} coins updated, ${result.errors} errors`);
    } catch (error) {
      console.error("Error during scheduled market data update:", error);
    }
  }, updateInterval);

  // Set up session with PostgreSQL store
  app.use(session({
    store: new PgStore({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 86400,
      errorLog: (error: Error) => {
        console.warn('Session store error:', error.message);
      }
    }),
    secret: process.env.SESSION_SECRET || "cryptomarket-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Database query wrapper with retry logic
  async function executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message.toLowerCase();
        if (errorMessage.includes('connection terminated') || 
            errorMessage.includes('timeout') ||
            errorMessage.includes('connection timeout') ||
            errorMessage.includes('pool') ||
            lastError.name === 'ConnectionError') {
          console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, lastError.message);

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
          }
        } else {
          throw lastError; // Don't retry non-connection errors
        }
      }
    }

    throw lastError!;
  }

  // Set up session-based authentication
  app.use(async (req, res, next) => {
    const userId = req.session.userId;
    if (!userId) {
      return next();
    }

    try {
      const user = await executeWithRetry(() => storage.getUser(userId));
      if (user) {
        req.user = user;
      }
      next();
    } catch (err) {
      console.error("Error fetching user:", err);
      next();
    }
  });

  // Authentication middleware
  const ensureAuthenticated = (req: Request, res: Response, next: Function) => {
    if (req.user) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Admin middleware
  const ensureAdmin = (req: Request, res: Response, next: Function) => {
    if (req.user && req.user.isAdmin) {
      return next();
    }
    res.status(403).json({ message: "Forbidden: Admin access required" });
  };

  // Authentication routes
  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const validatedData = userLoginSchema.parse(req.body);
      const { username, password } = validatedData;

      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(401).json({ message: "Incorrect username or password." });
      }

      // Import the comparePassword function from auth.ts
      const { comparePassword } = await import('./auth');
      const isPasswordValid = await comparePassword(user.password, password);

      if (!isPasswordValid) {
        return res.status(401).json({ message: "Incorrect username or password." });
      }

      // Set the user ID in the session to mark as authenticated
      req.session.userId = user.id;

      return res.json({ user: { id: user.id, username: user.username, isAdmin: user.isAdmin } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  // Register a new user
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const validatedData = userLoginSchema.parse(req.body);
      const { username, password } = validatedData;

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Import the hashPassword function from auth.ts
      const { hashPassword } = await import('./auth');
      const hashedPassword = await hashPassword(password);

      // Create the user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
      });

      // Set session
      req.session.userId = user.id;

      // Return user without password
      return res.status(201).json({ 
        user: { id: user.id, username: user.username, isAdmin: user.isAdmin } 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    // Clear the session to log the user out
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (req.user) {
      const user = req.user as any;
      return res.json({ 
        user: { id: user.id, username: user.username, isAdmin: user.isAdmin } 
      });
    }
    res.status(401).json({ message: "Not authenticated" });
  });

  // Coin API routes
  app.get("/api/coins", async (req, res) => {
    try {
      const activeOnly = req.query.active === "true";
      const coins = await executeWithRetry(() => storage.getAllCoins(activeOnly));
      res.json(coins);
    } catch (error) {
      console.error("Error fetching coins:", error);
      res.status(500).json({ message: "Failed to fetch coins" });
    }
  });

  app.get("/api/coins/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const coin = await storage.getCoin(id);
    if (!coin) {
      return res.status(404).json({ message: "Coin not found" });
    }

    res.json(coin);
  });

  app.post("/api/coins", ensureAuthenticated, async (req, res, next) => {
    try {
      const coinData = addCoinSchema.parse(req.body);

      // Check if coin with same symbol already exists
      const existingCoin = await storage.getCoinBySymbol(coinData.symbol);
      if (existingCoin) {
        return res.status(409).json({ 
          message: `Coin with symbol ${coinData.symbol} already exists` 
        });
      }

      // Convert number values to string for storage
      const coinDataForStorage = {
        ...coinData,
        price: coinData.price.toString(),
        marketCap: coinData.marketCap ? coinData.marketCap.toString() : null,
        change24h: coinData.change24h ? coinData.change24h.toString() : null
      };

      const coin = await storage.createCoin(coinDataForStorage);
      res.status(201).json(coin);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  app.patch("/api/coins/:id", ensureAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const updateData = addCoinSchema.partial().parse(req.body);

      // Convert number values to string for storage
      const updateDataForStorage: Partial<Coin> = {
        ...updateData,
        price: updateData.price !== undefined ? updateData.price.toString() : undefined,
        marketCap: updateData.marketCap !== undefined ? 
          (updateData.marketCap !== null ? updateData.marketCap.toString() : null) : undefined,
        change24h: updateData.change24h !== undefined ? 
          (updateData.change24h !== null ? updateData.change24h.toString() : null) : undefined
      };

      const updatedCoin = await storage.updateCoin(id, updateDataForStorage);

      if (!updatedCoin) {
        return res.status(404).json({ message: "Coin not found" });
      }

      res.json(updatedCoin);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  app.patch("/api/coins/:id/toggle", ensureAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

    const updatedCoin = await storage.toggleCoinStatus(id, isActive);
    if (!updatedCoin) {
      return res.status(404).json({ message: "Coin not found" });
    }

    res.json(updatedCoin);
  });

  app.patch("/api/coins/:id/toggle-lock", ensureAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const { isLocked } = req.body;
    if (typeof isLocked !== "boolean") {
      return res.status(400).json({ message: "isLocked must be a boolean" });
    }

    const updatedCoin = await storage.updateCoin(id, { isLocked });
    if (!updatedCoin) {
      return res.status(404).json({ message: "Coin not found" });
    }

    res.json(updatedCoin);
  });

  app.delete("/api/coins/:id", ensureAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const deleted = await storage.deleteCoin(id);
    if (!deleted) {
      return res.status(404).json({ 
        message: "Coin not found or cannot be deleted (default coins are protected)" 
      });
    }

    res.status(204).end();
  });

  // Live market data endpoints
  app.get("/api/market/prices", async (req, res) => {
    try {
      const activeOnly = req.query.active === "true";
      const coins = await executeWithRetry(() => storage.getAllCoins(activeOnly));
      
      if (coins.length === 0) {
        return res.json([]);
      }

      const symbols = coins.map(coin => coin.symbol);

      // Get market data from CoinGecko
      const marketData = await fetchCoinMarketData(symbols);

      // Always return coins, even if market data is not available
      const enrichedCoins = coins.map(coin => {
        const marketInfo = marketData.find(data => data.symbol === coin.symbol);

        if (marketInfo) {
          return {
            ...coin,
            // Use market data if available, otherwise use database values
            price: marketInfo.price,
            marketCap: marketInfo.marketCap,
            change24h: marketInfo.change24h,
            marketData: {
              price: marketInfo.price,
              change24h: marketInfo.change24h,
              marketCap: marketInfo.marketCap,
              volume24h: marketInfo.volume24h,
              high24h: marketInfo.high24h,
              low24h: marketInfo.low24h,
              image: marketInfo.image,
              lastUpdated: marketInfo.lastUpdated
            }
          };
        }

        // Return coin with database values if no market data
        return {
          ...coin,
          marketData: null
        };
      });

      res.json(enrichedCoins);
    } catch (error) {
      console.error("Error fetching market prices:", error);
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  app.get("/api/market/chart/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const days = req.query.days ? parseInt(req.query.days as string) : 7;

      if (!symbol) {
        return res.status(400).json({ message: "Symbol is required" });
      }

      // Try to get chart data, which now includes fallback mechanism
      const chartData = await fetchCoinChartData(symbol.toUpperCase(), days);

      if (!chartData) {
        return res.status(404).json({ message: "Chart data not available for this coin" });
      }

      // Add a header to indicate if this is simulated data
      if (chartData.source === 'simulated') {
        res.setHeader('X-Data-Source', 'simulated');
      }

      res.json(chartData);
    } catch (error) {
      console.error("Error fetching chart data:", error);
      res.status(500).json({ message: "Failed to fetch chart data" });
    }
  });

  // Endpoint to trigger price update for all coins
  app.post("/api/market/update-prices", ensureAdmin, async (req, res) => {
    try {
      const result = await updateAllCoinsMarketData();
      res.json({ 
        message: `Updated ${result.updated} coins with latest market data`,
        ...result
      });
    } catch (error) {
      console.error("Error updating market prices:", error);
      res.status(500).json({ message: "Failed to update market data" });
    }
  });

  // Endpoint to sync top cryptocurrencies from CoinGecko
  app.post("/api/market/sync-top-coins", ensureAdmin, async (req, res) => {
    try {
      // Get limit parameter or default to 250
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 250;

      // Start the sync process
      console.log(`Syncing top ${limit} cryptocurrencies from CoinGecko...`);
      const result = await syncTopCoinsToDatabase(limit);

      res.json({
        message: `Successfully synced top cryptocurrencies from CoinGecko`,
        ...result
      });
    } catch (error) {
      console.error("Error syncing top coins:", error);
      res.status(500).json({ message: "Failed to sync coins from CoinGecko" });
    }
  });

  // Endpoint to sync ALL cryptocurrencies from CoinGecko (comprehensive import)
  app.post("/api/market/sync-all-coins", ensureAdmin, async (req, res) => {
    try {
      console.log("Starting comprehensive cryptocurrency sync from CoinGecko...");

      // This will sync all available cryptocurrencies (16,000+)
      const result = await syncAllCoinsFromCoinGecko();

      res.json({
        message: "Successfully completed comprehensive cryptocurrency sync",
        ...result
      });
    } catch (error) {
      console.error("Error syncing all coins:", error);
      res.status(500).json({ message: "Failed to sync all coins from CoinGecko" });
    }
  });

  // Endpoint to sync DeFi cryptocurrencies from CoinGecko
  app.post("/api/market/sync-defi-coins", ensureAdmin, async (req, res) => {
    try {
      console.log("Starting DeFi cryptocurrency sync from CoinGecko...");

      const result = await syncDeFiCoinsFromCoinGecko();

      res.json({
        message: "Successfully completed DeFi cryptocurrency sync",
        ...result
      });
    } catch (error) {
      console.error("Error syncing DeFi coins:", error);
      res.status(500).json({ message: "Failed to sync DeFi coins from CoinGecko" });
    }
  });

  // Endpoint to refresh cryptocurrency symbol mappings
  app.post("/api/market/refresh-mappings", ensureAdmin, async (req, res) => {
    try {
      console.log("Refreshing cryptocurrency symbol mappings from CoinGecko...");
      const success = await fetchAllCoins();

      if (success) {
        res.json({
          message: "Successfully refreshed cryptocurrency symbol mappings"
        });
      } else {
        res.status(500).json({ message: "Failed to refresh cryptocurrency mappings" });
      }
    } catch (error) {
      console.error("Error refreshing symbol mappings:", error);
      res.status(500).json({ message: "Failed to refresh cryptocurrency mappings" });
    }
  });

  // Endpoint to add specific coins manually
  app.post("/api/market/add-specific-coins", ensureAdmin, async (req, res) => {
    try {
      console.log("Adding specific requested coins...");
      
      const specificCoins = [
        { symbol: 'HXAI', coingeckoId: 'healix-protocol', name: 'Healix AI' },
        { symbol: 'HLIX', coingeckoId: 'helix-2', name: 'Helix' },
        { symbol: 'VONE', coingeckoId: 'v-one', name: 'VONE' }
      ];
      
      let added = 0;
      let updated = 0;
      let errors = 0;
      
      for (const coin of specificCoins) {
        try {
          // Try to get market data for this coin
          const marketResponse = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.coingeckoId}`, {
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (!marketResponse.ok) {
            console.warn(`Could not fetch data for ${coin.symbol} (${coin.coingeckoId})`);
            errors++;
            continue;
          }
          
          const coinData = await marketResponse.json();
          
          // Check if coin already exists
          const existingCoin = await storage.getCoinBySymbol(coin.symbol);
          
          const coinRecord = {
            name: coinData.name || coin.name,
            symbol: coin.symbol,
            description: `${coinData.name || coin.name} (${coin.symbol}) - ${coinData.description?.en || 'A cryptocurrency available for trading.'}`.substring(0, 500),
            price: coinData.market_data?.current_price?.usd?.toString() || '0',
            marketCap: coinData.market_data?.market_cap?.usd?.toString() || '0',
            change24h: coinData.market_data?.price_change_percentage_24h?.toString() || '0',
            isActive: true,
            logoUrl: coinData.image?.large || coinData.image?.small || null,
            metadata: {
              coingeckoId: coin.coingeckoId,
              lastPriceUpdate: new Date().toISOString(),
              image: coinData.image?.large || coinData.image?.small || null,
              volume24h: coinData.market_data?.total_volume?.usd?.toString() || '0',
              high24h: coinData.market_data?.high_24h?.usd?.toString() || '0',
              low24h: coinData.market_data?.low_24h?.usd?.toString() || '0',
              rank: coinData.market_cap_rank?.toString() || '999999'
            }
          };
          
          if (existingCoin) {
            await storage.updateCoin(existingCoin.id, coinRecord);
            updated++;
          } else {
            await storage.createCoin(coinRecord);
            added++;
          }
          
        } catch (coinError) {
          console.error(`Error processing ${coin.symbol}:`, coinError);
          errors++;
        }
      }
      
      res.json({
        message: `Successfully processed specific coins: ${added} added, ${updated} updated, ${errors} errors`,
        added,
        updated,
        errors
      });
    } catch (error) {
      console.error("Error adding specific coins:", error);
      res.status(500).json({ message: "Failed to add specific coins" });
    }
  });

  // Holdings/Portfolio API routes
  app.get("/api/portfolio", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const holdings = await storage.getUserHoldings(user.id);
      res.json(holdings);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      res.status(500).json({ message: 'Failed to fetch portfolio' });
    }
  });

  app.post("/api/portfolio/buy", ensureAuthenticated, async (req, res, next) => {
    try {
      const user = req.user as any;

      // Validate required fields
      if (!req.body.coinId || !req.body.amount) {
        return res.status(400).json({ 
          message: "Coin ID and amount are required" 
        });
      }

      // Ensure amount is a valid number
      const amount = parseFloat(req.body.amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ 
          message: "Amount must be a valid positive number" 
        });
      }

      const purchaseData = {
        userId: user.id,
        coinId: parseInt(req.body.coinId),
        amount: amount
      };

      // Get current coin price
      const coin = await storage.getCoin(purchaseData.coinId);
      if (!coin) {
        return res.status(404).json({ message: "Coin not found" });
      }

      // Create a holding record
      const holdingData = {
        userId: purchaseData.userId,
        coinId: purchaseData.coinId,
        amount: purchaseData.amount.toString(),
        purchasePrice: coin.price.toString()
      };

      // Calculate total value
      const totalValue = parseFloat(coin.price.toString()) * parseFloat(purchaseData.amount.toString());

      // Create transaction record
      let metadata = {};
      let paymentMethod = "fiat";

      // Handle cryptocurrency payment (only supporting USDT and SOL)
      if (req.body.transactionHash && req.body.senderAddress) {
        paymentMethod = req.body.paymentMethod || "crypto";

        // Validate payment method is either USDT or SOL
        if (paymentMethod !== "USDT" && paymentMethod !== "SOL") {
          return res.status(400).json({ 
            message: "Invalid payment method. Only USDT and SOL are accepted." 
          });
        }

        metadata = {
          transactionHash: req.body.transactionHash,
          senderAddress: req.body.senderAddress,
          paymentMethod: paymentMethod,
          verificationDate: new Date().toISOString(),
          notes: `Manual ${paymentMethod} payment pending verification`
        };

        console.log(`${paymentMethod} payment received: Transaction ${req.body.transactionHash} from ${req.body.senderAddress}`);

        // Record the transaction with pending status for manual verification
        await db.insert(transactions).values({
          userId: user.id,
          coinId: purchaseData.coinId,
          type: "buy",
          amount: purchaseData.amount.toString(),
          price: coin.price.toString(),
          totalValue: totalValue.toString(),
          paymentMethod: paymentMethod,
          status: "pending_verification", // Admin will need to verify the transaction
          metadata
        });
      } else {
        // For any transaction missing required details
        return res.status(400).json({ 
          message: "Payment details are incomplete. Transaction hash and sender address are required." 
        });
      }

      // Only create holding after transaction is recorded
      const holding = await storage.createHolding(holdingData);

      res.status(201).json({
        message: "Purchase completed successfully",
        holding,
        transaction: {
          amount: purchaseData.amount.toString(),
          coin: coin.symbol,
          totalValue,
          status: "pending_verification"
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  app.post("/api/portfolio/withdraw", ensureAuthenticated, async (req, res, next) => {
    try {
      const user = req.user as any;
      const { coinId, amount, withdrawalAddress } = req.body;

      if (!coinId || !amount || !withdrawalAddress) {
        return res.status(400).json({ 
          message: "Coin ID, amount, and withdrawal address are required" 
        });
      }

      const withdrawAmount = parseFloat(amount);
      if (withdrawAmount <= 0) {
        return res.status(400).json({ message: "Amount must be greater than 0" });
      }

      // Get current coin price
      const coin = await storage.getCoin(coinId);
      if (!coin) {
        return res.status(404).json({ message: "Coin not found" });
      }

      // Check if coin is locked
      if (coin.isLocked) {
        return res.status(400).json({ 
          message: "The selected cryptocurrency is currently locked and cannot be withdrawn at this time. Please try again after the lock period has expired." 
        });
      }

      // Get user's holding for this coin
      const holding = await storage.getHoldingsByUserAndCoin(user.id, coinId);
      if (!holding) {
        return res.status(404).json({ message: "You don't own this cryptocurrency" });
      }

      const currentHolding = parseFloat(holding.amount);
      if (currentHolding < withdrawAmount) {
        return res.status(400).json({ 
          message: `Insufficient balance. You have ${currentHolding} ${coin.symbol}, but tried to withdraw ${withdrawAmount}` 
        });
      }

      // Calculate total value
      const totalValue = parseFloat(coin.price.toString()) * withdrawAmount;

      // Record the withdrawal transaction
      await db.insert(transactions).values({
        userId: user.id,
        coinId: coinId,
        type: "sell",
        amount: withdrawAmount.toString(),
        price: coin.price.toString(),
        totalValue: totalValue.toString(),
        paymentMethod: "crypto_withdrawal",
        status: "pending_verification",
        metadata: {
          withdrawalAddress,
          withdrawalDate: new Date().toISOString(),
          notes: "Withdrawal pending admin verification and processing"
        }
      });

      // Update holding amount
      const newAmount = currentHolding - withdrawAmount;
      if (newAmount === 0) {
        // Delete the holding if amount becomes 0
        await db.delete(schema.holdings).where(eq(schema.holdings.id, holding.id));
      } else {
        // Update the holding with new amount
        await db
          .update(schema.holdings)
          .set({ amount: newAmount.toString() })
          .where(eq(schema.holdings.id, holding.id));
      }

      res.status(201).json({
        message: "Withdrawal request submitted successfully",
        transaction: {
          amount: withdrawAmount,
          coin: coin.symbol,
          totalValue,
          withdrawalAddress,
          status: "pending_verification"
        }
      });
    } catch (error) {
      console.error("Withdrawal error:", error);
      next(error);
    }
  });

  // Admin routes

  // User management
  app.get("/api/admin/users", ensureAdmin, async (req, res) => {
    try {
      const users = await db.select().from(schema.users);

      // Remove sensitive information like passwords
      const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email || null,
        isAdmin: user.isAdmin,
        stripeCustomerId: user.stripeCustomerId || null
      }));

      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/:id", ensureAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove sensitive information
      const safeUser = {
        id: user.id,
        username: user.username,
        email: user.email || null,
        isAdmin: user.isAdmin,
        stripeCustomerId: user.stripeCustomerId || null
      };

      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch("/api/admin/users/:id", ensureAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const updateData = schema.updateUserSchema.parse(req.body);

      // If password is provided, hash it
      if (updateData.password) {
        const { hashPassword } = await import('./auth');
        updateData.password = await hashPassword(updateData.password);
      }

      const [updatedUser] = await db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, id))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove sensitive information
      const safeUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email || null,
        isAdmin: updatedUser.isAdmin,
        stripeCustomerId: updatedUser.stripeCustomerId || null
      };

      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  // Transaction management
  app.get("/api/admin/transactions", ensureAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const status = req.query.status as string || null;

      // Define the query
      const queryOptions = {
        select: {
          transaction: schema.transactions,
          user: {
            id: schema.users.id,
            username: schema.users.username
          },
          coin: {
            id: schema.coins.id,
            name: schema.coins.name,
            symbol: schema.coins.symbol
          }
        },
        from: schema.transactions,
        innerJoin: [
          { table: schema.users, on: eq(schema.transactions.userId, schema.users.id) },
          { table: schema.coins, on: eq(schema.transactions.coinId, schema.coins.id) }
        ],
        where: status ? eq(schema.transactions.status, status) : undefined,
        orderBy: desc(schema.transactions.createdAt),
        limit,
        offset
      };

      // Execute the query
      let transactionsList;
      if (status) {
        transactionsList = await db
          .select(queryOptions.select)
          .from(queryOptions.from)
          .innerJoin(schema.users, eq(schema.transactions.userId, schema.users.id))
          .innerJoin(schema.coins, eq(schema.transactions.coinId, schema.coins.id))
          .where(eq(schema.transactions.status, status))
          .orderBy(queryOptions.orderBy)
          .limit(queryOptions.limit)
          .offset(queryOptions.offset);
      } else {
        transactionsList = await db
          .select(queryOptions.select)
          .from(queryOptions.from)
          .innerJoin(schema.users, eq(schema.transactions.userId, schema.users.id))
          .innerJoin(schema.coins, eq(schema.transactions.coinId, schema.coins.id))
          .orderBy(queryOptions.orderBy)
          .limit(queryOptions.limit)
          .offset(queryOptions.offset);
      }

      // Count total records
      let countResult;
      if (status) {
        countResult = await db
          .select({ count: sql`count(*)`.mapWith(Number) })
          .from(schema.transactions)
          .where(eq(schema.transactions.status, status));
      } else {
        countResult = await db
          .select({ count: sql`count(*)`.mapWith(Number) })
          .from(schema.transactions);
      }

      const [{ count }] = countResult;

      res.json({
        transactions: transactionsList,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Process for verifying cryptocurrency transactions
  app.patch("/api/admin/transactions/:id/verify", ensureAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid transaction ID format" });
      }

      const { status, adminNotes } = req.body;

      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Status must be either 'approved' or 'rejected'" });
      }

      // First, get the transaction to make sure it exists and is pending verification
      const [transaction] = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, id));

      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.status !== 'pending_verification') {
        return res.status(400).json({ 
          message: "Only transactions with 'pending_verification' status can be verified"
        });
      }

      // Update the transaction with the new status and admin notes
      const updatedMetadata = transaction.metadata ? { 
        ...transaction.metadata as any,
        verificationDate: new Date().toISOString(),
        adminNotes: adminNotes || "Transaction manually verified by admin"
      } : {
        verificationDate: new Date().toISOString(),
        adminNotes: adminNotes || "Transaction manually verified by admin"
      };

      const [updatedTransaction] = await db
        .update(schema.transactions)
        .set({ 
          status: status === "approved" ? "completed" : "rejected",
          metadata: updatedMetadata
        })
        .where(eq(schema.transactions.id, id))
        .returning();

      // If rejected, we're done here
      if (status === "rejected") {
        return res.json({
          message: "Transaction rejected successfully",
          transaction: updatedTransaction
        });
      }

      // If approved, make sure the user has the coins in their holdings
      // Check if holding already exists
      const existingHolding = await db
        .select()
        .from(schema.holdings)
        .where(and(
          eq(schema.holdings.userId, transaction.userId),
          eq(schema.holdings.coinId, transaction.coinId)
        ))
        .limit(1);

      if (existingHolding.length > 0) {
        // Update existing holding
        const holding = existingHolding[0];
        const newAmount = parseFloat(holding.amount) + parseFloat(transaction.amount);
        const totalValue = 
          parseFloat(holding.amount) * parseFloat(holding.purchasePrice) +
          parseFloat(transaction.amount) * parseFloat(transaction.price);
        const averagePrice = totalValue / newAmount;

        await db
          .update(schema.holdings)
          .set({
            amount: newAmount.toString(),
            purchasePrice: averagePrice.toString()
          })
          .where(eq(schema.holdings.id, holding.id));
      } else {
        // Create new holding
        await db.insert(schema.holdings).values({
          userId: transaction.userId,
          coinId: transaction.coinId,
          amount: transaction.amount,
          purchasePrice: transaction.price
        });
      }

      res.json({
        message: "Transaction approved successfully",
        transaction: updatedTransaction
      });
    } catch (error) {
      console.error("Error verifying transaction:", error);
      res.status(500).json({ message: "Failed to verify transaction" });
    }
  });

  // Database export endpoint
  app.get("/api/admin/export", ensureAdmin, async (req, res) => {
    try {
      // Export schema structure
      const schemaQuery = `
        SELECT 
          table_name,
          column_name,data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `;

      const schemaResult = await db.execute(sql.raw(schemaQuery));

      // Export all table data
      const tables = ['users', 'coins', 'holdings', 'transactions'];
      const exportData: any = {
        schema: schemaResult.rows,
        data: {},
        exportedAt: new Date().toISOString()
      };

      // Export data from each table
      for (const table of tables) {
        try {
          const tableData = await db.execute(sql.raw(`SELECT * FROM ${table}`));
          exportData.data[table] = tableData.rows;
        } catch (error) {
          console.error(`Error exporting table ${table}:`, error);
          exportData.data[table] = [];
        }
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="database_export_${new Date().toISOString().split('T')[0]}.json"`);

      res.json(exportData);
    } catch (error) {
      console.error("Database export error:", error);
      res.status(500).json({ error: "Failed to export database" });
    }
  });

  // Analytics and dashboard data
  app.get("/api/admin/dashboard", ensureAdmin, async (req, res) => {
    try {
      // Get user count with retry
      const userCountResult = await executeWithRetry(() => 
        db.select({ userCount: sql`count(*)`.mapWith(Number) }).from(schema.users)
      );
      const userCount = userCountResult[0]?.userCount || 0;

      // Get active coins count with retry
      const activeCoinResult = await executeWithRetry(() =>
        db.select({ activeCoinCount: sql`count(*)`.mapWith(Number) })
          .from(schema.coins)
          .where(eq(schema.coins.isActive, true))
      );
      const activeCoinCount = activeCoinResult[0]?.activeCoinCount || 0;

      // Get transaction count and total volume with retry
      const transactionResult = await executeWithRetry(() =>
        db.select({
          transactionCount: sql`count(*)`.mapWith(Number),
          totalVolume: sql`COALESCE(sum(CAST(total_value AS DECIMAL)), 0)`.mapWith(Number)
        }).from(schema.transactions)
      );
      const transactionCount = transactionResult[0]?.transactionCount || 0;
      const totalVolume = transactionResult[0]?.totalVolume || 0;

      // Get recent transactions with retry
      const recentTransactions = await executeWithRetry(() =>
        db.select({
          id: schema.transactions.id,
          type: schema.transactions.type,
          amount: schema.transactions.amount,
          totalValue: schema.transactions.totalValue,
          status: schema.transactions.status,
          createdAt: schema.transactions.createdAt,
          coinSymbol: schema.coins.symbol,
          username: schema.users.username
        })
        .from(schema.transactions)
        .innerJoin(schema.users, eq(schema.transactions.userId, schema.users.id))
        .innerJoin(schema.coins, eq(schema.transactions.coinId, schema.coins.id))
        .orderBy(desc(schema.transactions.createdAt))
        .limit(5)
      ).catch(() => []); // Return empty array if this fails

      // Get pending transactions count with retry
      const pendingResult = await executeWithRetry(() =>
        db.select({ pendingCount: sql`count(*)`.mapWith(Number) })
          .from(schema.transactions)
          .where(eq(schema.transactions.status, "pending_verification"))
      );
      const pendingCount = pendingResult[0]?.pendingCount || 0;

      res.json({
        stats: {
          totalUsers: userCount,
          activeCoins: activeCoinCount,
          totalTransactions: transactionCount,
          totalVolume: totalVolume,
          pendingTransactions: pendingCount,
          recentTransactions: recentTransactions || []
        }
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      // Return default values instead of error to prevent UI crashes
      res.json({
        stats: {
          totalUsers: 0,
          activeCoins: 0,
          totalTransactions: 0,
          totalVolume: 0,
          pendingTransactions: 0,
          recentTransactions: []
        }
      });
    }
  });

  // Enhanced pending activities endpoint
  app.get("/api/admin/pending", ensureAdmin, async (req, res) => {
    try {
      // Get all pending transactions requiring verification
      const pendingTransactions = await db
        .select({
          transaction: schema.transactions,
          user: {
            id: schema.users.id,
            username: schema.users.username,
            email: schema.users.email
          },
          coin: {
            id: schema.coins.id,
            name: schema.coins.name,
            symbol: schema.coins.symbol
          }
        })
        .from(schema.transactions)
        .innerJoin(schema.users, eq(schema.transactions.userId, schema.users.id))
        .innerJoin(schema.coins, eq(schema.transactions.coinId, schema.coins.id))
        .where(eq(schema.transactions.status, "pending_verification"))
        .orderBy(desc(schema.transactions.createdAt));

      res.json({
        pendingTransactions,
        summary: {
          totalPending: pendingTransactions.length,
          totalValue: pendingTransactions.reduce((sum, t) => sum + parseFloat(t.transaction.totalValue), 0)
        }
      });
    } catch (error) {
      console.error("Error fetching pending activities:", error);
      res.status(500).json({ message: "Failed to fetch pending activities" });
    }
  });

  // Bulk approve/decline transactions
  app.post("/api/admin/transactions/bulk-action", ensureAdmin, async (req, res) => {
    try {
      const { transactionIds, action, adminNotes } = req.body;

      if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
        return res.status(400).json({ message: "Transaction IDs array is required" });
      }

      if (!action || !["approve", "decline"].includes(action)) {
        return res.status(400).json({ message: "Action must be either 'approve' or 'decline'" });
      }

      const newStatus = action === "approve" ? "completed" : "rejected";
      const timestamp = new Date().toISOString();

      // Get all transactions to be updated first
      const transactionsToUpdate = await db
        .select()
        .from(schema.transactions)
        .where(and(
          sql`${schema.transactions.id} = ANY(${transactionIds})`,
          eq(schema.transactions.status, "pending_verification")
        ));

      if (transactionsToUpdate.length === 0) {
        return res.status(400).json({ message: "No valid pending transactions found" });
      }

      // Update all selected transactions
      const result = await db
        .update(schema.transactions)
        .set({
          status: newStatus,
          metadata: sql`COALESCE(${schema.transactions.metadata}, '{}')::jsonb || ${JSON.stringify({
            verificationDate: timestamp,
            adminNotes: adminNotes || `Bulk ${action}d by admin`,
            bulkAction: true
          })}::jsonb`
        })
        .where(and(
          sql`${schema.transactions.id} = ANY(${JSON.stringify(transactionIds)}::integer[])`,
          eq(schema.transactions.status, "pending_verification")
        ))
        .returning();

      // If approved, create corresponding holdings
      if (action === "approve") {
        for (const transaction of result) {
          try {
            // Check if holding already exists
            const existingHolding = await db
              .select()
              .from(schema.holdings)
              .where(and(
                eq(schema.holdings.userId, transaction.userId),
                eq(schema.holdings.coinId, transaction.coinId)
              ))
              .limit(1);

            if (existingHolding.length > 0) {
              // Update existing holding
              const holding = existingHolding[0];
              const newAmount = parseFloat(holding.amount) + parseFloat(transaction.amount);
              const totalValue = 
                parseFloat(holding.amount) * parseFloat(holding.purchasePrice) +
                parseFloat(transaction.amount) * parseFloat(transaction.price);
              const averagePrice = totalValue / newAmount;

              await db
                .update(schema.holdings)
                .set({
                  amount: newAmount.toString(),
                  purchasePrice: averagePrice.toString()
                })
                .where(eq(schema.holdings.id, holding.id));
            } else {
              // Create new holding
              await db.insert(schema.holdings).values({
                userId: transaction.userId,
                coinId: transaction.coinId,
                amount: transaction.amount,
                purchasePrice: transaction.price
              });
            }
          } catch (holdingError) {
            console.error(`Error creating holding for transaction ${transaction.id}:`, holdingError);
          }
        }
      }

      res.json({
        message: `Successfully ${action}d ${result.length} transactions`,
        processedCount: result.length,
        action
      });
    } catch (error) {
      console.error("Error processing bulk action:", error);
      res.status(500).json({ message: "Failed to process bulk action" });
    }
  });

  // Payment integration endpoints (Stripe)
  app.post("/api/create-payment-intent", ensureAuthenticated, async (req, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ 
          message: "Stripe API key is not configured" 
        });
      }

      const { amount } = req.body;
      const user = req.user as any;

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16' as any,
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // convert to cents
        currency: 'usd',
        metadata: {
          userId: user.id.toString(),
          integration: 'realethertech'
        }
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).json({ message: error.message });
    }
  });



  const httpServer = createServer(app);

  return httpServer;
}