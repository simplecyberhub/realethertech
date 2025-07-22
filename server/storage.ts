import { coins, type Coin, type InsertCoin, holdings, type Holding, type InsertHolding, users, type User, type InsertUser, sessions } from "@shared/schema";

import { db } from "./db";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Coin operations
  getAllCoins(activeOnly?: boolean): Promise<Coin[]>;
  getCoin(id: number): Promise<Coin | undefined>;
  getCoinBySymbol(symbol: string): Promise<Coin | undefined>;
  createCoin(coin: InsertCoin): Promise<Coin>;
  updateCoin(id: number, updates: Partial<Coin>): Promise<Coin | undefined>;
  toggleCoinStatus(id: number, isActive: boolean): Promise<Coin | undefined>;
  deleteCoin(id: number): Promise<boolean>;

  // Holdings operations
  getUserHoldings(userId: number): Promise<(Holding & { coin: Coin })[]>;
  createHolding(holding: InsertHolding): Promise<Holding>;
  getHoldingsByUserAndCoin(userId: number, coinId: number): Promise<Holding | undefined>;
  updateHolding(id: number, updates: Partial<Holding>): Promise<Holding | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private coins: Map<number, Coin>;
  private holdings: Map<number, Holding>;
  private userIdCounter: number;
  private coinIdCounter: number;
  private holdingIdCounter: number;

  constructor() {
    this.users = new Map();
    this.coins = new Map();
    this.holdings = new Map();
    this.userIdCounter = 1;
    this.coinIdCounter = 1;
    this.holdingIdCounter = 1;

    // Initialize with default user
    this.createUser({
      username: "admin",
      password: "password123", // In a real app, this would be hashed
    });

    // Initialize with default coins
    this.initializeDefaultCoins();
  }

  private initializeDefaultCoins() {
    const defaultCoins = [
      {
        name: "Bitcoin",
        symbol: "BTC",
        price: "43123.45",
        logoUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
        description: "The original cryptocurrency.",
        marketCap: "810500000000",
        change24h: "2.3",
        isActive: true,
        isDefault: true,
        isLocked: false
      },
      {
        name: "Ethereum",
        symbol: "ETH",
        price: "2415.78",
        logoUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
        description: "Decentralized software platform.",
        marketCap: "278900000000",
        change24h: "5.8",
        isActive: true,
        isDefault: true,
        isLocked: false
      },
      {
        name: "Cardano",
        symbol: "ADA",
        price: "1.24",
        logoUrl: "https://cryptologos.cc/logos/cardano-ada-logo.png",
        description: "Proof-of-stake blockchain platform.",
        marketCap: "41500000000",
        change24h: "-1.2",
        isActive: true,
        isDefault: true,
        isLocked: false
      },
      {
        name: "Solana",
        symbol: "SOL",
        price: "92.67",
        logoUrl: "https://cryptologos.cc/logos/solana-sol-logo.png",
        description: "High-performance blockchain.",
        marketCap: "33200000000",
        change24h: "3.4",
        isActive: true,
        isDefault: true,
        isLocked: false
      },
      {
        name: "Binance Coin",
        symbol: "BNB",
        price: "418.32",
        logoUrl: "https://cryptologos.cc/logos/binance-coin-bnb-logo.png",
        description: "Native cryptocurrency of Binance exchange.",
        marketCap: "68900000000",
        change24h: "-0.5",
        isActive: false,
        isDefault: true,
        isLocked: false
      }
    ];

    defaultCoins.forEach(coin => this.createCoin(coin));

    // Add some sample holdings for the admin user
    this.createHolding({
      userId: 1,
      coinId: 1, // Bitcoin
      amount: "0.24",
      purchasePrice: "42000.00"
    });

    this.createHolding({
      userId: 1,
      coinId: 2, // Ethereum
      amount: "1.56",
      purchasePrice: "2300.00"
    });

    this.createHolding({
      userId: 1,
      coinId: 4, // Solana
      amount: "2.3",
      purchasePrice: "90.15"
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { 
      ...insertUser, 
      id,
      isAdmin: insertUser.isAdmin ?? false,
      email: insertUser.email ?? null,
      stripeCustomerId: insertUser.stripeCustomerId ?? null,
      stripeSubscriptionId: insertUser.stripeSubscriptionId ?? null,
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Coin operations
  async getAllCoins(activeOnly = false): Promise<Coin[]> {
    const allCoins = Array.from(this.coins.values());
    return activeOnly 
      ? allCoins.filter(coin => coin.isActive) 
      : allCoins;
  }

  async getCoin(id: number): Promise<Coin | undefined> {
    return this.coins.get(id);
  }

  async getCoinBySymbol(symbol: string): Promise<Coin | undefined> {
    return Array.from(this.coins.values()).find(
      (coin) => coin.symbol.toLowerCase() === symbol.toLowerCase()
    );
  }

  async createCoin(coin: InsertCoin): Promise<Coin> {
    const id = this.coinIdCounter++;
    const newCoin: Coin = { 
      ...coin, 
      id,
      logoUrl: coin.logoUrl ?? null,
      description: coin.description ?? null,
      marketCap: coin.marketCap ?? null,
      change24h: coin.change24h ?? null,
      isActive: coin.isActive ?? true,
      isDefault: coin.isDefault ?? false,
      isLocked: coin.isLocked ?? false,
      metadata: coin.metadata ?? null,
    };
    this.coins.set(id, newCoin);
    return newCoin;
  }

  async updateCoin(id: number, updates: Partial<Coin>): Promise<Coin | undefined> {
    const coin = this.coins.get(id);
    if (!coin) return undefined;

    const updatedCoin = { ...coin, ...updates };
    this.coins.set(id, updatedCoin);
    return updatedCoin;
  }

  async toggleCoinStatus(id: number, isActive: boolean): Promise<Coin | undefined> {
    return this.updateCoin(id, { isActive });
  }

  async deleteCoin(id: number): Promise<boolean> {
    const coin = this.coins.get(id);
    if (!coin || coin.isDefault) return false;

    return this.coins.delete(id);
  }

  // Holdings operations
  async getUserHoldings(userId: number): Promise<(Holding & { coin: Coin })[]> {
    const userHoldings = Array.from(this.holdings.values())
      .filter(holding => holding.userId === userId);

    return userHoldings.map(holding => {
      const coin = this.coins.get(holding.coinId);
      if (!coin) throw new Error(`Coin not found for holding ${holding.id}`);
      return { ...holding, coin };
    });
  }

  async createHolding(holding: InsertHolding): Promise<Holding> {
    // Check if user already has this coin
    const existingHolding = await this.getHoldingsByUserAndCoin(
      Number(holding.userId), 
      Number(holding.coinId)
    );

    if (existingHolding) {
      // Update existing holding
      const amount = Number(existingHolding.amount) + Number(holding.amount);
      const totalValue = 
        Number(existingHolding.amount) * Number(existingHolding.purchasePrice) +
        Number(holding.amount) * Number(holding.purchasePrice);

      // Calculate new average purchase price
      const averagePrice = totalValue / amount;

      const updatedHolding = await this.updateHolding(existingHolding.id, {
        amount: amount.toString(),
        purchasePrice: averagePrice.toString()
      });

      if (!updatedHolding) throw new Error("Failed to update holding");
      return updatedHolding;
    }

    // Create new holding
    const id = this.holdingIdCounter++;
    const newHolding: Holding = { 
      ...holding, 
      id, 
      purchaseDate: new Date() 
    };
    this.holdings.set(id, newHolding);
    return newHolding;
  }

  async getHoldingsByUserAndCoin(userId: number, coinId: number): Promise<Holding | undefined> {
    return Array.from(this.holdings.values()).find(
      holding => holding.userId === userId && holding.coinId === coinId
    );
  }

  async updateHolding(id: number, updates: Partial<Holding>): Promise<Holding | undefined> {
    const holding = this.holdings.get(id);
    if (!holding) return undefined;

    const updatedHolding = { ...holding, ...updates };
    this.holdings.set(id, updatedHolding);
    return updatedHolding;
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getAllCoins(activeOnly = false): Promise<Coin[]> {
    if (activeOnly) {
      return db.select().from(coins).where(eq(coins.isActive, true));
    }
    return db.select().from(coins);
  }

  async getCoin(id: number): Promise<Coin | undefined> {
    const [coin] = await db.select().from(coins).where(eq(coins.id, id));
    return coin || undefined;
  }

  async getCoinBySymbol(symbol: string): Promise<Coin | undefined> {
    const [coin] = await db.select().from(coins).where(eq(coins.symbol, symbol));
    return coin || undefined;
  }

  async createCoin(coin: InsertCoin): Promise<Coin> {
    const [newCoin] = await db
      .insert(coins)
      .values(coin)
      .returning();
    return newCoin;
  }

  async updateCoin(id: number, updates: Partial<Coin>): Promise<Coin | undefined> {
    const [updatedCoin] = await db
      .update(coins)
      .set(updates)
      .where(eq(coins.id, id))
      .returning();
    return updatedCoin || undefined;
  }

  async toggleCoinStatus(id: number, isActive: boolean): Promise<Coin | undefined> {
    return this.updateCoin(id, { isActive });
  }

  async deleteCoin(id: number): Promise<boolean> {
    const result = await db
      .delete(coins)
      .where(eq(coins.id, id));
    return true;
  }

  async getUserHoldings(userId: number): Promise<(Holding & { coin: Coin })[]> {
    const userHoldings = await db
      .select()
      .from(holdings)
      .where(eq(holdings.userId, userId));

    // Get all the coins for these holdings
    const userCoins = await Promise.all(
      userHoldings.map(async (holding) => {
        const [coin] = await db
          .select()
          .from(coins)
          .where(eq(coins.id, holding.coinId));
        return { ...holding, coin };
      })
    );

    return userCoins;
  }

  async createHolding(holding: InsertHolding): Promise<Holding> {
    const [newHolding] = await db
      .insert(holdings)
      .values(holding)
      .returning();
    return newHolding;
  }

  async getHoldingsByUserAndCoin(userId: number, coinId: number): Promise<Holding | undefined> {
    const [holding] = await db
      .select()
      .from(holdings)
      .where(
        and(
          eq(holdings.userId, userId),
          eq(holdings.coinId, coinId)
        )
      );
    return holding || undefined;
  }

  async updateHolding(id: number, updates: Partial<{ amount: string; purchasePrice: string }>): Promise<Holding | undefined> {
    const [updatedHolding] = await db
      .update(holdings)
      .set(updates)
      .where(eq(holdings.id, id))
      .returning();
    return updatedHolding || undefined;
  }

  async deleteHolding(id: number) {
    const [deleted] = await db.delete(holdings)
      .where(eq(holdings.id, id))
      .returning();
    return deleted;
  }
}

// Initialize database with some default data if needed
export const initializeDatabase = async () => {
  // Check if we have any coins - if not, add the default ones
  const existingCoins = await db.select().from(coins);
  if (existingCoins.length === 0) {
    await db.insert(coins).values([
      {
        name: "Bitcoin",
        symbol: "BTC",
        price: "43123.45",
        logoUrl: null,
        description: "The original cryptocurrency.",
        marketCap: "810500000000",
        change24h: "2.30",
        isActive: true,
        isDefault: true,
        isLocked: false
      },
      {
        name: "Ethereum",
        symbol: "ETH",
        price: "2415.78",
        logoUrl: null,
        description: "A decentralized software platform.",
        marketCap: "278900000000",
        change24h: "5.80",
        isActive: true,
        isDefault: true,
        isLocked: false
      },
      {
        name: "Cardano",
        symbol: "ADA",
        price: "1.24",
        logoUrl: null,
        description: "A proof-of-stake blockchain platform.",
        marketCap: "41500000000",
        change24h: "-1.20",
        isActive: true,
        isDefault: true,
        isLocked: false
      },
      {
        name: "Solana",
        symbol: "SOL",
        price: "92.67",
        logoUrl: null,
        description: "A high-performance blockchain.",
        marketCap: "33200000000",
        change24h: "3.40",
        isActive: true,
        isDefault: true,
        isLocked: false
      }
    ]);
  }

  // Check if we have any admin users - if not, create a default admin
  const existingAdmins = await db.select().from(users).where(eq(users.isAdmin, true));
  if (existingAdmins.length === 0) {
    const { hashPassword } = await import("./auth");
    const hashedPassword = await hashPassword("admin123");

    await db.insert(users).values({
      username: "admin",
      password: hashedPassword,
      isAdmin: true
    });
  }
};

// Get holding by user and coin
export async function getHoldingsByUserAndCoin(userId: number, coinId: number) {
  const result = await db
    .select()
    .from(schema.holdings)
    .where(
      and(
        eq(schema.holdings.userId, userId),
        eq(schema.holdings.coinId, coinId)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// Update holding
export async function updateHolding(id: number, data: Partial<schema.Holding>) {
  const result = await db
    .update(schema.holdings)
    .set(data)
    .where(eq(schema.holdings.id, id))
    .returning();

  return result.length > 0 ? result[0] : null;
}

// Delete holding
export async function deleteHolding(id: number) {
  const result = await db
    .delete(schema.holdings)
    .where(eq(schema.holdings.id, id))
    .returning();

  return result.length > 0;
}

// Get coin by symbol  
export async function getCoinBySymbol(symbol: string) {
  const result = await db
    .select()
    .from(schema.coins)
    .where(eq(schema.coins.symbol, symbol))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// Toggle coin status
export async function toggleCoinStatus(id: number, isActive: boolean) {
  const result = await db
    .update(schema.coins)
    .set({ isActive })
    .where(eq(schema.coins.id, id))
    .returning();

  return result.length > 0 ? result[0] : null;
}

// Use database storage if DATABASE_URL is configured, otherwise use memory storage
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();

// Initialize the database
export const initializePostgresDatabase = async () => {
  if (process.env.DATABASE_URL) {
    // Create tables if they don't exist and add default data
    await initializeDatabase();
    console.log("PostgreSQL database initialized successfully");
  } else {
    console.log("No DATABASE_URL configured, using in-memory storage");
  }
};