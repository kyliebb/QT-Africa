import { useState, useMemo } from 'react'
import { LayoutDashboard, Map, List, Users, RefreshCw, AlertCircle } from 'lucide-react'
import { useData } from './hooks/useData'
import SummaryCards from './components/SummaryCards'
import FilterBar from './components/FilterBar'
import DealerList from './components/DealerList'
import DealerMap from './components/DealerMap'
import AuditorPanel from './components/AuditorPanel'
import type { FilterState, Dealer } from './types'

type Tab = 'overview' | 'map' | 'list' | 'auditors'

const DEFAULT_FILTERS: FilterState = {
  bank: 'all',
  province: 'all',
  auditorId: 'all',
  frequency: 'all',
  search: '',
  showDuplicates: false,
}

export default function App() {
  const {
    dealers, auditors, assignments, loading, error, reload,
    addAuditor, editAuditor, removeAuditor, assign, bulkAssign, patchDealer,
  } = useData()

  const [tab, setTab] = useState<Tab>('overview')
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [proximityKm, setProximityKm] = useState(35)
  const [focusDealer, setFocusDealer] = useState<Dealer | null>(null)

  const filteredDealers = useMemo(() => {
    return dealers.filter(d => {
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
  }, [dealers, filters, assignments])

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

          <nav className="flex gap-1">
            {([
              ['overview', 'Overview', LayoutDashboard],
              ['map', 'Map', Map],
              ['list', 'Dealers', List],
              ['auditors', 'Auditors', Users],
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

          <button
            onClick={reload}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            title="Refresh data"
          >
            <RefreshCw size={16} />
          </button>
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
              />
            </div>
            <div className="space-y-3 overflow-y-auto">
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
      </main>
    </div>
  )
}
