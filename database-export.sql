-- Database Export - Generated on 2025-07-12T22:03:50.741Z
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
INSERT INTO coins (id, name, symbol, price, logo_url, description, market_cap, change_24h, is_active, is_default, is_locked) VALUES (1, 'Bitcoin', 'BTC', 43123.45, 'https://cryptologos.cc/logos/bitcoin-btc-logo.png', 'The original cryptocurrency.', 810500000000, 2.3, true, true, false);
INSERT INTO coins (id, name, symbol, price, logo_url, description, market_cap, change_24h, is_active, is_default, is_locked) VALUES (2, 'Ethereum', 'ETH', 2415.78, 'https://cryptologos.cc/logos/ethereum-eth-logo.png', 'Decentralized software platform.', 278900000000, 5.8, true, true, false);
INSERT INTO coins (id, name, symbol, price, logo_url, description, market_cap, change_24h, is_active, is_default, is_locked) VALUES (3, 'Cardano', 'ADA', 1.24, 'https://cryptologos.cc/logos/cardano-ada-logo.png', 'A proof-of-stake blockchain platform.', 41500000000, -1.2, true, true, false);
INSERT INTO coins (id, name, symbol, price, logo_url, description, market_cap, change_24h, is_active, is_default, is_locked) VALUES (4, 'Solana', 'SOL', 92.67, 'https://cryptologos.cc/logos/solana-sol-logo.png', 'A high-performance blockchain.', 33200000000, 3.4, true, true, false);

-- Insert holdings data
INSERT INTO holdings (id, user_id, coin_id, amount, purchase_price, purchase_date) VALUES (1, 1, 1, 0.24, 42000.00, '2025-07-12T22:03:50.739Z');
INSERT INTO holdings (id, user_id, coin_id, amount, purchase_price, purchase_date) VALUES (2, 1, 2, 1.56, 2300.00, '2025-07-12T22:03:50.740Z');
INSERT INTO holdings (id, user_id, coin_id, amount, purchase_price, purchase_date) VALUES (3, 1, 4, 2.3, 90.15, '2025-07-12T22:03:50.740Z');

-- Reset sequences
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('coins_id_seq', (SELECT MAX(id) FROM coins));
SELECT setval('holdings_id_seq', (SELECT MAX(id) FROM holdings));

-- Export completed
