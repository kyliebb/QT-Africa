import { useState } from 'react'
import { X, MapPin, ExternalLink, Search } from 'lucide-react'
import type { Dealer, Province } from '../types'
import { PROVINCES } from '../types'

interface Props {
  dealer: Dealer
  onSave: (patch: Partial<Dealer>) => void
  onClose: () => void
}

interface ParsedLocation {
  lat: number
  lng: number
  address?: string
  placeId?: string
}

function parseGoogleMapsUrl(url: string): ParsedLocation | null {
  const placeNameMatch = url.match(/\/maps\/place\/([^/@?]+)/)
  const address = placeNameMatch
    ? decodeURIComponent(placeNameMatch[1].replace(/\+/g, ' '))
    : undefined

  const placeIdMatch = url.match(/place_id:([A-Za-z0-9_-]+)/)
  const placeId = placeIdMatch?.[1]

  const d3Match = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/)
  if (d3Match) return { lat: parseFloat(d3Match[1]), lng: parseFloat(d3Match[2]), address, placeId }

  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]), address, placeId }

  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]), address }

  const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]), address }

  return null
}

function isShortUrl(url: string) {
  return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1">
      <span className="block text-xs font-medium text-slate-600">{children}</span>
      {hint && <span className="block text-xs text-slate-400 mt-0.5">{hint}</span>}
    </div>
  )
}

export default function LocationEditModal({ dealer, onSave, onClose }: Props) {
  const [city, setCity] = useState(dealer.city)
  const [province, setProvince] = useState<Province>(dealer.province)
  const [lat, setLat] = useState(String(dealer.lat ?? ''))
  const [lng, setLng] = useState(String(dealer.lng ?? ''))
  const [address, setAddress] = useState(dealer.full_address ?? '')
  const [mapsUrl, setMapsUrl] = useState(dealer.google_maps_url ?? '')
  const [placeId, setPlaceId] = useState(dealer.place_id ?? '')
  const [pasteUrl, setPasteUrl] = useState('')
  const [parseError, setParseError] = useState('')

  function handleParse() {
    if (!pasteUrl.trim()) return

    if (isShortUrl(pasteUrl)) {
      setParseError('SHORT_URL')
      return
    }

    const parsed = parseGoogleMapsUrl(pasteUrl)
    if (!parsed) {
      setParseError('Could not extract coordinates. Paste the full URL from your browser address bar after opening the place in Google Maps.')
      return
    }
    setParseError('')
    setLat(String(parsed.lat))
    setLng(String(parsed.lng))
    if (parsed.address && !address) setAddress(parsed.address)
    setMapsUrl(pasteUrl)
    if (parsed.placeId) setPlaceId(parsed.placeId)
    setPasteUrl('')
  }

  function handleSave() {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    onSave({
      city: city.trim() || dealer.city,
      province,
      lat: isNaN(latNum) ? null : latNum,
      lng: isNaN(lngNum) ? null : lngNum,
      full_address: address.trim() || null,
      google_maps_url: mapsUrl.trim() || null,
      place_id: placeId.trim() || null,
      enriched: !isNaN(latNum) && !isNaN(lngNum),
    })
    onClose()
  }

  const previewUrl = lat && lng
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800">Edit Location Details</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{dealer.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">

          {/* ── City & Province ─────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">City &amp; Province</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label hint="Proper casing, e.g. Cape Town">City</Label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Cape Town"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label hint="Select from the list">Province / Region</Label>
                <select
                  value={province}
                  onChange={e => setProvince(e.target.value as Province)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                >
                  {PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* ── Auto-fill from Google Maps URL ───────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">GPS Coordinates</p>
            <Label hint="Paste a full Google Maps URL to auto-fill the coordinates below">Auto-fill from Google Maps URL</Label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pasteUrl}
                onChange={e => { setPasteUrl(e.target.value); setParseError('') }}
                onKeyDown={e => e.key === 'Enter' && handleParse()}
                placeholder="https://maps.google.com/... or https://maps.app.goo.gl/..."
                className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleParse}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <Search size={13} />
                Parse
              </button>
            </div>
            {parseError === 'SHORT_URL' ? (
              <div className="mt-1.5 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                <p className="font-medium text-amber-800">Short URLs can't be parsed directly.</p>
                <p className="text-amber-700">
                  Open the link, wait for it to redirect, then copy the full URL from your browser's address bar and paste it here.
                </p>
                <a
                  href={pasteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                >
                  Open link <ExternalLink size={10} />
                </a>
              </div>
            ) : parseError ? (
              <p className="text-xs text-rose-500 mt-1">{parseError}</p>
            ) : null}
          </div>

          {/* Lat / Lng */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label hint="Negative values for Southern Hemisphere">Latitude</Label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder="-33.9198"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <Label hint="Positive values for Eastern longitudes">Longitude</Label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={e => setLng(e.target.value)}
                placeholder="18.4207"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* ── Reference details ────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reference Details</p>

            <div className="space-y-3">
              <div>
                <Label hint="Full street address including postal code">Full Address</Label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="123 Main St, City, 0001, South Africa"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <Label hint="Saved for external link — does not affect coordinates">Google Maps URL</Label>
                <input
                  type="text"
                  value={mapsUrl}
                  onChange={e => setMapsUrl(e.target.value)}
                  placeholder="https://www.google.com/maps/place/..."
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <Label hint="Starts with ChIJ — filled automatically when parsing a Maps URL">Google Place ID</Label>
                <input
                  type="text"
                  value={placeId}
                  onChange={e => setPlaceId(e.target.value)}
                  placeholder="ChIJ..."
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Preview link */}
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
            >
              <MapPin size={12} />
              Preview coordinates on Google Maps
              <ExternalLink size={11} />
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
