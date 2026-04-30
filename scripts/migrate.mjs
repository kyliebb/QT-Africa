/**
 * Migration script — run once before seeding the full dataset.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your_service_role_key \
 *   node scripts/migrate.mjs
 *
 * What it does:
 *   1. Deletes all existing dealer + assignment rows (clean slate for re-seed)
 *   2. Prints the DDL you need to paste into the Supabase SQL Editor once
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY'); process.exit(1) }

const supabase = createClient(url, key)

console.log('Clearing assignments...')
const { error: e1 } = await supabase.from('assignments').delete().neq('dealer_id', '00000000-0000-0000-0000-000000000000')
if (e1) { console.error('assignments delete error:', e1); process.exit(1) }

console.log('Clearing dealers...')
const { error: e2 } = await supabase.from('dealers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
if (e2) { console.error('dealers delete error:', e2); process.exit(1) }

console.log('Done — table cleared.\n')
console.log('─────────────────────────────────────────────────────────')
console.log('ACTION REQUIRED: run this in the Supabase SQL Editor once:')
console.log('─────────────────────────────────────────────────────────')
console.log('ALTER TABLE dealers ADD COLUMN IF NOT EXISTS dealer_code text;')
console.log('─────────────────────────────────────────────────────────')
console.log('\nThen run: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... BANK=wesbank node scripts/seed.mjs')
