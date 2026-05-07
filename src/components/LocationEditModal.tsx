import { useState } from 'react'
import { X, MapPin, ExternalLink, Search } from 'lucide-react'
import type { Dealer } from '../types'

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
  // Extract place name from URL path — used as address hint
  const placeNameMatch = url.match(/\/maps\/place\/([^/@?]+)/)
  const address = placeNameMatch
    ? decodeURIComponent(placeNameMatch[1].replace(/\+/g, ' '))
    : undefined

  // ChIJ... place_id in query string
  const placeIdMatch = url.match(/place_id:([A-Za-z0-9_-]+)/)
  const placeId = placeIdMatch?.[1]

  // !3d / !4d — actual place position (more accurate than the @ map-centre)
  const d3Match = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/)
  if (d3Match) return { lat: parseFloat(d3Match[1]), lng: parseFloat(d3Match[2]), address, placeId }

  // @LAT,LNG,ZOOMz — map centre fallback
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]), address, placeId }

  // ?q=LAT,LNG
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]), address }

  // ll=LAT,LNG
  const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]), address }

  return null
}

function isShortUrl(url: string) {
  return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)
}

export default function LocationEditModal({ dealer, onSave, onClose }: Props) {
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-800">Edit Location</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{dealer.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Paste Google Maps URL */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Paste a Google Maps URL to auto-fill coordinates
            </label>
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
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
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

          <div className="border-t border-slate-100" />

          {/* Lat / Lng */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
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

          {/* Full address */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Address</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St, City, 0001, South Africa"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Google Maps URL */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Google Maps URL</label>
            <input
              type="text"
              value={mapsUrl}
              onChange={e => setMapsUrl(e.target.value)}
              placeholder="https://www.google.com/maps/place/..."
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Place ID */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Google Place ID</label>
            <input
              type="text"
              value={placeId}
              onChange={e => setPlaceId(e.target.value)}
              placeholder="ChIJ..."
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              Preview on Google Maps
              <ExternalLink size={11} />
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
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
