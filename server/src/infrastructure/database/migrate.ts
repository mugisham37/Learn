/**
 * Database Migration Runner
 *
 * Runs pending database migrations using Drizzle Kit
 */

import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import { simpleLogger } from '../../shared/utils/simpleLogger.js';

dotenv.config();

async function runMigrations(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'],
  });

  const db = drizzle(pool);

  simpleLogger.info('Running migrations...');

  try {
    await migrate(db, { migrationsFolder: './migrations' });
    simpleLogger.info('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void runMigrations();
