import { useEffect, useRef, useState, useCallback } from 'react'
import type { Map as LeafletMap, CircleMarker, Circle } from 'leaflet'
import type { Dealer, Auditor } from '../types'
import { BANKS } from '../types'
import { findNearby } from '../lib/geo'

interface Props {
  dealers: Dealer[]
  auditors: Auditor[]
  assignments: Map<string, string>
  focusDealer: Dealer | null
  proximityKm: number
  onProximityKmChange: (km: number) => void
  onBulkAssign: (dealerIds: string[], auditorId: string) => Promise<void>
  onAssign: (dealerId: string, auditorId: string | null) => void
}

// Leaflet is loaded dynamically to avoid SSR issues
let L: typeof import('leaflet') | null = null

function getBankColour(bank: string): string {
  return BANKS.find(b => b.value === bank)?.colour ?? '#94a3b8'
}

export default function DealerMap({
  dealers, auditors, assignments, focusDealer,
  proximityKm, onProximityKmChange, onBulkAssign,
}: Props) {
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Map<string, CircleMarker>>(new Map())
  const circleRef = useRef<Circle | null>(null)
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null)
  const [nearbyDealers, setNearbyDealers] = useState<Dealer[]>([])
  const [bulkAuditorId, setBulkAuditorId] = useState<string>('')
  const [leafletLoaded, setLeafletLoaded] = useState(false)

  // Lazy-load Leaflet
  useEffect(() => {
    import('leaflet').then(mod => {
      L = mod.default
      setLeafletLoaded(true)
    })
  }, [])

  // Initialise map
  useEffect(() => {
    if (!leafletLoaded || !L || !containerRef.current || mapRef.current) return

    mapRef.current = L.map(containerRef.current, {
      center: [-29, 25],
      zoom: 6,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current)

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [leafletLoaded])

  // Render dealer pins
  useEffect(() => {
    if (!mapRef.current || !L) return
    const map = mapRef.current

    // Remove old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current.clear()

    dealers.forEach(dealer => {
      if (!dealer.lat || !dealer.lng) return

      const auditorId = assignments.get(dealer.id)
      const auditor = auditors.find(a => a.id === auditorId)
      const bankColour = getBankColour(dealer.bank)
      const fillColour = auditor ? auditor.colour : bankColour

      const marker = L!.circleMarker([dealer.lat, dealer.lng], {
        radius: 7,
        fillColor: fillColour,
        color: auditor ? '#fff' : bankColour,
        weight: auditor ? 2 : 1,
        fillOpacity: 0.85,
      }).addTo(map)

      marker.on('click', () => handleDealerClick(dealer))

      const bankLabel = BANKS.find(b => b.value === dealer.bank)?.label ?? dealer.bank
      marker.bindTooltip(`
        <strong>${dealer.name}</strong><br/>
        ${dealer.city} · ${dealer.province}<br/>
        ${bankLabel} · ${dealer.audit_frequency}d<br/>
        ${auditor ? `<span style="color:${auditor.colour}">● ${auditor.name}</span>` : 'Unassigned'}
      `, { sticky: true })

      markersRef.current.set(dealer.id, marker)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealers, auditors, assignments, leafletLoaded])

  const handleDealerClick = useCallback((dealer: Dealer) => {
    if (!mapRef.current || !L) return
    const nearby = findNearby(dealer, dealers, proximityKm)
    setSelectedDealer(dealer)
    setNearbyDealers(nearby)

    // Draw proximity circle
    circleRef.current?.remove()
    if (dealer.lat && dealer.lng) {
      circleRef.current = L.circle([dealer.lat, dealer.lng], {
        radius: proximityKm * 1000,
        color: '#3b82f6',
        fillColor: '#93c5fd',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '6 4',
      }).addTo(mapRef.current)
    }

    // Highlight nearby pins
    markersRef.current.forEach((m, id) => {
      const isNearby = nearby.some(n => n.id === id)
      const isSelected = id === dealer.id
      m.setStyle({
        weight: isSelected ? 3 : isNearby ? 2 : 1,
        color: isSelected ? '#1e293b' : isNearby ? '#3b82f6' : undefined,
        radius: isSelected ? 10 : isNearby ? 8 : 6,
      } as L.CircleMarkerOptions)
    })
  }, [dealers, proximityKm])

  // Focus a dealer from outside (DealerList click)
  useEffect(() => {
    if (!focusDealer || !mapRef.current) return
    if (focusDealer.lat && focusDealer.lng) {
      mapRef.current.setView([focusDealer.lat, focusDealer.lng], 13)
      handleDealerClick(focusDealer)
    }
  }, [focusDealer, handleDealerClick])

  const clearSelection = () => {
    setSelectedDealer(null)
    setNearbyDealers([])
    circleRef.current?.remove()
    circleRef.current = null
    markersRef.current.forEach(m => {
      m.setStyle({ weight: 1, radius: 7, color: undefined } as L.CircleMarkerOptions)
    })
  }

  const handleBulkAssign = async () => {
    if (!selectedDealer || !bulkAuditorId) return
    const ids = [selectedDealer.id, ...nearbyDealers.map(d => d.id)]
    await onBulkAssign(ids, bulkAuditorId)
    clearSelection()
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Proximity control */}
      <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2">
        <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Proximity radius</span>
        <input
          type="range"
          min={5}
          max={200}
          step={5}
          value={proximityKm}
          onChange={e => {
            onProximityKmChange(Number(e.target.value))
            if (selectedDealer) handleDealerClick(selectedDealer)
          }}
          className="flex-1"
        />
        <span className="text-sm font-semibold text-blue-600 w-16 text-right">{proximityKm} km</span>
      </div>

      {/* Map container */}
      <div className="relative flex-1 rounded-lg overflow-hidden border border-slate-200 shadow-sm" style={{ minHeight: 400 }}>
        <div ref={containerRef} className="w-full h-full" />

        {/* Legend */}
        <div className="absolute bottom-6 left-2 z-[1000] bg-white rounded-lg shadow-md border border-slate-200 p-2 space-y-1">
          {BANKS.map(b => (
            <div key={b.value} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: b.colour }} />
              <span className="text-slate-600">{b.label}</span>
            </div>
          ))}
          <div className="border-t border-slate-100 pt-1 mt-1 flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full bg-white border-2 border-slate-400" />
            <span className="text-slate-500">Auditor assigned</span>
          </div>
        </div>
      </div>

      {/* Proximity selection panel */}
      {selectedDealer && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900">{selectedDealer.name}</p>
              <p className="text-xs text-blue-600">{selectedDealer.city} · {selectedDealer.province}</p>
            </div>
            <button onClick={clearSelection} className="text-blue-400 hover:text-blue-600 p-1">✕</button>
          </div>

          <p className="text-xs text-blue-700">
            <span className="font-semibold">{nearbyDealers.length}</span> dealers within {proximityKm} km
          </p>

          {nearbyDealers.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-0.5">
              {nearbyDealers.map(d => (
                <div key={d.id} className="flex items-center justify-between text-xs text-blue-800 bg-white rounded px-2 py-0.5">
                  <span className="truncate flex-1">{d.name}</span>
                  <span className="text-blue-400 ml-2">{d.city}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bulk assign */}
          {auditors.length > 0 && (
            <div className="flex gap-2">
              <select
                value={bulkAuditorId}
                onChange={e => setBulkAuditorId(e.target.value)}
                className="flex-1 text-xs border border-blue-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Assign group to auditor…</option>
                {auditors.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkAuditorId}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap"
              >
                Assign {nearbyDealers.length + 1}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
