/**
 * Seed script — pushes enriched dealer JSON into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your_service_role_key \
 *   BANK=wesbank \
 *   node scripts/seed.mjs
 *
 * Set BANK to 'wesbank', 'standardbank', or 'nedbank'.
 * Reads: output/dealers-{BANK}.json
 * Upserts into: dealers table (by id — safe to re-run)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY
const bank = process.env.BANK ?? 'wesbank'

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  const filePath = path.resolve(__dirname, `../output/dealers-${bank}.json`)
  const dealers = JSON.parse(readFileSync(filePath, 'utf8'))
  console.log(`Seeding ${dealers.length} ${bank} dealers...`)

  const CHUNK = 500
  for (let i = 0; i < dealers.length; i += CHUNK) {
    const chunk = dealers.slice(i, i + CHUNK)
    const { error } = await supabase.from('dealers').upsert(chunk, { onConflict: 'id' })
    if (error) { console.error('Error at chunk', i, error); process.exit(1) }
    console.log(`  Inserted rows ${i + 1}–${Math.min(i + CHUNK, dealers.length)}`)
  }
  console.log('Done!')
}

main().catch(console.error)
