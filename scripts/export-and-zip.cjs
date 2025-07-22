const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Simple database export script
async function exportDatabase() {
  console.log('Starting database export...');
  
  // Since we're using MemStorage, we'll export the default data structure
  const exportData = {
    users: [
      {
        id: 1,
        username: 'admin',
        email: null,
        isAdmin: true,
        // Password is not exported for security
      }
    ],
    coins: [
      {
        id: 1,
        name: 'Bitcoin',
        symbol: 'BTC',
        price: '43123.45',
        logoUrl: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
        description: 'The original cryptocurrency.',
        marketCap: '810500000000',
        change24h: '2.3',
        isActive: true,
        isDefault: true,
        isLocked: false
      },
      {
        id: 2,
        name: 'Ethereum',
        symbol: 'ETH',
        price: '2415.78',
        logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        description: 'Decentralized software platform.',
        marketCap: '278900000000',
        change24h: '5.8',
        isActive: true,
        isDefault: true,
        isLocked: false
      },
      {
        id: 3,
        name: 'Cardano',
        symbol: 'ADA',
        price: '1.24',
        logoUrl: 'https://cryptologos.cc/logos/cardano-ada-logo.png',
        description: 'A proof-of-stake blockchain platform.',
        marketCap: '41500000000',
        change24h: '-1.2',
        isActive: true,
        isDefault: true,
        isLocked: false
      },
      {
        id: 4,
        name: 'Solana',
        symbol: 'SOL',
        price: '92.67',
        logoUrl: 'https://cryptologos.cc/logos/solana-sol-logo.png',
        description: 'A high-performance blockchain.',
        marketCap: '33200000000',
        change24h: '3.4',
        isActive: true,
        isDefault: true,
        isLocked: false
      }
    ],
    holdings: [
      {
        id: 1,
        userId: 1,
        coinId: 1,
        amount: '0.24',
        purchasePrice: '42000.00',
        purchaseDate: new Date().toISOString()
      },
      {
        id: 2,
        userId: 1,
        coinId: 2,
        amount: '1.56',
        purchasePrice: '2300.00',
        purchaseDate: new Date().toISOString()
      },
      {
        id: 3,
        userId: 1,
        coinId: 4,
        amount: '2.3',
        purchasePrice: '90.15',
        purchaseDate: new Date().toISOString()
      }
    ],
    exportedAt: new Date().toISOString(),
    platform: 'Realethertech - Cryptocurrency Trading Platform'
  };

  return exportData;
}

// Generate SQL export
function generateSQLExport(data) {
  let sql = `-- Database Export - Generated on ${new Date().toISOString()}
-- Realethertech - Cryptocurrency Trading Platform
-- This file contains the database schema and sample data

-- Create database schema
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

CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP NOT NULL
);

-- Insert sample data
-- Note: Passwords should be properly hashed in production
INSERT INTO users (id, username, is_admin) VALUES (1, 'admin', true);

-- Insert cryptocurrency data
`;

  data.coins.forEach(coin => {
    sql += `INSERT INTO coins (id, name, symbol, price, logo_url, description, market_cap, change_24h, is_active, is_default, is_locked) VALUES (${coin.id}, '${coin.name}', '${coin.symbol}', ${coin.price}, '${coin.logoUrl}', '${coin.description}', ${coin.marketCap}, ${coin.change24h}, ${coin.isActive}, ${coin.isDefault}, ${coin.isLocked});\n`;
  });

  sql += '\n-- Insert holdings data\n';
  data.holdings.forEach(holding => {
    sql += `INSERT INTO holdings (id, user_id, coin_id, amount, purchase_price, purchase_date) VALUES (${holding.id}, ${holding.userId}, ${holding.coinId}, ${holding.amount}, ${holding.purchasePrice}, '${holding.purchaseDate}');\n`;
  });

  sql += '\n-- Reset sequences\n';
  sql += 'SELECT setval(\'users_id_seq\', (SELECT MAX(id) FROM users));\n';
  sql += 'SELECT setval(\'coins_id_seq\', (SELECT MAX(id) FROM coins));\n';
  sql += 'SELECT setval(\'holdings_id_seq\', (SELECT MAX(id) FROM holdings));\n';
  sql += '\n-- Export completed\n';
  
  return sql;
}

async function createDatabaseExport() {
  try {
    console.log('Creating database export...');
    
    // Export database
    const data = await exportDatabase();
    const sql = generateSQLExport(data);
    
    // Write files
    fs.writeFileSync('database-export.json', JSON.stringify(data, null, 2));
    fs.writeFileSync('database-export.sql', sql);
    
    console.log('Database export files created:');
    console.log('- database-export.json');
    console.log('- database-export.sql');
    
    return { data, sql };
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

async function createZipFile() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream('database-export.zip');
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', function() {
      console.log('Database export zip created: database-export.zip');
      console.log('Total size: ' + archive.pointer() + ' bytes');
      resolve('database-export.zip');
    });

    archive.on('error', function(err) {
      reject(err);
    });

    archive.pipe(output);
    
    // Add the export files
    archive.file('database-export.json', { name: 'database-export.json' });
    archive.file('database-export.sql', { name: 'database-export.sql' });
    
    // Add project documentation
    if (fs.existsSync('replit.md')) {
      archive.file('replit.md', { name: 'replit.md' });
    }
    
    // Add package.json for reference
    if (fs.existsSync('package.json')) {
      archive.file('package.json', { name: 'package.json' });
    }
    
    // Add schema file
    if (fs.existsSync('shared/schema.ts')) {
      archive.file('shared/schema.ts', { name: 'schema.ts' });
    }
    
    archive.finalize();
  });
}

// Main execution
async function main() {
  try {
    await createDatabaseExport();
    await createZipFile();
    console.log('Database export and zip creation completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { exportDatabase, createDatabaseExport, createZipFile };