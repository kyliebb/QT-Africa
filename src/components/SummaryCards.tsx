import type { Dealer, Auditor } from '../types'
import { BANKS, PROVINCES } from '../types'

interface Props {
  dealers: Dealer[]
  auditors: Auditor[]
  assignments: Map<string, string>
  onProvinceClick: (province: string) => void
}

export default function SummaryCards({ dealers, auditors, assignments, onProvinceClick }: Props) {
  const total = dealers.length
  const assigned = dealers.filter(d => assignments.has(d.id)).length
  const unassigned = total - assigned
  const unenriched = dealers.filter(d => !d.enriched).length

  const byBank = BANKS.map(b => ({
    ...b,
    count: dealers.filter(d => d.bank === b.value).length,
  }))

  const byProvince = PROVINCES
    .map(p => {
      const provDealers = dealers.filter(d => d.province === p)
      if (provDealers.length === 0) return null
      const auditorIds = new Set(provDealers.map(d => assignments.get(d.id)).filter(Boolean))
      return { province: p, dealers: provDealers.length, auditors: auditorIds.size }
    })
    .filter(Boolean) as { province: string; dealers: number; auditors: number }[]

  return (
    <div className="space-y-4">
      {/* Top-level stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Dealers" value={total} colour="bg-slate-700" />
        <StatCard label="Assigned" value={assigned} colour="bg-emerald-700" />
        <StatCard label="Unassigned" value={unassigned} colour="bg-amber-600" />
        <StatCard label="No GPS" value={unenriched} colour="bg-rose-700" />
      </div>

      {/* Bank breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {byBank.map(b => (
          <div key={b.value} className="bg-white rounded-lg p-3 shadow-sm border border-slate-200 flex items-center gap-3">
            <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: b.colour }} />
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{b.label}</p>
              <p className="text-2xl font-bold text-slate-800">{b.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Province breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">By Province / Region</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {byProvince.map(row => (
            <button
              key={row.province}
              onClick={() => onProvinceClick(row.province)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
            >
              <span className="text-sm font-medium text-slate-700">{row.province}</span>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-500">{row.dealers} dealers</span>
                <span className="font-semibold text-slate-700">{row.auditors} auditors</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Auditor list */}
      {auditors.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Auditors</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {auditors.map(a => {
              const count = dealers.filter(d => assignments.get(d.id) === a.id).length
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: a.colour }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{a.name}</p>
                    <p className="text-xs text-slate-400">{a.primary_province}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-600">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className={`${colour} rounded-lg p-3 text-white shadow-sm`}>
      <p className="text-xs opacity-80 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-0.5">{value.toLocaleString()}</p>
    </div>
  )
}
