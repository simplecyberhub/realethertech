import { pgTable, text, serial, integer, boolean, numeric, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  email: text("email"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Cryptocurrency schema
export const coins = pgTable("coins", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull().unique(),
  price: numeric("price", { precision: 18, scale: 8 }).notNull(),
  logoUrl: text("logo_url"),
  description: text("description"),
  marketCap: numeric("market_cap", { precision: 18, scale: 2 }),
  change24h: numeric("change_24h", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  isLocked: boolean("is_locked").notNull().default(false),
  metadata: json("metadata"),  // For storing coin-specific data like chart info, social links, etc.
});

export const insertCoinSchema = createInsertSchema(coins).omit({
  id: true,
});

// Add coin schema for API endpoints
export const addCoinSchema = z.object({
  name: z.string().min(1, "Name is required"),
  symbol: z.string().min(1, "Symbol is required").max(10, "Symbol must be 10 characters or less"),
  price: z.number().positive("Price must be positive"),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  description: z.string().optional(),
  marketCap: z.number().positive().optional(),
  change24h: z.number().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

// Purchase coin schema
export const purchaseCoinSchema = z.object({
  userId: z.number(),
  coinId: z.number(),
  amount: z.number().positive("Amount must be positive"),
});

// User login schema
export const userLoginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type InsertCoin = z.infer<typeof insertCoinSchema>;
export type Coin = typeof coins.$inferSelect;

// User portfolio/holdings schema
export const holdings = pgTable("holdings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  coinId: integer("coin_id").notNull().references(() => coins.id),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  purchasePrice: numeric("purchase_price", { precision: 18, scale: 8 }).notNull(),
  purchaseDate: timestamp("purchase_date").notNull().defaultNow(),
});

export const insertHoldingSchema = createInsertSchema(holdings).omit({
  id: true,
});

export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type Holding = typeof holdings.$inferSelect;

// Sessions table for express-session
export const sessions = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// Transactions schema
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  coinId: integer("coin_id").notNull().references(() => coins.id),
  type: text("type").notNull(), // 'buy', 'sell', 'fee', etc.
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  price: numeric("price", { precision: 18, scale: 8 }).notNull(),
  totalValue: numeric("total_value", { precision: 18, scale: 8 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // 'crypto', 'stripe', etc.
  status: text("status").notNull().default("completed"), // 'pending', 'completed', 'failed'
  metadata: json("metadata"), // For storing transaction-specific data like hash, sender, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Admin schemas for user management
export const updateUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").optional(),
  email: z.string().email("Must be a valid email").optional(),
  isAdmin: z.boolean().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

// Platform statistics schema for admin dashboard
export const statsSchema = z.object({
  totalUsers: z.number(),
  totalTransactions: z.number(),
  totalVolume: z.number(),
  activeCoins: z.number(),
  recentTransactions: z.array(z.any()), // Recent transaction details
});