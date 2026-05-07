/**
 * Nedbank enrichment script — run once locally, never deployed.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=your_key node scripts/enrich-nedbank.mjs
 *
 * Reads:  Resources/Quik Trak Africa - Nedbank locations.csv
 * Writes: output/dealers-nedbank.json
 *
 * Unlike the WesBank script, this ALWAYS calls the Places API because
 * the source coordinates were manually entered and need verification.
 * Original CSV coords are stored alongside for comparison.
 *
 * Then run: BANK=nedbank node scripts/seed.mjs
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
  JOHANNESBURG: 'Gauteng', JOBURG: 'Gauteng', SANDTON: 'Gauteng', PRETORIA: 'Gauteng',
  CENTURION: 'Gauteng', MIDRAND: 'Gauteng', BOKSBURG: 'Gauteng', BENONI: 'Gauteng',
  GERMISTON: 'Gauteng', ALBERTON: 'Gauteng', KEMPTON: 'Gauteng', ISANDO: 'Gauteng',
  BRYANSTON: 'Gauteng', RANDBURG: 'Gauteng', ROODEPOORT: 'Gauteng', SOWETO: 'Gauteng',
  EDENVALE: 'Gauteng', SPRINGS: 'Gauteng', BRAKPAN: 'Gauteng', LENASIA: 'Gauteng',
  VANDERBIJLPARK: 'Gauteng', VEREENIGING: 'Gauteng', GAUTENG: 'Gauteng',
  'CAPE TOWN': 'Western Cape', STELLENBOSCH: 'Western Cape', PAARL: 'Western Cape',
  BRACKENFELL: 'Western Cape', BELLVILLE: 'Western Cape', SOMERSET: 'Western Cape',
  STRAND: 'Western Cape', GEORGE: 'Western Cape', WORCESTER: 'Western Cape',
  'MOSSEL BAY': 'Western Cape', MOSSELBAAI: 'Western Cape', HERMANUS: 'Western Cape',
  MALMESBURY: 'Western Cape', VREDENBURG: 'Western Cape',
  DURBAN: 'KwaZulu-Natal', UMHLANGA: 'KwaZulu-Natal', PINETOWN: 'KwaZulu-Natal',
  NEWCASTLE: 'KwaZulu-Natal', BALLITO: 'KwaZulu-Natal', TONGAAT: 'KwaZulu-Natal',
  MOBENI: 'KwaZulu-Natal', 'KWAZULU-NATAL': 'KwaZulu-Natal',
  'PORT ELIZABETH': 'Eastern Cape', GQEBERHA: 'Eastern Cape', QGEBRHA: 'Eastern Cape',
  'EAST LONDON': 'Eastern Cape', UITENHAGE: 'Eastern Cape', 'JEFFREYS BAY': 'Eastern Cape',
  POLOKWANE: 'Limpopo', MOKOPANE: 'Limpopo', LEPHALALE: 'Limpopo', ELLISRAS: 'Limpopo',
  'BELA BELA': 'Limpopo', MODIMOLLE: 'Limpopo',
  MBOMBELA: 'Mpumalanga', NELSPRUIT: 'Mpumalanga', 'PIET RETIEF': 'Mpumalanga',
  BLOEMFONTEIN: 'Free State', WELKOM: 'Free State',
  KIMBERLEY: 'Northern Cape',
  RUSTENBURG: 'North West', KLERKSDORP: 'North West', BRITS: 'North West',
  MAHIKENG: 'North West', MAFIKENG: 'North West', VRYBURG: 'North West',
}

function detectProvince(city) {
  if (!city) return 'Unknown'
  const upper = city.toUpperCase()
  for (const [key, province] of Object.entries(PROVINCE_MAP)) {
    if (upper.includes(key)) return province
  }
  return 'Unknown'
}

// South Africa: lat ≈ -22 to -35 (negative), lng ≈ 16 to 34 (positive)
// The CSV columns are inconsistently labeled — detect the correct orientation.
function parseCoords(rawA, rawB) {
  const a = parseFloat(rawA)
  const b = parseFloat(rawB)
  if (isNaN(a) || isNaN(b)) return { lat: null, lng: null }
  const looksLikeLat = v => v < -10 && v > -40
  const looksLikeLng = v => v > 10 && v < 40
  if (looksLikeLat(a) && looksLikeLng(b)) return { lat: a, lng: b }
  if (looksLikeLat(b) && looksLikeLng(a)) return { lat: b, lng: a }
  return { lat: null, lng: null } // can't determine safely
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

function coordDrift(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lat2 == null) return null
  // Rough km distance using equirectangular approximation
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const x = dLng * Math.cos((lat1 + lat2) / 2 * Math.PI / 180)
  return Math.round(Math.sqrt(dLat * dLat + x * x) * R * 10) / 10
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const csvPath = path.resolve(__dirname, '../Resources/Quik Trak Africa - Nedbank locations.csv')
  const outputDir = path.resolve(__dirname, '../output')
  if (!existsSync(outputDir)) mkdirSync(outputDir)
  const outputPath = path.resolve(outputDir, 'dealers-nedbank.json')

  const rows = []
  await new Promise((resolve, reject) => {
    createReadStream(csvPath)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }))
      .on('data', row => rows.push(row))
      .on('end', resolve)
      .on('error', reject)
  })

  console.log(`Loaded ${rows.length} rows from CSV`)

  const dealers = []
  let verified = 0, fallback = 0, notFound = 0, coordWarnings = 0

  for (let i = 0; i < Math.min(rows.length, LIMIT); i++) {
    const row = rows[i]
    const name = row['Dealer Name']?.trim() ?? ''
    const city = row['City']?.trim() ?? ''
    const fq = parseInt(row['FQ']) || 30
    const qty = parseInt(row['Qty']) || null

    // Detect correct lat/lng orientation from the two CSV columns
    const csvCoords = parseCoords(row['Long'], row['Lat'])

    process.stdout.write(`[${i + 1}/${rows.length}] ${name} (${city})... `)

    let geoData = null
    try {
      geoData = await geocode(name, city)
      await sleep(200)
    } catch (e) {
      process.stdout.write(`FETCH ERROR: ${e.message}\n`)
    }

    let lat, lng, full_address, place_id, google_maps_url, coordsVerified

    if (geoData) {
      lat = geoData.lat
      lng = geoData.lng
      full_address = geoData.full_address
      place_id = geoData.place_id
      google_maps_url = geoData.google_maps_url
      coordsVerified = true
      verified++

      const drift = coordDrift(csvCoords.lat, csvCoords.lng, lat, lng)
      if (drift !== null && drift > 2) {
        coordWarnings++
        process.stdout.write(`OK ⚠ drift ${drift}km from CSV coords\n`)
      } else {
        process.stdout.write(`OK\n`)
      }
    } else if (csvCoords.lat !== null) {
      lat = csvCoords.lat
      lng = csvCoords.lng
      full_address = null
      place_id = null
      google_maps_url = `https://www.google.com/maps?q=${lat},${lng}`
      coordsVerified = false
      fallback++
      process.stdout.write(`NOT FOUND — using CSV coords\n`)
    } else {
      lat = null; lng = null; full_address = null; place_id = null; google_maps_url = null
      coordsVerified = false
      notFound++
      process.stdout.write(`NOT FOUND\n`)
    }

    dealers.push({
      id: crypto.randomUUID(),
      name,
      city,
      province: detectProvince(city),
      country: 'ZA',
      bank: 'nedbank',
      dealer_code: `NB-${String(i + 1).padStart(5, '0')}`,
      audit_frequency: fq,
      qty,
      lat,
      lng,
      full_address,
      google_maps_url,
      place_id,
      enriched: lat !== null,
      coords_verified: coordsVerified,
      csv_lat: csvCoords.lat,
      csv_lng: csvCoords.lng,
      is_duplicate: false,
      duplicate_tag: null,
    })

    if (dealers.length % 20 === 0) writeFileSync(outputPath, JSON.stringify(dealers, null, 2))
  }

  writeFileSync(outputPath, JSON.stringify(dealers, null, 2))
  console.log(`\nDone!`)
  console.log(`  ${verified} verified via Google Places`)
  console.log(`  ${fallback} fell back to CSV coords (Places returned nothing)`)
  console.log(`  ${notFound} missing coords entirely`)
  console.log(`  ${coordWarnings} had >2km drift between CSV and Places coords`)
  console.log(`\nOutput: ${outputPath}`)
  console.log(`Next step: BANK=nedbank node scripts/seed.mjs`)
}

main().catch(console.error)
