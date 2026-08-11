import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Use process.env.DATABASE_URL
const connectionString = process.env.DATABASE_URL?.replace('?sslmode=require', '');

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

export const db = drizzle(pool, { schema });
