import { useEffect, useRef, useState, useMemo } from 'react'
import type { Map as LeafletMap, CircleMarker } from 'leaflet'
import { ChevronDown, Building2, X, Check, Pencil } from 'lucide-react'
import type { Dealer, Auditor } from '../types'
import { AUDIT_FREQUENCIES } from '../types'

interface Props {
  dealers: Dealer[]
  auditors: Auditor[]
  assignments: Map<string, string>
  onAssign: (dealerId: string, auditorId: string | null) => void
  onPatchDealer: (id: string, patch: Partial<Dealer>) => void
}

const BANDS = [
  { label: 'Weekly',    min: 1,  max: 14,  colour: '#ef4444', badge: 'bg-rose-100 text-rose-700'   },
  { label: 'Monthly',   min: 15, max: 60,  colour: '#3b82f6', badge: 'bg-blue-100 text-blue-700'   },
  { label: 'Quarterly', min: 61, max: 9999, colour: '#22c55e', badge: 'bg-green-100 text-green-700' },
] as const

type BandRow = (typeof BANDS)[number] & {
  dealers: Dealer[]
  visitsPerWeek: number
  visitsPerMonth: number
}

function getBand(freq: number) {
  return BANDS.find(b => freq >= b.min && freq <= b.max) ?? BANDS[2]
}

function fmt(n: number, decimals = 1) {
  return n % 1 === 0 ? n.toString() : n.toFixed(decimals)
}

// Module-level Leaflet reference — same pattern as DealerMap.tsx
let L: typeof import('leaflet') | null = null

// ─── WorkloadMap ─────────────────────────────────────────────────────────────

interface WorkloadMapProps {
  dealers: Dealer[]
  auditors: Auditor[]
  currentAuditorId: string
  focusDealerId: string | null
  onAssign: (dealerId: string, auditorId: string | null) => void
  onPatchDealer: (id: string, patch: Partial<Dealer>) => void
}

function WorkloadMap({
  dealers, auditors, currentAuditorId, focusDealerId, onAssign, onPatchDealer,
}: WorkloadMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<Map<string, CircleMarker>>(new Map())
  const [leafletLoaded, setLeafletLoaded] = useState(false)
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null)
  const [reassignTo, setReassignTo] = useState('')
  const [editingFreq, setEditingFreq] = useState<number | null>(null)

  useEffect(() => {
    import('leaflet').then(mod => { L = mod.default; setLeafletLoaded(true) })
  }, [])

  useEffect(() => {
    if (!leafletLoaded || !L || !containerRef.current || mapRef.current) return
    mapRef.current = L.map(containerRef.current, { center: [-29, 25], zoom: 6 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current)
    return () => { mapRef.current?.remove(); mapRef.current = null }
  }, [leafletLoaded])

  const activateDealer = (d: Dealer) => {
    setSelectedDealer(d)
    setReassignTo('')
    setEditingFreq(null)
    markersRef.current.forEach((m, id) => {
      m.setStyle({ weight: id === d.id ? 3 : 1.5, radius: id === d.id ? 13 : 8 } as Parameters<typeof m.setStyle>[0])
    })
    if (d.lat && d.lng) mapRef.current?.setView([d.lat, d.lng], 14, { animate: true })
  }

  useEffect(() => {
    if (!leafletLoaded || !L || !mapRef.current) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current.clear()

    const mapped = dealers.filter(d => d.lat && d.lng)
    mapped.forEach(d => {
      const band = getBand(d.audit_frequency)
      const marker = L!.circleMarker([d.lat!, d.lng!], {
        radius: 8,
        fillColor: band.colour,
        color: '#fff',
        weight: 1.5,
        fillOpacity: 0.88,
      }).addTo(mapRef.current!)

      marker.bindTooltip(
        `<strong>${d.name}</strong><br/>${d.city} · ${d.province}<br/>Every ${d.audit_frequency}d · ${fmt(30 / d.audit_frequency, 1)}×/mo`,
        { sticky: true }
      )
      marker.on('click', () => activateDealer(d))
      markersRef.current.set(d.id, marker)
    })

    if (mapped.length > 0) {
      mapRef.current.fitBounds(
        L.latLngBounds(mapped.map(d => [d.lat!, d.lng!] as [number, number])),
        { padding: [30, 30], maxZoom: 12 }
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealers, leafletLoaded])

  // Focus on a specific dealer when selected from the cadence list
  useEffect(() => {
    if (!focusDealerId || !leafletLoaded) return
    const d = dealers.find(x => x.id === focusDealerId)
    if (d) activateDealer(d)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDealerId])

  const closePanel = () => {
    setSelectedDealer(null)
    setEditingFreq(null)
    markersRef.current.forEach(m => m.setStyle({ weight: 1.5, radius: 8 } as Parameters<typeof m.setStyle>[0]))
  }

  const handleReassign = () => {
    if (!selectedDealer || !reassignTo) return
    onAssign(selectedDealer.id, reassignTo === 'unassign' ? null : reassignTo)
    closePanel()
  }

  const handleFreqSave = () => {
    if (!selectedDealer || editingFreq === null) return
    onPatchDealer(selectedDealer.id, { audit_frequency: editingFreq })
    setSelectedDealer({ ...selectedDealer, audit_frequency: editingFreq })
    setEditingFreq(null)
  }

  const otherAuditors = auditors.filter(a => a.id !== currentAuditorId)

  return (
    <div className="relative w-full h-full" style={{ minHeight: 400 }}>
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden border border-slate-200 shadow-sm" />

      {selectedDealer && (
        <div className="absolute top-3 right-3 z-[1000] w-68 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden" style={{ width: 272 }}>
          {/* Header */}
          <div className="flex items-start gap-2 px-4 pt-4 pb-3">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
              style={{ backgroundColor: getBand(selectedDealer.audit_frequency).colour }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-sm leading-snug">{selectedDealer.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{selectedDealer.city} · {selectedDealer.province}</p>
            </div>
            <button onClick={closePanel} className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5 p-0.5">
              <X size={14} />
            </button>
          </div>

          {/* Frequency row */}
          <div className="px-4 pb-3 flex items-center gap-2">
            {editingFreq === null ? (
              <>
                <span className="text-xs text-slate-500 flex-1">
                  {getBand(selectedDealer.audit_frequency).label} · every {selectedDealer.audit_frequency} days
                  <span className="text-slate-400 ml-1">({fmt(30 / selectedDealer.audit_frequency, 1)}×/mo)</span>
                </span>
                <button
                  onClick={() => setEditingFreq(selectedDealer.audit_frequency)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0"
                >
                  <Pencil size={11} /> Edit freq
                </button>
              </>
            ) : (
              <>
                <select
                  autoFocus
                  value={editingFreq}
                  onChange={e => setEditingFreq(Number(e.target.value))}
                  className="flex-1 text-xs border border-blue-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {AUDIT_FREQUENCIES.map(f => (
                    <option key={f} value={f}>Every {f}d</option>
                  ))}
                </select>
                <button onClick={handleFreqSave} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Check size={12} />
                </button>
                <button onClick={() => setEditingFreq(null)} className="p-1.5 text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              </>
            )}
          </div>

          {/* Reassign */}
          <div className="border-t border-slate-100 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reassign to</p>
            <select
              value={reassignTo}
              onChange={e => setReassignTo(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select auditor…</option>
              {otherAuditors.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
              <option value="unassign">— Remove assignment</option>
            </select>
            <button
              onClick={handleReassign}
              disabled={!reassignTo}
              className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium"
            >
              <Check size={12} /> Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AuditorWorkload ─────────────────────────────────────────────────────────

export default function AuditorWorkload({ dealers, auditors, assignments, onAssign, onPatchDealer }: Props) {
  const [selectedAuditorId, setSelectedAuditorId] = useState<string>(auditors[0]?.id ?? '')
  const [focusDealerId, setFocusDealerId] = useState<string | null>(null)

  const auditor = auditors.find(a => a.id === selectedAuditorId) ?? auditors[0] ?? null

  useEffect(() => {
    if (!selectedAuditorId && auditors.length > 0) setSelectedAuditorId(auditors[0].id)
  }, [auditors, selectedAuditorId])

  // Reset focus when auditor switches
  useEffect(() => { setFocusDealerId(null) }, [selectedAuditorId])

  const myDealers = useMemo(
    () => dealers.filter(d => assignments.get(d.id) === auditor?.id),
    [dealers, assignments, auditor]
  )

  const stats = useMemo(() => {
    if (!myDealers.length) return null

    const bands: BandRow[] = BANDS.map(band => {
      const subset = myDealers.filter(d => d.audit_frequency >= band.min && d.audit_frequency <= band.max)
      return {
        ...band,
        dealers: subset,
        visitsPerWeek:  subset.reduce((s, d) => s + 7  / d.audit_frequency, 0),
        visitsPerMonth: subset.reduce((s, d) => s + 30 / d.audit_frequency, 0),
      }
    })

    const totalVisitsPerWeek  = bands.reduce((s, b) => s + b.visitsPerWeek, 0)
    const totalVisitsPerMonth = bands.reduce((s, b) => s + b.visitsPerMonth, 0)

    return {
      totalDealers: myDealers.length,
      withCoords: myDealers.filter(d => d.lat && d.lng).length,
      totalVisitsPerWeek,
      totalVisitsPerMonth,
      bands,
    }
  }, [myDealers])

  if (auditors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2">
        <Building2 size={32} className="opacity-40" />
        <p className="text-sm">No auditors yet. Add auditors and assign dealers first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Auditor selector */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="text-sm font-semibold text-slate-600 shrink-0">Viewing workload:</span>
        <div className="flex flex-wrap gap-2">
          {auditors.map(a => {
            const count = dealers.filter(d => assignments.get(d.id) === a.id).length
            const active = selectedAuditorId === a.id
            return (
              <button
                key={a.id}
                onClick={() => setSelectedAuditorId(a.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  active ? 'text-white shadow-sm border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
                style={active ? { backgroundColor: a.colour, borderColor: a.colour } : {}}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: active ? 'rgba(255,255,255,0.65)' : a.colour }}
                />
                {a.name}
                <span className={`text-xs font-normal ${active ? 'text-white/70' : 'text-slate-400'}`}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {!stats ? (
        <div className="flex flex-col items-center justify-center h-48 bg-white rounded-lg border border-slate-200 text-slate-400 space-y-2">
          <Building2 size={28} className="opacity-40" />
          <p className="text-sm">{auditor ? `${auditor.name} has no dealers assigned yet.` : 'Select an auditor.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4" style={{ minHeight: 'calc(100vh - 220px)' }}>

          {/* ── Left panel ── */}
          <div className="space-y-4 overflow-y-auto pr-1">

            {/* 3 stat cards */}
            <div className="grid grid-cols-1 gap-3">

              {/* Dealers assigned */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Dealers assigned</p>
                <p className="text-4xl font-bold text-slate-800">{stats.totalDealers}</p>
                <p className="text-xs text-slate-400 mt-1">{stats.withCoords} plotted on map</p>
              </div>

              {/* Weekly visits */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Visits per week</p>
                <p className="text-4xl font-bold text-slate-800">{fmt(stats.totalVisitsPerWeek, 1)}</p>
                <div className="mt-2 space-y-1">
                  {stats.bands.filter(b => b.dealers.length > 0).map(b => (
                    <div key={b.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.colour }} />
                      <span className="text-slate-500 flex-1">{b.label}</span>
                      <span className="font-semibold text-slate-700">{fmt(b.visitsPerWeek, 1)}</span>
                      <span className="text-slate-400">({b.dealers.length} dealers)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly visits */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Visits per month</p>
                <p className="text-4xl font-bold text-slate-800">{fmt(stats.totalVisitsPerMonth, 1)}</p>
                <div className="mt-2 space-y-1">
                  {stats.bands.filter(b => b.dealers.length > 0).map(b => (
                    <div key={b.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.colour }} />
                      <span className="text-slate-500 flex-1">{b.label}</span>
                      <span className="font-semibold text-slate-700">{fmt(b.visitsPerMonth, 1)}</span>
                      <span className="text-slate-400">({b.dealers.length} dealers)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cadence breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">By cadence — click dealer to locate on map</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {stats.bands.map(band => (
                  <BandSection
                    key={band.label}
                    band={band}
                    onSelectDealer={d => setFocusDealerId(prev => prev === d.id ? null : d.id)}
                    activeDealerId={focusDealerId}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: map ── */}
          <div className="xl:col-span-2 flex flex-col gap-3">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2 flex items-center gap-4 flex-wrap">
              {BANDS.map(b => (
                <div key={b.label} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: b.colour }} />
                  <span className="font-medium">{b.label}</span>
                  <span className="text-slate-400">({b.min}–{b.max > 999 ? '∞' : b.max}d)</span>
                </div>
              ))}
              <span className="ml-auto text-xs text-slate-400">
                Click pin or dealer row to select · {stats.withCoords}/{stats.totalDealers} plotted
              </span>
            </div>
            <div className="flex-1" style={{ minHeight: 500 }}>
              {auditor && (
                <WorkloadMap
                  key={auditor.id}
                  dealers={myDealers}
                  auditors={auditors}
                  currentAuditorId={auditor.id}
                  focusDealerId={focusDealerId}
                  onAssign={onAssign}
                  onPatchDealer={onPatchDealer}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BandSection ─────────────────────────────────────────────────────────────

function BandSection({
  band, onSelectDealer, activeDealerId,
}: {
  band: BandRow
  onSelectDealer: (d: Dealer) => void
  activeDealerId: string | null
}) {
  const [open, setOpen] = useState(false)
  if (band.dealers.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: band.colour }} />
        <span className="text-sm font-medium text-slate-700 flex-1">{band.label}</span>
        <div className="flex items-center gap-3 text-xs">
          <span className={`px-1.5 py-0.5 rounded-full font-semibold ${band.badge}`}>{band.dealers.length}</span>
          <span className="text-slate-500">{fmt(band.visitsPerMonth, 1)}/mo</span>
          <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-50 bg-slate-50/40">
          {band.dealers.map(d => {
            const active = d.id === activeDealerId
            return (
              <button
                key={d.id}
                onClick={() => onSelectDealer(d)}
                className={`w-full flex items-center gap-3 px-6 py-2.5 text-xs text-left transition-colors ${
                  active
                    ? 'bg-blue-50 border-l-2 border-blue-500'
                    : 'hover:bg-slate-100 border-l-2 border-transparent'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: band.colour, opacity: active ? 1 : 0.5 }}
                />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${active ? 'text-blue-800' : 'text-slate-700'}`}>{d.name}</p>
                  <p className="text-slate-400 truncate">{d.city} · {d.province}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-slate-500">every {d.audit_frequency}d</p>
                  <p className={`font-semibold ${active ? 'text-blue-700' : 'text-slate-600'}`}>
                    {fmt(30 / d.audit_frequency, 1)}×/mo
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
