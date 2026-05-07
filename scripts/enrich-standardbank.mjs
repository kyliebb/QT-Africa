/**
 * Standard Bank enrichment script — run once locally, never deployed.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=your_key node scripts/enrich-standardbank.mjs
 *
 * Reads:  Resources/Quik Trak Africa - Standard Bank Local.csv
 * Writes: output/dealers-standardbank.json
 *
 * The source CSV has two coordinate pairs per row (both manually entered),
 * many missing entirely. This script:
 *   1. Always queries Google Places to get a verified location
 *   2. Falls back to whichever CSV pair seems more accurate (pair 2 preferred
 *      as it appears more precise; large inter-pair drift is flagged)
 *   3. Deduplicates repeated name+city combos and tags them
 *
 * Then run: BANK=standardbank node scripts/seed.mjs
 */

import { createReadStream, writeFileSync, mkdirSync, existsSync } from 'fs'
import { parse } from 'csv-parse'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_KEY = process.env.GOOGLE_PLACES_API_KEY
if (!API_KEY) { console.error('Set GOOGLE_PLACES_API_KEY env var'); process.exit(1) }
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT) : Infinity

const PROVINCE_MAP = {
  // Gauteng
  JOHANNESBURG: 'Gauteng', JOBURG: 'Gauteng', SANDTON: 'Gauteng', PRETORIA: 'Gauteng',
  CENTURION: 'Gauteng', MIDRAND: 'Gauteng', BOKSBURG: 'Gauteng', BENONI: 'Gauteng',
  GERMISTON: 'Gauteng', ALBERTON: 'Gauteng', KEMPTON: 'Gauteng', EDENVALE: 'Gauteng',
  SPRINGS: 'Gauteng', BRAKPAN: 'Gauteng', ROODEPOORT: 'Gauteng', SOWETO: 'Gauteng',
  TARLTON: 'Gauteng', BASSONIA: 'Gauteng', GAUTENG: 'Gauteng', JOHANNESSBURG: 'Gauteng',
  // Western Cape
  'CAPE TOWN': 'Western Cape', STELLENBOSCH: 'Western Cape', PAARL: 'Western Cape',
  BELLVILLE: 'Western Cape', SOMERSET: 'Western Cape', STRAND: 'Western Cape',
  GEORGE: 'Western Cape', WORCESTER: 'Western Cape', 'MOSSEL BAY': 'Western Cape',
  HERMANUS: 'Western Cape', MALMESBURY: 'Western Cape', CERES: 'Western Cape',
  RICHWOOD: 'Western Cape', 'KOUE BOKKEVELD': 'Western Cape', KUILSRIVER: 'Western Cape',
  // KwaZulu-Natal
  DURBAN: 'KwaZulu-Natal', UMHLANGA: 'KwaZulu-Natal', PINETOWN: 'KwaZulu-Natal',
  HILLCREST: 'KwaZulu-Natal', PIETERMARITZBURG: 'KwaZulu-Natal', NEWCASTLE: 'KwaZulu-Natal',
  // Eastern Cape
  'PORT ELIZABETH': 'Eastern Cape', GQEBERHA: 'Eastern Cape', 'EAST LONDON': 'Eastern Cape',
  UITENHAGE: 'Eastern Cape', 'JEFFREYS BAY': 'Eastern Cape', 'EASTERN CAPE': 'Eastern Cape',
  FAIRVIEW: 'Eastern Cape', 'GRAAFF-REINET': 'Eastern Cape', 'GRAAF-REINET': 'Eastern Cape',
  // Limpopo
  POLOKWANE: 'Limpopo', MOKOPANE: 'Limpopo', LEPHALALE: 'Limpopo', 'BELA BELA': 'Limpopo',
  LETSITELE: 'Limpopo', TZANEEN: 'Limpopo',
  // Mpumalanga
  MBOMBELA: 'Mpumalanga', NELSPRUIT: 'Mpumalanga', EMALAHLENI: 'Mpumalanga',
  WITBANK: 'Mpumalanga', MIDDELBURG: 'Mpumalanga', 'PIET RETIEF': 'Mpumalanga',
  // Free State
  BLOEMFONTEIN: 'Free State', WELKOM: 'Free State', BETHLEHEM: 'Free State',
  // Northern Cape
  KIMBERLEY: 'Northern Cape', DOUGLAS: 'Northern Cape', POSTMASBURG: 'Northern Cape',
  UPINGTON: 'Northern Cape',
  // North West
  RUSTENBURG: 'North West', KLERKSDORP: 'North West', POTCHEFSTROOM: 'North West',
  MAHIKENG: 'North West', BRITS: 'North West', LICHTENBURG: 'North West',
}

function detectProvince(city) {
  if (!city) return 'Unknown'
  const upper = city.toUpperCase()
  for (const [key, province] of Object.entries(PROVINCE_MAP)) {
    if (upper.includes(key)) return province
  }
  return 'Unknown'
}

function parseCoord(raw) {
  if (!raw) return null
  // Remove stray spaces that break parseFloat (e.g. "- 26.08...")
  const cleaned = raw.replace(/\s/g, '')
  const v = parseFloat(cleaned)
  return isNaN(v) ? null : v
}

// Validate a South Africa coordinate pair
function validSACoords(lat, lng) {
  return lat !== null && lng !== null &&
    lat > -36 && lat < -20 &&
    lng > 14 && lng < 35
}

function bestCsvCoords(lat1, lng1, lat2, lng2) {
  const ok1 = validSACoords(lat1, lng1)
  const ok2 = validSACoords(lat2, lng2)
  if (ok2) return { lat: lat2, lng: lng2 }  // pair 2 is more precise
  if (ok1) return { lat: lat1, lng: lng1 }
  return { lat: null, lng: null }
}

function coordDrift(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lat2 == null) return null
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const x = dLng * Math.cos((lat1 + lat2) / 2 * Math.PI / 180)
  return Math.round(Math.sqrt(dLat * dLat + x * x) * R * 10) / 10
}

async function geocode(name, city) {
  const query = encodeURIComponent(`${name} ${city} South Africa`)
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=geometry,formatted_address,place_id,name&key=${API_KEY}`
  const res = await fetch(url)
  const json = await res.json()
  const candidate = json.candidates?.[0]
  if (!candidate) return null
  return {
    lat: candidate.geometry.location.lat,
    lng: candidate.geometry.location.lng,
    full_address: candidate.formatted_address,
    place_id: candidate.place_id,
    google_maps_url: `https://www.google.com/maps/place/?q=place_id:${candidate.place_id}`,
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const csvPath = path.resolve(__dirname, '../Resources/Quik Trak Africa - Standard Bank Local.csv')
  const outputDir = path.resolve(__dirname, '../output')
  if (!existsSync(outputDir)) mkdirSync(outputDir)
  const outputPath = path.resolve(outputDir, 'dealers-standardbank.json')

  const rows = []
  await new Promise((resolve, reject) => {
    createReadStream(csvPath)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, trim: true, relax_column_count: true }))
      .on('data', row => rows.push(row))
      .on('end', resolve)
      .on('error', reject)
  })

  console.log(`Loaded ${rows.length} rows from CSV`)

  // Deduplicate tracking: name+city → first occurrence index
  const seenKey = new Map()
  const dealers = []
  let verified = 0, fallback = 0, notFound = 0, coordWarnings = 0, duplicates = 0

  for (let i = 0; i < Math.min(rows.length, LIMIT); i++) {
    const row = rows[i]
    const name = row['Dealer Name']?.trim() ?? ''
    const city = row['City']?.trim() ?? ''
    const fq = parseInt(row['FQ']) || 30
    const qty = parseInt(row['Qty']) || null

    // Two CSV coordinate pairs
    const lat1 = parseCoord(row['Latitude'])
    const lng1 = parseCoord(row['Longitude'])
    const lat2 = parseCoord(row['Latitude2'])
    const lng2 = parseCoord(row['Longitude2'])

    const csvBest = bestCsvCoords(lat1, lng1, lat2, lng2)

    // Flag large inter-pair drift in the source data (informational only)
    const interPairDrift = (validSACoords(lat1, lng1) && validSACoords(lat2, lng2))
      ? coordDrift(lat1, lng1, lat2, lng2)
      : null

    // Detect duplicates
    const key = `${name.toLowerCase()}|${city.toLowerCase()}`
    const isDuplicate = seenKey.has(key)
    const duplicateTag = isDuplicate ? `DUP-SB-${String(seenKey.get(key) + 1).padStart(5, '0')}` : null
    if (!isDuplicate) seenKey.set(key, i)
    if (isDuplicate) duplicates++

    process.stdout.write(`[${i + 1}/${rows.length}] ${name} (${city})`)
    if (isDuplicate) process.stdout.write(` [DUP]`)
    process.stdout.write(`... `)

    let lat, lng, full_address, place_id, google_maps_url, coordsSource

    const geoData = await geocode(name, city).catch(() => null)
    await sleep(200)

    if (geoData && validSACoords(geoData.lat, geoData.lng)) {
      lat = geoData.lat
      lng = geoData.lng
      full_address = geoData.full_address
      place_id = geoData.place_id
      google_maps_url = geoData.google_maps_url
      coordsSource = 'places'
      verified++

      const drift = coordDrift(csvBest.lat, csvBest.lng, lat, lng)
      if (drift !== null && drift > 5) {
        coordWarnings++
        process.stdout.write(`OK ⚠ ${drift}km drift from CSV`)
        if (interPairDrift !== null && interPairDrift > 5) {
          process.stdout.write(` (CSV pairs also ${interPairDrift}km apart)`)
        }
        process.stdout.write('\n')
      } else {
        process.stdout.write(`OK\n`)
      }
    } else if (csvBest.lat !== null) {
      lat = csvBest.lat
      lng = csvBest.lng
      full_address = null
      place_id = null
      google_maps_url = `https://www.google.com/maps?q=${lat},${lng}`
      coordsSource = 'csv'
      fallback++
      process.stdout.write(`NOT FOUND — using CSV coords\n`)
    } else {
      lat = null; lng = null; full_address = null; place_id = null; google_maps_url = null
      coordsSource = null
      notFound++
      process.stdout.write(`NOT FOUND — no coords\n`)
    }

    dealers.push({
      id: crypto.randomUUID(),
      name,
      city,
      province: detectProvince(city),
      country: 'ZA',
      bank: 'standardbank',
      dealer_code: `SB-${String(i + 1).padStart(5, '0')}`,
      audit_frequency: fq,
      qty,
      lat,
      lng,
      full_address,
      google_maps_url,
      place_id,
      enriched: lat !== null,
      is_duplicate: isDuplicate,
      duplicate_tag: duplicateTag,
    })

    if (dealers.length % 20 === 0) writeFileSync(outputPath, JSON.stringify(dealers, null, 2))
  }

  writeFileSync(outputPath, JSON.stringify(dealers, null, 2))

  console.log(`\nDone!`)
  console.log(`  ${verified} verified via Google Places`)
  console.log(`  ${fallback} fell back to CSV coords (Places returned nothing)`)
  console.log(`  ${notFound} no coords at all`)
  console.log(`  ${coordWarnings} had >5km drift between CSV and Places coords`)
  console.log(`  ${duplicates} duplicate name+city entries tagged`)
  console.log(`\nOutput: ${outputPath}`)
  console.log(`Next step: BANK=standardbank node scripts/seed.mjs`)
}

main().catch(console.error)
