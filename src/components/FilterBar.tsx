import { Search, X } from 'lucide-react'
import type { FilterState, Auditor } from '../types'
import { BANKS, PROVINCES, AUDIT_FREQUENCIES } from '../types'

interface Props {
  filters: FilterState
  auditors: Auditor[]
  onChange: (f: FilterState) => void
  totalVisible: number
}

export default function FilterBar({ filters, auditors, onChange, totalVisible }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-3 flex flex-wrap gap-2 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search dealer or city…"
          value={filters.search}
          onChange={e => set({ search: e.target.value })}
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {filters.search && (
          <button onClick={() => set({ search: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Bank */}
      <Select
        value={filters.bank}
        onChange={v => set({ bank: v as FilterState['bank'] })}
        options={[{ value: 'all', label: 'All Banks' }, ...BANKS.map(b => ({ value: b.value, label: b.label }))]}
      />

      {/* Province */}
      <Select
        value={filters.province}
        onChange={v => set({ province: v as FilterState['province'] })}
        options={[{ value: 'all', label: 'All Provinces' }, ...PROVINCES.map(p => ({ value: p, label: p }))]}
      />

      {/* Auditor */}
      <Select
        value={filters.auditorId}
        onChange={v => set({ auditorId: v })}
        options={[
          { value: 'all', label: 'All Auditors' },
          { value: 'unassigned', label: 'Unassigned' },
          ...auditors.map(a => ({ value: a.id, label: a.name })),
        ]}
      />

      {/* Frequency */}
      <Select
        value={String(filters.frequency)}
        onChange={v => set({ frequency: v === 'all' ? 'all' : parseInt(v) })}
        options={[
          { value: 'all', label: 'All Frequencies' },
          ...AUDIT_FREQUENCIES.map(f => ({ value: String(f), label: `${f} days` })),
        ]}
      />

      {/* Verification status */}
      <Select
        value={filters.placesStatus}
        onChange={v => set({ placesStatus: v as FilterState['placesStatus'] })}
        options={[
          { value: 'all', label: 'All Statuses' },
          { value: 'verified', label: 'Verified' },
          { value: 'unverified', label: 'Unverified' },
          { value: 'flagged', label: 'Flagged' },
        ]}
      />

      {/* Duplicates toggle */}
      <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none whitespace-nowrap">
        <input
          type="checkbox"
          checked={filters.showDuplicates}
          onChange={e => set({ showDuplicates: e.target.checked })}
          className="rounded"
        />
        Show duplicates only
      </label>

      {/* Result count */}
      <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">{totalVisible.toLocaleString()} shown</span>
    </div>
  )
}

function Select({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
