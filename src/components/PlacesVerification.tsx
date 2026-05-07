import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, CheckCircle, AlertTriangle, HelpCircle, ExternalLink, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { Dealer } from '../types'
import { BANKS } from '../types'

declare const google: any

interface PlacesResult {
  name: string
  formatted_address: string
  place_id: string
  lat: number
  lng: number
  maps_url: string
}

interface Props {
  dealers: Dealer[]
  onPatchDealer: (id: string, patch: Partial<Dealer>) => Promise<void>
}

const PAGE_SIZE = 20

function statusBadge(status: Dealer['places_status']) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle size={10} /> Verified
      </span>
    )
  }
  if (status === 'flagged') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle size={10} /> Flagged
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
      <HelpCircle size={10} /> Unverified
    </span>
  )
}

let mapsLoaded = false
let mapsLoading = false
const mapsCallbacks: Array<() => void> = []

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (mapsLoaded) { resolve(); return }
    mapsCallbacks.push(resolve)
    if (mapsLoading) return
    mapsLoading = true
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      mapsLoaded = true
      mapsCallbacks.forEach(cb => cb())
      mapsCallbacks.length = 0
    }
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
}

export default function PlacesVerification({ dealers, onPatchDealer }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unverified' | 'verified' | 'flagged'>('all')
  const [page, setPage] = useState(0)
  const [mapsReady, setMapsReady] = useState(mapsLoaded)
  const [mapsError, setMapsError] = useState<string | null>(null)
  const [checking, setChecking] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<Map<string, PlacesResult[] | 'error'>>(new Map())
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const mapDivRef = useRef<HTMLDivElement>(null)
  const placesServiceRef = useRef<any>(null)

  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string

  useEffect(() => {
    if (!apiKey) {
      setMapsError('VITE_GOOGLE_PLACES_API_KEY not set')
      return
    }
    loadGoogleMaps(apiKey)
      .then(() => setMapsReady(true))
      .catch(e => setMapsError(e.message))
  }, [apiKey])

  useEffect(() => {
    if (mapsReady && mapDivRef.current && !placesServiceRef.current) {
      const map = new google.maps.Map(mapDivRef.current, { center: { lat: -29, lng: 25 }, zoom: 5 })
      placesServiceRef.current = new google.maps.places.PlacesService(map)
    }
  }, [mapsReady])

  const filtered = dealers.filter(d => {
    if (statusFilter !== 'all' && (d.places_status ?? 'unverified') !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!d.name.toLowerCase().includes(q) && !d.city.toLowerCase().includes(q)) return false
    }
    return true
  })

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const pageDealers = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const handleSearch = (v: string) => { setSearch(v); setPage(0) }
  const handleFilter = (v: typeof statusFilter) => { setStatusFilter(v); setPage(0) }

  const checkDealer = useCallback((dealer: Dealer) => {
    if (!placesServiceRef.current) return
    setChecking(prev => new Set(prev).add(dealer.id))
    const query = `${dealer.name} ${dealer.city} South Africa`
    placesServiceRef.current.textSearch({ query }, (places: any[], status: string) => {
      setChecking(prev => { const n = new Set(prev); n.delete(dealer.id); return n })
      if (status !== 'OK' || !places?.length) {
        setResults(prev => new Map(prev).set(dealer.id, 'error'))
        return
      }
      const mapped: PlacesResult[] = places.slice(0, 3).map((p: any) => ({
        name: p.name,
        formatted_address: p.formatted_address,
        place_id: p.place_id,
        lat: p.geometry.location.lat(),
        lng: p.geometry.location.lng(),
        maps_url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
      }))
      setResults(prev => new Map(prev).set(dealer.id, mapped))
    })
  }, [])

  const confirm = async (dealer: Dealer, result: PlacesResult) => {
    setSaving(prev => new Set(prev).add(dealer.id))
    try {
      await onPatchDealer(dealer.id, {
        lat: result.lat,
        lng: result.lng,
        full_address: result.formatted_address,
        place_id: result.place_id,
        google_maps_url: result.maps_url,
        enriched: true,
        places_status: 'verified',
      })
      setResults(prev => { const n = new Map(prev); n.delete(dealer.id); return n })
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(dealer.id); return n })
    }
  }

  const flagDealer = async (dealer: Dealer) => {
    setSaving(prev => new Set(prev).add(dealer.id))
    try {
      await onPatchDealer(dealer.id, { places_status: 'flagged' })
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(dealer.id); return n })
    }
  }

  const counts = {
    all: dealers.length,
    unverified: dealers.filter(d => !d.places_status || d.places_status === 'unverified').length,
    verified: dealers.filter(d => d.places_status === 'verified').length,
    flagged: dealers.filter(d => d.places_status === 'flagged').length,
  }

  return (
    <div className="space-y-4">
      {/* Hidden div required by PlacesService */}
      <div ref={mapDivRef} style={{ width: 1, height: 1, position: 'absolute', top: -9999, left: -9999 }} />

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Google Places Verification</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Check each dealer's location against the Google Places API, then confirm or flag the result.
          </p>
        </div>

        {mapsError && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {mapsError}
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'unverified', 'verified', 'flagged'] as const).map(s => (
            <button
              key={s}
              onClick={() => handleFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1 opacity-70">({counts[s]})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search dealer name or city…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Dealer list */}
      <div className="space-y-3">
        {pageDealers.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-12">No dealers match your filters.</div>
        )}

        {pageDealers.map(dealer => {
          const bank = BANKS.find(b => b.value === dealer.bank)
          const isChecking = checking.has(dealer.id)
          const isSaving = saving.has(dealer.id)
          const result = results.get(dealer.id)
          const status = dealer.places_status ?? 'unverified'

          return (
            <div key={dealer.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              {/* Dealer header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">{dealer.name}</span>
                    {dealer.dealer_code && (
                      <span className="font-mono text-xs text-slate-400">{dealer.dealer_code}</span>
                    )}
                    {statusBadge(status)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {dealer.city}, {dealer.province}
                    {' · '}
                    <span
                      className="inline-block px-1.5 py-0 rounded text-white text-xs"
                      style={{ backgroundColor: bank?.colour ?? '#94a3b8' }}
                    >
                      {bank?.label ?? dealer.bank}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {status === 'unverified' && result === undefined && (
                    <button
                      onClick={() => checkDealer(dealer)}
                      disabled={isChecking || !mapsReady}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isChecking ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                      {isChecking ? 'Checking…' : 'Check Places'}
                    </button>
                  )}
                  {(status === 'verified' || status === 'flagged') && result === undefined && (
                    <button
                      onClick={() => checkDealer(dealer)}
                      disabled={isChecking || !mapsReady}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      {isChecking ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                      Re-check
                    </button>
                  )}
                </div>
              </div>

              {/* Current location data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                  <p className="font-medium text-slate-600 mb-1">Current data</p>
                  {dealer.lat && dealer.lng ? (
                    <>
                      <p className="font-mono text-slate-500">{dealer.lat.toFixed(5)}, {dealer.lng.toFixed(5)}</p>
                      {dealer.full_address && <p className="text-slate-600">{dealer.full_address}</p>}
                      {dealer.google_maps_url && (
                        <a href={dealer.google_maps_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                          <ExternalLink size={10} /> View on Maps
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-400 italic">No location data</p>
                  )}
                </div>

                {/* Places results */}
                {result === 'error' && (
                  <div className="bg-rose-50 rounded-lg p-3">
                    <p className="font-medium text-rose-600 mb-1">No results found</p>
                    <p className="text-rose-500">Google Places returned no matches for this dealer.</p>
                    <button
                      onClick={() => flagDealer(dealer)}
                      disabled={isSaving}
                      className="mt-2 flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
                    >
                      <AlertTriangle size={10} /> Flag as problem
                    </button>
                  </div>
                )}

                {Array.isArray(result) && (
                  <div className="space-y-2">
                    <p className="font-medium text-slate-600 text-xs">Places results — select to confirm:</p>
                    {result.map((r, i) => (
                      <div key={r.place_id}
                        className="border border-slate-200 rounded-lg p-3 space-y-1 hover:border-blue-300 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">{r.name}</p>
                            <p className="text-slate-500">{r.formatted_address}</p>
                            <p className="font-mono text-slate-400">{r.lat.toFixed(5)}, {r.lng.toFixed(5)}</p>
                          </div>
                          <a href={r.maps_url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 text-blue-600 hover:text-blue-800">
                            <ExternalLink size={12} />
                          </a>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => confirm(dealer, r)}
                            disabled={isSaving}
                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {isSaving ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                            {i === 0 ? 'Confirm' : 'Use this'}
                          </button>
                          {i === 0 && (
                            <button
                              onClick={() => flagDealer(dealer)}
                              disabled={isSaving}
                              className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
                            >
                              <AlertTriangle size={10} /> Flag
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 text-xs text-slate-600 disabled:opacity-40 hover:text-slate-900"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {page + 1} of {pageCount} · {filtered.length} dealers
          </span>
          <button
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            className="flex items-center gap-1 text-xs text-slate-600 disabled:opacity-40 hover:text-slate-900"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
