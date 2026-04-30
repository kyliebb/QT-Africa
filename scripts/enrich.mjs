/**
 * Enrichment script — run once locally, never deployed.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=your_key node scripts/enrich.mjs
 *
 * Reads:  ../Resources/Quik Trak Africa  - WesBank locations.csv
 * Writes: output/dealers-wesbank.json  (array of enriched Dealer objects)
 *
 * Then run: node scripts/seed.mjs   to push to Supabase.
 */

import { createReadStream, writeFileSync, mkdirSync, existsSync } from 'fs'
import { parse } from 'csv-parse'
import { createInterface } from 'readline'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_KEY = process.env.GOOGLE_PLACES_API_KEY
if (!API_KEY) { console.error('Set GOOGLE_PLACES_API_KEY env var'); process.exit(1) }
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT) : Infinity

// Province detection from city name
const PROVINCE_MAP = {
  // Gauteng
  JOHANNESBURG: 'Gauteng', JOBURG: 'Gauteng', SANDTON: 'Gauteng', PRETORIA: 'Gauteng',
  CENTURION: 'Gauteng', MIDRAND: 'Gauteng', BOKSBURG: 'Gauteng', BENONI: 'Gauteng',
  GERMISTON: 'Gauteng', ALBERTON: 'Gauteng', KEMPTON: 'Gauteng', ISANDO: 'Gauteng',
  BRYANSTON: 'Gauteng', RANDBURG: 'Gauteng', ROODEPOORT: 'Gauteng', SOWETO: 'Gauteng',
  BEDFORDVIEW: 'Gauteng', FOURWAYS: 'Gauteng', MENLYN: 'Gauteng', RIVONIA: 'Gauteng',
  NORTHCLIFF: 'Gauteng', SUNNINGHILL: 'Gauteng', BRUMA: 'Gauteng', NORTHGATE: 'Gauteng',
  SPRINGS: 'Gauteng', KRUGERSDORP: 'Gauteng', MOGALE: 'Gauteng', FLORIDA: 'Gauteng',
  EDENVALE: 'Gauteng', EASTRAND: 'Gauteng',
  // Western Cape
  'CAPE TOWN': 'Western Cape', STELLENBOSCH: 'Western Cape', PAARL: 'Western Cape',
  BELLVILLE: 'Western Cape', GOODWOOD: 'Western Cape', TOKAI: 'Western Cape',
  CLAREMONT: 'Western Cape', CENTURY: 'Western Cape', SOMERSET: 'Western Cape',
  STRAND: 'Western Cape', GEORGE: 'Western Cape', WORCESTER: 'Western Cape',
  'MOSSEL BAY': 'Western Cape', CALEDON: 'Western Cape', HERMANUS: 'Western Cape',
  MALMESBURY: 'Western Cape', CERES: 'Western Cape', ROBERTSON: 'Western Cape',
  MONTAGU: 'Western Cape', BREDASDORP: 'Western Cape', STIKLAND: 'Western Cape',
  KNYSNA: 'Western Cape', OUDTSHOORN: 'Western Cape', PIKETBERG: 'Western Cape',
  // KwaZulu-Natal
  DURBAN: 'KwaZulu-Natal', UMHLANGA: 'KwaZulu-Natal', PINETOWN: 'KwaZulu-Natal',
  HILLCREST: 'KwaZulu-Natal', PIETERMARITZBURG: 'KwaZulu-Natal', KOKSTAD: 'KwaZulu-Natal',
  STANGER: 'KwaZulu-Natal', NEWCASTLE: 'KwaZulu-Natal', DUNDEE: 'KwaZulu-Natal',
  'RICHARDS BAY': 'KwaZulu-Natal', UMLAZI: 'KwaZulu-Natal', EMPANGENI: 'KwaZulu-Natal',
  'PARK RYNIE': 'KwaZulu-Natal', MARGATE: 'KwaZulu-Natal', LADYSMITH: 'KwaZulu-Natal',
  // Eastern Cape
  'PORT ELIZABETH': 'Eastern Cape', GQEBERHA: 'Eastern Cape', 'EAST LONDON': 'Eastern Cape',
  'BEACON BAY': 'Eastern Cape', QUEENSTOWN: 'Eastern Cape', KOMANI: 'Eastern Cape',
  CRADOCK: 'Eastern Cape', 'PORT SHEPSTONE': 'Eastern Cape',
  // Limpopo
  POLOKWANE: 'Limpopo', MOKOPANE: 'Limpopo', LEPHALALE: 'Limpopo', BELA: 'Limpopo',
  'LOUIS TRICHARDT': 'Limpopo', MESSINA: 'Limpopo', THOHOYANDOU: 'Limpopo',
  HOEDSPRUIT: 'Limpopo', NERVANA: 'Limpopo',
  // Mpumalanga
  NELSPRUIT: 'Mpumalanga', MBOMBELA: 'Mpumalanga', WITBANK: 'Mpumalanga',
  MIDDELBURG: 'Mpumalanga', SECUNDA: 'Mpumalanga', ERMELO: 'Mpumalanga',
  BETHAL: 'Mpumalanga', BARBERTON: 'Mpumalanga', 'WHITE RIVER': 'Mpumalanga',
  STANDERTON: 'Mpumalanga', PIET: 'Mpumalanga', TRICHARDT: 'Mpumalanga',
  // Free State
  BLOEMFONTEIN: 'Free State', WELKOM: 'Free State', BETHLEHEM: 'Free State',
  'DE AAR': 'Free State', FICKSBURG: 'Free State', HARRISMITH: 'Free State',
  MARQUARD: 'Free State', BOTHAVILLE: 'Free State', KROONSTAD: 'Free State',
  // Northern Cape
  KIMBERLEY: 'Northern Cape', SPRINGBOK: 'Northern Cape', PRIESKA: 'Northern Cape',
  POSTMASBURG: 'Northern Cape', UPINGTON: 'Northern Cape', KURUMAN: 'Northern Cape',
  // North West
  RUSTENBURG: 'North West', KLERKSDORP: 'North West', POTCHEFSTROOM: 'North West',
  MAHIKENG: 'North West', LICHTENBURG: 'North West', BRITS: 'North West',
  MOOKGOPONG: 'North West', HAMILTON: 'North West',
  // Neighbours
  NAMIBIA: 'Namibia', WINDHOEK: 'Namibia',
  BOTSWANA: 'Botswana', GABORONE: 'Botswana',
  LESOTHO: 'Lesotho', MASERU: 'Lesotho',
  SWAZILAND: 'Eswatini', ESWATINI: 'Eswatini', MBABANE: 'Eswatini',
}

function detectProvince(city) {
  if (!city) return 'Unknown'
  const upper = city.toUpperCase()
  for (const [key, province] of Object.entries(PROVINCE_MAP)) {
    if (upper.includes(key)) return province
  }
  return 'Unknown'
}

function cleanCity(raw) {
  return raw?.replace(/["\n]/g, '').replace(/,\s*\d{4,5}.*$/, '').trim() ?? ''
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
  const csvPath = path.resolve(__dirname, '../Resources/Quik Trak Africa  - WesBank locations.csv')
  const outputDir = path.resolve(__dirname, '../output')
  if (!existsSync(outputDir)) mkdirSync(outputDir)

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
  let enriched = 0, skipped = 0

  for (let i = 0; i < Math.min(rows.length, LIMIT); i++) {
    const row = rows[i]
    const name = row['Dealer Name']?.trim() ?? ''
    const city = cleanCity(row['City'])
    const lat = parseFloat(row['Latitude']) || null
    const lng = parseFloat(row['Longitude']) || null
    const fq = parseInt(row['FQ']) || 30

    let geoData = null
    if (lat && lng) {
      geoData = {
        lat, lng,
        full_address: null,
        place_id: null,
        google_maps_url: `https://www.google.com/maps?q=${lat},${lng}`,
      }
      skipped++
    } else {
      process.stdout.write(`[${i + 1}/${rows.length}] Geocoding: ${name} (${city})... `)
      try {
        geoData = await geocode(name, city)
        if (geoData) { process.stdout.write('OK\n'); enriched++ }
        else { process.stdout.write('NOT FOUND\n') }
        await sleep(200) // respect Places API rate limits
      } catch (e) {
        process.stdout.write(`ERROR: ${e.message}\n`)
      }
    }

    const dealer = {
      id: crypto.randomUUID(),
      name,
      city,
      province: detectProvince(city),
      country: 'ZA',
      bank: 'wesbank',
      dealer_code: `WB-${String(i + 1).padStart(5, '0')}`,
      audit_frequency: fq,
      qty: parseInt(row['Qty']) || null,
      lat: geoData?.lat ?? null,
      lng: geoData?.lng ?? null,
      full_address: geoData?.full_address ?? null,
      google_maps_url: geoData?.google_maps_url ?? null,
      place_id: geoData?.place_id ?? null,
      enriched: !!geoData,
      is_duplicate: false,
      duplicate_tag: null,
    }
    dealers.push(dealer)

    // Checkpoint every 100 rows so progress is never lost
    if (dealers.length % 100 === 0) {
      writeFileSync(outputPath, JSON.stringify(dealers, null, 2))
    }
  }

  writeFileSync(outputPath, JSON.stringify(dealers, null, 2))
  console.log(`\nDone! ${enriched} geocoded, ${skipped} already had GPS, ${rows.length - enriched - skipped} not found.`)
  console.log(`Output: ${outputPath}`)
  console.log(`Next step: node scripts/seed.mjs`)
}

main().catch(console.error)
