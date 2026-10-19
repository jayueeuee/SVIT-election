/**
 * Database Setup & Migration Runner
 * 
 * Automatically connects to PostgreSQL using DATABASE_URL from .env,
 * creates the database if it doesn't exist (local),
 * and executes database/schema.sql to build all tables and indexes.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

// 1. Load environment variables
const envPath = path.resolve(__dirname, '..', '.env');
const envExamplePath = path.resolve(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envExamplePath)) {
  console.log('[Notice] .env not found, reading from .env.example');
  dotenv.config({ path: envExamplePath });
} else {
  dotenv.config();
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('\n❌ ERROR: DATABASE_URL is not defined in your .env file.');
  console.error('\nPlease create a .env file with your PostgreSQL connection URL:');
  console.error('Example (Cloud - Neon / Supabase / Aiven / Render):');
  console.error('  DATABASE_URL=postgres://user:password@ep-sample.neon.tech/neondb?sslmode=require');
  console.error('Example (Local):');
  console.error('  DATABASE_URL=postgres://postgres:password@localhost:5432/college_election\n');
  process.exit(1);
}

// Helper to determine SSL settings for remote/cloud providers
function getClientConfig(connUrl) {
  const isLocal = connUrl.includes('localhost') || connUrl.includes('127.0.0.1');
  const needsSsl =
    connUrl.includes('sslmode=') ||
    connUrl.includes('.aivencloud.com') ||
    connUrl.includes('neon.tech') ||
    connUrl.includes('supabase.co') ||
    connUrl.includes('render.com') ||
    connUrl.includes('railway.app') ||
    !isLocal;

  // Strip sslmode query param so pg-connection-string does not force verify-full
  const cleanUrl = needsSsl
    ? connUrl.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
    : connUrl;

  return {
    connectionString: cleanUrl,
    ...(needsSsl && { ssl: { rejectUnauthorized: false } }),
  };
}

async function ensureDatabaseExists(connUrl) {
  const isLocal = connUrl.includes('localhost') || connUrl.includes('127.0.0.1');
  if (!isLocal) {
    // Cloud databases are managed and pre-created by the provider
    return;
  }

  try {
    const parsed = new URL(connUrl);
    const targetDb = parsed.pathname.replace(/^\//, '');

    if (!targetDb || targetDb === 'postgres') {
      return;
    }

    // Connect to maintenance 'postgres' database
    const maintenanceUrl = connUrl.replace(`/${targetDb}`, '/postgres');
    const maintenanceClient = new Client(getClientConfig(maintenanceUrl));

    await maintenanceClient.connect();

    const checkDb = await maintenanceClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDb]
    );

    if (checkDb.rows.length === 0) {
      console.log(`[Setup] Creating database "${targetDb}"...`);
      // Escape identifier safely
      const escapedDbName = targetDb.replace(/"/g, '""');
      await maintenanceClient.query(`CREATE DATABASE "${escapedDbName}"`);
      console.log(`[Setup] Database "${targetDb}" created successfully.`);
    }

    await maintenanceClient.end();
  } catch (error) {
    // If we can't connect to default 'postgres', continue and let primary connection report
    console.warn('[Setup Note] Could not verify database existence beforehand:', error.message);
  }
}

async function runSetup() {
  console.log('\n========================================');
  console.log(' College Election Database Setup Runner');
  console.log('========================================\n');

  console.log('[Setup] Connecting to PostgreSQL...');
  await ensureDatabaseExists(connectionString);

  const client = new Client(getClientConfig(connectionString));

  try {
    await client.connect();
    console.log('✔ Connected to PostgreSQL database successfully.\n');

    // Read schema.sql
    const schemaPath = path.resolve(__dirname, '..', 'database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    console.log(`[Setup] Reading schema from: database/schema.sql`);
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('[Setup] Executing database schema and migrations...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✔ Schema applied successfully.\n');

    // Verify all created tables
    const expectedTables = [
      'professors',
      'elections',
      'students',
      'student_requests',
      'positions',
      'candidates',
      'votes',
    ];

    console.log('---------------------------------------------------------');
    console.log(' Table Verification:');
    console.log('---------------------------------------------------------');

    for (const table of expectedTables) {
      const colRes = await client.query(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = $1
         ORDER BY ordinal_position`,
        [table]
      );

      if (colRes.rows.length > 0) {
        console.log(` ✔ Table "${table}" is ready (${colRes.rows.length} columns)`);
      } else {
        console.warn(` ⚠ Table "${table}" was not found!`);
      }
    }

    const indexRes = await client.query(
      `SELECT COUNT(*) as count FROM pg_indexes WHERE schemaname = 'public'`
    );
    console.log(` ✔ Total verified indexes: ${indexRes.rows[0].count}`);

    console.log('---------------------------------------------------------');
    console.log('\n🎉 Database setup completed successfully! Your database is ready.\n');

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('\n❌ Database setup failed:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Reason: The database host domain does not exist (DNS lookup failed).');
      console.error('  • If you are using Aiven: The trial might have expired, or the service is powered off / deleted.');
      console.error('  • To fix: Log into your cloud provider (Aiven, Neon, Supabase) and copy your active database URL into .env.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Reason: Connection refused. The database server is not running on that port or host.');
    } else if (error.code === '28P01') {
      console.error('\n💡 Reason: Password authentication failed. Please verify your username and password in .env.');
    } else if (error.code === '3D000') {
      console.error('\n💡 Reason: The specified database name does not exist on your PostgreSQL server.');
    }
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSetup();
