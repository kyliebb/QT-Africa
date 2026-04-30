import { useState } from 'react'
import { MapPin, ExternalLink, AlertTriangle, Tag, ChevronUp, ChevronDown, Pencil } from 'lucide-react'
import type { Dealer, Auditor } from '../types'
import { BANKS } from '../types'
import LocationEditModal from './LocationEditModal'

interface Props {
  dealers: Dealer[]
  auditors: Auditor[]
  assignments: Map<string, string>
  onAssign: (dealerId: string, auditorId: string | null) => void
  onPatchDealer: (id: string, patch: Partial<Dealer>) => void
  onSelectDealer: (dealer: Dealer) => void
}

type SortKey = 'name' | 'city' | 'province' | 'bank' | 'audit_frequency'

const DUPLICATE_TAGS = ['garage', 'separate entity', 'fleet', 'rental', 'branch']

export default function DealerList({ dealers, auditors, assignments, onAssign, onPatchDealer, onSelectDealer }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [editingLocation, setEditingLocation] = useState<Dealer | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const sorted = [...dealers].sort((a, b) => {
    const va = String(a[sortKey] ?? '')
    const vb = String(b[sortKey] ?? '')
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(dealers.length / PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(0)
  }

  const bankFor = (bank: string) => BANKS.find(b => b.value === bank)

  return (
    <>
    {editingLocation && (
      <LocationEditModal
        dealer={editingLocation}
        onSave={patch => onPatchDealer(editingLocation.id, patch)}
        onClose={() => setEditingLocation(null)}
      />
    )}
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">Code</th>
              <Th label="Dealer" sortKey="name" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <Th label="City" sortKey="city" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <Th label="Province" sortKey="province" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <Th label="Bank" sortKey="bank" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <Th label="Freq" sortKey="audit_frequency" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Auditor</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Flags</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map(dealer => {
              const bank = bankFor(dealer.bank)
              const auditorId = assignments.get(dealer.id) ?? null
              const auditor = auditors.find(a => a.id === auditorId)

              return (
                <tr key={dealer.id} className="hover:bg-slate-50 transition-colors">
                  {/* Code */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-mono text-xs text-slate-400">{dealer.dealer_code ?? '—'}</span>
                  </td>

                  {/* Name */}
                  <td className="px-3 py-2 max-w-48">
                    <div className="flex items-center gap-1.5">
                      {!dealer.enriched && (
                        <span title="No GPS data"><AlertTriangle size={12} className="text-amber-500 flex-shrink-0" /></span>
                      )}
                      <span className="font-medium text-slate-800 truncate">{dealer.name}</span>
                    </div>
                  </td>

                  {/* City */}
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{dealer.city}</td>

                  {/* Province */}
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{dealer.province}</td>

                  {/* Bank */}
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: bank?.colour ?? '#94a3b8' }}
                    >
                      {bank?.label ?? dealer.bank}
                    </span>
                  </td>

                  {/* Frequency */}
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{dealer.audit_frequency}d</td>

                  {/* Auditor assignment */}
                  <td className="px-3 py-2">
                    <select
                      value={auditorId ?? ''}
                      onChange={e => onAssign(dealer.id, e.target.value || null)}
                      className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      style={auditor ? { borderColor: auditor.colour, color: auditor.colour } : {}}
                    >
                      <option value="">— unassigned —</option>
                      {auditors.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Flags */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Duplicate flag */}
                      <button
                        onClick={() => onPatchDealer(dealer.id, { is_duplicate: !dealer.is_duplicate })}
                        className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                          dealer.is_duplicate
                            ? 'bg-orange-100 border-orange-300 text-orange-700'
                            : 'border-slate-200 text-slate-400 hover:border-orange-300 hover:text-orange-500'
                        }`}
                        title="Toggle duplicate flag"
                      >
                        DUP
                      </button>

                      {/* Tag */}
                      {dealer.is_duplicate && (
                        editingTag === dealer.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              list="dup-tags"
                              value={tagInput}
                              onChange={e => setTagInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  onPatchDealer(dealer.id, { duplicate_tag: tagInput || null })
                                  setEditingTag(null)
                                }
                                if (e.key === 'Escape') setEditingTag(null)
                              }}
                              className="text-xs border border-slate-300 rounded px-1.5 py-0.5 w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="tag…"
                            />
                            <datalist id="dup-tags">
                              {DUPLICATE_TAGS.map(t => <option key={t} value={t} />)}
                            </datalist>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingTag(dealer.id); setTagInput(dealer.duplicate_tag ?? '') }}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                          >
                            <Tag size={10} />
                            {dealer.duplicate_tag ?? 'add tag'}
                          </button>
                        )
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {dealer.lat && dealer.lng && (
                        <button
                          onClick={() => onSelectDealer(dealer)}
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Show on map"
                        >
                          <MapPin size={14} />
                        </button>
                      )}
                      {dealer.google_maps_url && (
                        <a
                          href={dealer.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Open in Google Maps"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => setEditingLocation(dealer)}
                        className="p-1 text-slate-400 hover:text-amber-600 transition-colors"
                        title="Edit location"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-slate-50">
          <span className="text-xs text-slate-500">
            Page {page + 1} of {totalPages} ({dealers.length.toLocaleString()} total)
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-100"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-100"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function Th({ label, sortKey, current, dir, onSort }: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  const active = sortKey === current
  return (
    <th
      className="px-3 py-2 text-left font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap hover:text-slate-800"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
      </div>
    </th>
  )
}
