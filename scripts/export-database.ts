import { storage } from "../server/storage";
import { writeFileSync } from "fs";
import { join } from "path";

// Database export utility
export async function exportDatabase() {
  console.log("Starting database export...");

  try {
    // Get all data from storage
    const users = await storage.getAllUsers();
    const coins = await storage.getAllCoins();
    const allHoldings = [];
    
    // Get holdings for each user
    for (const user of users) {
      const userHoldings = await storage.getUserHoldings(user.id);
      allHoldings.push(...userHoldings);
    }

    // Create export data
    const exportData = {
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        stripeCustomerId: user.stripeCustomerId,
        // Don't export password for security
      })),
      coins: coins.map(coin => ({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        price: coin.price,
        logoUrl: coin.logoUrl,
        description: coin.description,
        marketCap: coin.marketCap,
        change24h: coin.change24h,
        isActive: coin.isActive,
        isDefault: coin.isDefault,
        isLocked: coin.isLocked,
      })),
      holdings: allHoldings.map(holding => ({
        id: holding.id,
        userId: holding.userId,
        coinId: holding.coinId,
        amount: holding.amount,
        purchasePrice: holding.purchasePrice,
        purchaseDate: holding.purchaseDate,
      })),
      exportedAt: new Date().toISOString(),
    };

    // Create SQL export
    const sqlExport = generateSQLExport(exportData);
    
    // Write JSON export
    const jsonPath = join(process.cwd(), "database-export.json");
    writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
    
    // Write SQL export
    const sqlPath = join(process.cwd(), "database-export.sql");
    writeFileSync(sqlPath, sqlExport);
    
    console.log("Database export completed:");
    console.log(`JSON export: ${jsonPath}`);
    console.log(`SQL export: ${sqlPath}`);
    
    return { jsonPath, sqlPath, data: exportData };
  } catch (error) {
    console.error("Export failed:", error);
    throw error;
  }
}

function generateSQLExport(data: any): string {
  let sql = `-- Database Export - Generated on ${new Date().toISOString()}
-- Realethertech Cryptocurrency Platform

-- Create tables
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    is_admin BOOLEAN DEFAULT false,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS coins (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL UNIQUE,
    price DECIMAL(18,8) NOT NULL,
    logo_url TEXT,
    description TEXT,
    market_cap DECIMAL(18,2),
    change_24h DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    metadata JSON
);

CREATE TABLE IF NOT EXISTS holdings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    coin_id INTEGER REFERENCES coins(id),
    amount DECIMAL(18,8) NOT NULL,
    purchase_price DECIMAL(18,8) NOT NULL,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    coin_id INTEGER REFERENCES coins(id),
    type TEXT NOT NULL,
    amount DECIMAL(18,8) NOT NULL,
    price DECIMAL(18,8) NOT NULL,
    total_value DECIMAL(18,8) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert data
`;

  // Insert users
  if (data.users.length > 0) {
    sql += "\n-- Users data\n";
    data.users.forEach((user: any) => {
      sql += `INSERT INTO users (id, username, email, is_admin, stripe_customer_id) VALUES (${user.id}, '${user.username}', ${user.email ? `'${user.email}'` : 'NULL'}, ${user.isAdmin}, ${user.stripeCustomerId ? `'${user.stripeCustomerId}'` : 'NULL'});\n`;
    });
  }

  // Insert coins
  if (data.coins.length > 0) {
    sql += "\n-- Coins data\n";
    data.coins.forEach((coin: any) => {
      sql += `INSERT INTO coins (id, name, symbol, price, logo_url, description, market_cap, change_24h, is_active, is_default, is_locked) VALUES (${coin.id}, '${coin.name}', '${coin.symbol}', ${coin.price}, ${coin.logoUrl ? `'${coin.logoUrl}'` : 'NULL'}, ${coin.description ? `'${coin.description}'` : 'NULL'}, ${coin.marketCap || 'NULL'}, ${coin.change24h || 'NULL'}, ${coin.isActive}, ${coin.isDefault}, ${coin.isLocked});\n`;
    });
  }

  // Insert holdings
  if (data.holdings.length > 0) {
    sql += "\n-- Holdings data\n";
    data.holdings.forEach((holding: any) => {
      sql += `INSERT INTO holdings (id, user_id, coin_id, amount, purchase_price, purchase_date) VALUES (${holding.id}, ${holding.userId}, ${holding.coinId}, ${holding.amount}, ${holding.purchasePrice}, '${holding.purchaseDate}');\n`;
    });
  }

  sql += "\n-- Export completed\n";
  return sql;
}

// Add missing method to storage interface
declare module "../server/storage" {
  interface IStorage {
    getAllUsers(): Promise<any[]>;
  }
}

// If running directly
if (require.main === module) {
  exportDatabase().catch(console.error);
}