/**
 * Import Standard Bank neighbouring-country dealers into Supabase.
 *
 * Usage (from project root):
 *   node scripts/import-standardbank-countries.mjs
 *
 * Reads .env for SUPABASE_SERVICE_KEY and VITE_SUPABASE_URL.
 * Uses the service key so RLS is bypassed for the insert.
 *
 * Safe to re-run — uses upsert on (name, bank) so duplicates are skipped.
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Load .env manually (no dotenv dependency needed) ──────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env')
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
)

const SUPABASE_URL = envVars['VITE_SUPABASE_URL']
const SUPABASE_SERVICE_KEY = envVars['SUPABASE_SERVICE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Dealer data ───────────────────────────────────────────────────────────────
// Source: Resources/Quik Trak Africa - Standard Bank Countries.csv
// Coordinates: enriched/corrected pair (cols 6-7) preferred over raw CSV pair.
// Motor Holdings Botswana has no verified coords — left null for Places verification.

const dealers = [
  {
    name: 'Diroyal Motors (SWA) (Pty) Ltd',
    city: 'Windhoek',
    province: 'Namibia',
    country: 'Namibia',
    bank: 'standardbank',
    audit_frequency: 30,
    qty: 130,
    lat: -22.54291545,
    lng: 17.05862825,
    enriched: true,
  },
  {
    name: 'Eswatini Autofin Investments (Pty) Ltd',
    city: 'Mbabane',
    province: 'Eswatini',
    country: 'Eswatini',
    bank: 'standardbank',
    audit_frequency: 30,
    qty: 15,
    lat: -26.3302806,
    lng: 31.14541568,
    enriched: true,
  },
  {
    name: 'Mbabane Motors (Pty) Ltd',
    city: 'Mbabane',
    province: 'Eswatini',
    country: 'Eswatini',
    bank: 'standardbank',
    audit_frequency: 30,
    qty: 56,
    lat: -26.32740482,
    lng: 31.14680389,
    enriched: true,
  },
  {
    name: 'Premier Auto Services Pty Ltd',
    city: 'Mbabane',
    province: 'Eswatini',
    country: 'Eswatini',
    bank: 'standardbank',
    audit_frequency: 30,
    qty: 10,
    lat: -26.49198454,
    lng: 31.30406313,
    enriched: true,
  },
  {
    name: 'Swazi Truck And Bus (Pty) Ltd',
    city: 'Eswatini',
    province: 'Eswatini',
    country: 'Eswatini',
    bank: 'standardbank',
    audit_frequency: 30,
    qty: 9,
    lat: -26.50386571,
    lng: 31.29905665,
    enriched: true,
  },
  {
    name: 'Power Projects Swaziland (Pty) Ltd',
    city: 'Matsapha',
    province: 'Eswatini',
    country: 'Eswatini',
    bank: 'standardbank',
    audit_frequency: 30,
    qty: 0,
    lat: null,
    lng: null,
    enriched: false,
  },
  {
    name: 'Motor Holdings (Botswana) Propriety Limited',
    city: 'Gaborone',
    province: 'Botswana',
    country: 'Botswana',
    bank: 'standardbank',
    audit_frequency: 30,
    qty: 20,
    // CSV had coords pointing to Johannesburg — leaving null for Places verification
    lat: null,
    lng: null,
    enriched: false,
  },
]

// Pad each record with the nullable fields Supabase expects
const rows = dealers.map(d => ({
  ...d,
  full_address: null,
  google_maps_url: null,
  place_id: null,
  dealer_code: null,
  is_duplicate: false,
  duplicate_tag: null,
  places_status: 'unverified',
}))

// ── Insert ────────────────────────────────────────────────────────────────────
console.log(`Importing ${rows.length} dealers…`)

const { data, error } = await supabase
  .from('dealers')
  .upsert(rows, { onConflict: 'name,bank', ignoreDuplicates: false })
  .select('id, name, city')

if (error) {
  console.error('Insert failed:', error.message)
  process.exit(1)
}

console.log('Done. Inserted/updated:')
data?.forEach(d => console.log(`  • ${d.name} (${d.city}) — ${d.id}`))
