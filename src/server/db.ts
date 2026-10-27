/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[Server DB] Warning: DATABASE_URL is not set. Direct SQL pool will be unavailable.');
}

export const serverPool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

serverPool.on('error', (err) => {
  console.error('[Server DB] Unexpected error on idle client', err);
});
