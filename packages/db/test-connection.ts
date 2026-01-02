import dotenv from 'dotenv';
dotenv.config({ path: '../../apps/web/.env' });

import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || '';
console.log('Testing URL:', url.substring(0, 80) + '...');

const sql = neon(url);

async function test() {
  try {
    const result = await sql`SELECT 1 as test`;
    console.log('✅ Direct Neon connection OK:', result);
  } catch (e: any) {
    console.error('❌ Neon Error:', e.message);
    if (e.cause) console.error('Cause:', e.cause);
  }
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
