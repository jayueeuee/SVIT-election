const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
 throw new Error('DATABASE_URL environment variable is not set.');
}

const isLocal =
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1');

const needsSsl =
  connectionString.includes('sslmode=') ||
  connectionString.includes('.aivencloud.com') ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('supabase.co') ||
  connectionString.includes('render.com') ||
  connectionString.includes('railway.app') ||
  process.env.NODE_ENV === 'production' ||
  !isLocal;

const cleanConnectionString = needsSsl
  ? connectionString.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
  : connectionString;

const pool = new Pool({
  connectionString: cleanConnectionString,
  max: 20,
  ...(needsSsl && { ssl: { rejectUnauthorized: false } }),
});

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
};
