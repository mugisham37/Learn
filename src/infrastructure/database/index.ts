/**
 * Database Connection and Configuration
 * 
 * Manages PostgreSQL connection using Drizzle ORM with connection pooling
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { config } from '../../config/index.js';

/**
 * PostgreSQL connection pool
 */
export const pool = new Pool({
  connectionString: config.database.url,
  min: config.database.poolMin,
  max: config.database.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/**
 * Drizzle ORM database instance
 */
export const db = drizzle(pool);

/**
 * Tests database connectivity
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Closes database connection pool
 */
export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
  console.log('Database connection closed');
}
