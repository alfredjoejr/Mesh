import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

async function migrate() {
  const connectionString = process.env.DATABASE_URL?.replace('?sslmode=require', '');
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to database');

  const queries = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`,
    `CREATE TABLE IF NOT EXISTS confidential_rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      creator_id TEXT NOT NULL REFERENCES users(id),
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS room_members (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES confidential_rooms(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      fingerprint_seed TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS room_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES confidential_rooms(id),
      sender_id TEXT NOT NULL REFERENCES users(id),
      original_text TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS fingerprint_maps (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES room_messages(id),
      recipient_id TEXT NOT NULL REFERENCES users(id),
      fingerprinted_text TEXT NOT NULL,
      fingerprint_bits TEXT NOT NULL,
      layers JSONB
    )`,
    `CREATE TABLE IF NOT EXISTS leak_reports (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES confidential_rooms(id),
      reporter_id TEXT NOT NULL REFERENCES users(id),
      leaked_text TEXT NOT NULL,
      matched_user_id TEXT REFERENCES users(id),
      confidence TEXT,
      match_details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  ];

  for (const query of queries) {
    try {
      await client.query(query);
      const tableName = query.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
      console.log(`✅ Created table: ${tableName}`);
    } catch (err) {
      console.error(`❌ Error:`, err);
    }
  }

  await client.end();
  console.log('\nMigration complete!');
}

migrate().catch(console.error);
