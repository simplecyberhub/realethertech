import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Use the PostgreSQL database created by Replit
const databaseUrl = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

export const pool = new Pool({ 
  connectionString: databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  acquireTimeoutMillis: 60000,
  ssl: {
    rejectUnauthorized: false
  }
});

// Handle pool errors with better error handling
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Add connection retry logic
let retryCount = 0;
const maxRetries = 3;

export const db = drizzle(pool, { schema });

// Test connection on startup
export async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Database connection successful');
    retryCount = 0;
  } catch (error) {
    console.error(`Database connection failed (attempt ${retryCount + 1}/${maxRetries}):`, error);
    retryCount++;
    
    if (retryCount < maxRetries) {
      console.log(`Retrying database connection in 2 seconds...`);
      setTimeout(testConnection, 2000);
    } else {
      console.error('Max database connection retries reached');
    }
  }
}