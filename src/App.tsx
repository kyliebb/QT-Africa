import { useState } from 'react'
import { LayoutDashboard, Map, List, Users, RefreshCw, AlertCircle, MapPin, ExternalLink, Pencil, BarChart2, MapPinCheck, LogOut } from 'lucide-react'
import { useData } from './hooks/useData'
import { useAuth } from './hooks/useAuth'
import { signOut } from './lib/auth'
import SummaryCards from './components/SummaryCards'
import FilterBar from './components/FilterBar'
import DealerList from './components/DealerList'
import DealerMap from './components/DealerMap'
import AuditorPanel from './components/AuditorPanel'
import AuditorWorkload from './components/AuditorWorkload'
import LocationEditModal from './components/LocationEditModal'
import LoginPage from './components/LoginPage'
import PlacesVerification from './components/PlacesVerification'
import type { FilterState, Dealer } from './types'
import { BANKS } from './types'

type Tab = 'overview' | 'map' | 'list' | 'auditors' | 'workload' | 'places'

const DEFAULT_FILTERS: FilterState = {
  bank: 'all',
  province: 'all',
  auditorId: 'all',
  frequency: 'all',
  search: '',
  showDuplicates: false,
}

export default function App() {
  const session = useAuth()

  const {
    dealers, auditors, assignments, loading, error, reload,
    addAuditor, editAuditor, removeAuditor, assign, bulkAssign, patchDealer,
  } = useData()

  const [tab, setTab] = useState<Tab>('overview')
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [proximityKm, setProximityKm] = useState(35)
  const [focusDealer, setFocusDealer] = useState<Dealer | null>(null)
  const [mapFocusedDealer, setMapFocusedDealer] = useState<Dealer | null>(null)
  const [editingLocationDealer, setEditingLocationDealer] = useState<Dealer | null>(null)

  // Still determining auth state
  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not signed in — show login
  if (session === null) {
    return <LoginPage />
  }

  const filteredDealers = dealers.filter(d => {
    if (filters.bank !== 'all' && d.bank !== filters.bank) return false
    if (filters.province !== 'all' && d.province !== filters.province) return false
    if (filters.frequency !== 'all' && d.audit_frequency !== filters.frequency) return false
    if (filters.showDuplicates && !d.is_duplicate) return false
    if (filters.auditorId === 'unassigned' && assignments.has(d.id)) return false
    if (filters.auditorId !== 'all' && filters.auditorId !== 'unassigned' && assignments.get(d.id) !== filters.auditorId) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!d.name.toLowerCase().includes(q) && !d.city.toLowerCase().includes(q)) return false
    }
    return true
  })

  const handleSelectDealer = (dealer: Dealer) => {
    setFocusDealer(dealer)
    setTab('map')
  }

  const handleProvinceClick = (province: string) => {
    setFilters(f => ({ ...f, province: province as FilterState['province'] }))
    setTab('list')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 text-sm">Loading dealers…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="text-rose-500 mx-auto" size={40} />
          <h2 className="text-lg font-semibold text-slate-800">Connection error</h2>
          <p className="text-sm text-slate-500">{error}</p>
          <p className="text-xs text-slate-400">Check your Supabase environment variables in <code>.env</code></p>
          <button onClick={reload} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">QT</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">QuikTrak Africa</h1>
              <p className="text-xs text-slate-400 mt-0.5">Dealer Audit Planner</p>
            </div>
          </div>

          <nav className="flex gap-1 flex-wrap">
            {([
              ['overview', 'Overview', LayoutDashboard],
              ['map', 'Map', Map],
              ['list', 'Dealers', List],
              ['auditors', 'Auditors', Users],
              ['workload', 'Workload', BarChart2],
              ['places', 'Places', MapPinCheck],
            ] as [Tab, string, React.ElementType][]).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              onClick={reload}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              title="Refresh data"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => signOut()}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              title={`Sign out (${session.email})`}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-4">

        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <SummaryCards
                dealers={dealers}
                auditors={auditors}
                assignments={assignments}
                onProvinceClick={handleProvinceClick}
              />
            </div>
            <div>
              <AuditorPanel
                auditors={auditors}
                onAdd={addAuditor}
                onEdit={editAuditor}
                onDelete={removeAuditor}
                dealerCountFor={id => dealers.filter(d => assignments.get(d.id) === id).length}
              />
            </div>
          </div>
        )}

        {tab === 'map' && (
          <>
          {editingLocationDealer && (
            <LocationEditModal
              dealer={editingLocationDealer}
              onSave={patch => patchDealer(editingLocationDealer.id, patch)}
              onClose={() => setEditingLocationDealer(null)}
            />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: 'calc(100vh - 130px)' }}>
            <div className="lg:col-span-3 flex flex-col">
              <DealerMap
                dealers={filteredDealers}
                auditors={auditors}
                assignments={assignments}
                focusDealer={focusDealer}
                proximityKm={proximityKm}
                onProximityKmChange={setProximityKm}
                onBulkAssign={bulkAssign}
                onAssign={assign}
                onDealerFocus={d => setMapFocusedDealer(d)}
              />
            </div>
            <div className="space-y-3 overflow-y-auto">
              {/* Dealer info panel */}
              {mapFocusedDealer && (() => {
                const d = dealers.find(x => x.id === mapFocusedDealer.id) ?? mapFocusedDealer
                const bank = BANKS.find(b => b.value === d.bank)
                const auditorId = assignments.get(d.id)
                const auditor = auditors.find(a => a.id === auditorId)
                return (
                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{d.name}</p>
                        {d.dealer_code && (
                          <p className="font-mono text-xs text-slate-400">{d.dealer_code}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setEditingLocationDealer(d)}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                        title="Edit location"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={11} className="text-slate-400 shrink-0" />
                        <span>{d.city}, {d.province}</span>
                      </div>
                      {d.full_address && (
                        <p className="text-slate-400 pl-4 leading-tight">{d.full_address}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: bank?.colour ?? '#94a3b8' }}
                      >
                        {bank?.label ?? d.bank}
                      </span>
                      <span className="text-xs text-slate-500">{d.audit_frequency}d frequency</span>
                    </div>

                    {auditor && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: auditor.colour }} />
                        <span className="text-slate-600">{auditor.name}</span>
                      </div>
                    )}

                    {d.lat && d.lng && (
                      <p className="text-xs font-mono text-slate-400">{d.lat.toFixed(5)}, {d.lng.toFixed(5)}</p>
                    )}

                    {d.google_maps_url && (
                      <a
                        href={d.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink size={11} /> Open in Google Maps
                      </a>
                    )}
                  </div>
                )
              })()}

              <FilterBar
                filters={filters}
                auditors={auditors}
                onChange={f => { setFilters(f); setFocusDealer(null) }}
                totalVisible={filteredDealers.filter(d => d.lat && d.lng).length}
              />
              <AuditorPanel
                auditors={auditors}
                onAdd={addAuditor}
                onEdit={editAuditor}
                onDelete={removeAuditor}
                dealerCountFor={id => dealers.filter(d => assignments.get(d.id) === id).length}
              />
            </div>
          </div>
          </>
        )}

        {tab === 'list' && (
          <div className="space-y-3">
            <FilterBar
              filters={filters}
              auditors={auditors}
              onChange={setFilters}
              totalVisible={filteredDealers.length}
            />
            <DealerList
              dealers={filteredDealers}
              auditors={auditors}
              assignments={assignments}
              onAssign={assign}
              onPatchDealer={patchDealer}
              onSelectDealer={handleSelectDealer}
            />
          </div>
        )}

        {tab === 'auditors' && (
          <div className="max-w-xl">
            <AuditorPanel
              auditors={auditors}
              onAdd={addAuditor}
              onEdit={editAuditor}
              onDelete={removeAuditor}
              dealerCountFor={id => dealers.filter(d => assignments.get(d.id) === id).length}
            />
          </div>
        )}

        {tab === 'workload' && (
          <AuditorWorkload
            dealers={dealers}
            auditors={auditors}
            assignments={assignments}
            onAssign={assign}
            onPatchDealer={patchDealer}
          />
        )}

        {tab === 'places' && (
          <PlacesVerification
            dealers={dealers}
            onPatchDealer={patchDealer}
          />
        )}
      </main>
    </div>
  )
}
