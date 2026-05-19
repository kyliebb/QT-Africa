import { useState, useEffect } from 'react'
import {
  MapPin, ExternalLink, AlertTriangle, Tag, ChevronUp, ChevronDown,
  Pencil, X, Check, LocateFixed, CheckCircle, HelpCircle, Trash2,
} from 'lucide-react'
import type { Dealer, Auditor } from '../types'
import { BANKS, AUDIT_FREQUENCIES } from '../types'
import LocationEditModal from './LocationEditModal'

interface Props {
  dealers: Dealer[]
  auditors: Auditor[]
  assignments: Map<string, string>
  onAssign: (dealerId: string, auditorId: string | null) => void
  onBulkAssign: (dealerIds: string[], auditorId: string) => Promise<void>
  onBulkDelete: (dealerIds: string[]) => Promise<void>
  onPatchDealer: (id: string, patch: Partial<Dealer>) => void
  onSelectDealer: (dealer: Dealer) => void
}

type SortKey = 'name' | 'city' | 'province' | 'bank' | 'audit_frequency'

const DUPLICATE_TAGS = ['garage', 'separate entity', 'fleet', 'rental', 'branch']

// ─── Details edit modal ──────────────────────────────────────────────────────

interface EditDetails {
  name: string
  city: string
  dealer_code: string
  audit_frequency: number
}

function DealerDetailsModal({
  dealer,
  onSave,
  onClose,
}: {
  dealer: Dealer
  onSave: (patch: Partial<Dealer>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<EditDetails>({
    name: dealer.name,
    city: dealer.city,
    dealer_code: dealer.dealer_code ?? '',
    audit_frequency: dealer.audit_frequency,
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      name: form.name.trim() || dealer.name,
      city: form.city.trim() || dealer.city,
      dealer_code: form.dealer_code.trim() || null,
      audit_frequency: form.audit_frequency,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Edit dealer details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <Field label="Dealer name">
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
          <Field label="City">
            <input
              type="text"
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
          <Field label="Dealer code">
            <input
              type="text"
              value={form.dealer_code}
              onChange={e => setForm(f => ({ ...f, dealer_code: e.target.value }))}
              placeholder="e.g. WB-00042"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </Field>
          <Field label="Audit frequency">
            <select
              value={form.audit_frequency}
              onChange={e => setForm(f => ({ ...f, audit_frequency: Number(e.target.value) }))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {AUDIT_FREQUENCIES.map(f => (
                <option key={f} value={f}>
                  Every {f} days
                  {f === 7 ? ' (weekly)' : f === 14 ? ' (fortnightly)' : f === 30 ? ' (monthly)' :
                    f === 60 ? ' (bi-monthly)' : f === 90 ? ' (quarterly)' :
                    f === 120 ? ' (4-monthly)' : f === 180 ? ' (semi-annual)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Changing frequency will immediately update the auditor's workload calculation.
            </p>
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <X size={14} /> Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            <Check size={14} /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

// ─── Styled tooltip wrapper ───────────────────────────────────────────────────

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150">
        <div className="bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
          {label}
        </div>
        <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
      </div>
    </div>
  )
}

// ─── DealerList ───────────────────────────────────────────────────────────────

export default function DealerList({
  dealers, auditors, assignments, onAssign, onBulkAssign, onBulkDelete, onPatchDealer, onSelectDealer,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [editingLocation, setEditingLocation] = useState<Dealer | null>(null)
  const [editingDetails, setEditingDetails] = useState<Dealer | null>(null)
  const [page, setPage] = useState(0)

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAuditorId, setBulkAuditorId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)

  const PAGE_SIZE = 50

  // Clear selection when dealer list changes (filter/delete)
  useEffect(() => {
    setSelectedIds(new Set())
    setConfirmDelete(false)
  }, [dealers])

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

  // Select-all for current page
  const allPageSelected = paginated.length > 0 && paginated.every(d => selectedIds.has(d.id))
  const somePageSelected = paginated.some(d => selectedIds.has(d.id))

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allPageSelected) {
        paginated.forEach(d => next.delete(d.id))
      } else {
        paginated.forEach(d => next.add(d.id))
      }
      return next
    })
  }

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleBulkAssign = async () => {
    if (!bulkAuditorId || selectedIds.size === 0) return
    setBulkLoading(true)
    await onBulkAssign([...selectedIds], bulkAuditorId)
    setBulkLoading(false)
    setBulkAuditorId('')
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    await onBulkDelete([...selectedIds])
    setBulkLoading(false)
    setConfirmDelete(false)
  }

  return (
    <>
      {editingLocation && (
        <LocationEditModal
          dealer={editingLocation}
          onSave={patch => onPatchDealer(editingLocation.id, patch)}
          onClose={() => setEditingLocation(null)}
        />
      )}
      {editingDetails && (
        <DealerDetailsModal
          dealer={editingDetails}
          onSave={patch => onPatchDealer(editingDetails.id, patch)}
          onClose={() => setEditingDetails(null)}
        />
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-3 flex-wrap mb-2">
          <span className="text-sm font-semibold text-blue-800">
            {selectedIds.size} dealer{selectedIds.size !== 1 ? 's' : ''} selected
          </span>

          {/* Assign auditor */}
          <div className="flex items-center gap-1.5">
            <select
              value={bulkAuditorId}
              onChange={e => setBulkAuditorId(e.target.value)}
              className="text-xs border border-blue-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Assign auditor…</option>
              {auditors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkAuditorId || bulkLoading}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap"
            >
              {bulkLoading ? 'Working…' : 'Assign'}
            </button>
          </div>

          <div className="h-4 w-px bg-blue-200" />

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-rose-700">Delete {selectedIds.size} dealers?</span>
              <button
                onClick={handleBulkDelete}
                disabled={bulkLoading}
                className="text-xs px-3 py-1.5 bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-40"
              >
                {bulkLoading ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-2.5 py-1.5 border border-rose-200 rounded text-rose-600 hover:bg-rose-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 border border-rose-200 text-rose-600 rounded hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={12} /> Delete selected
            </button>
          )}

          <button
            onClick={() => { setSelectedIds(new Set()); setConfirmDelete(false) }}
            className="ml-auto text-xs text-blue-500 hover:text-blue-700"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {/* Select-all checkbox */}
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={el => { if (el) el.indeterminate = !allPageSelected && somePageSelected }}
                    onChange={toggleSelectAll}
                    className="rounded accent-blue-600 cursor-pointer"
                    title="Select all on this page"
                  />
                </th>
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
                const isSelected = selectedIds.has(dealer.id)

                const placesStatus = dealer.places_status ?? 'unverified'
                const VerifyIcon = placesStatus === 'verified' ? CheckCircle : placesStatus === 'flagged' ? AlertTriangle : HelpCircle
                const verifyClass = placesStatus === 'verified' ? 'text-emerald-500' : placesStatus === 'flagged' ? 'text-amber-500' : 'text-slate-300'
                const verifyTitle = placesStatus === 'verified' ? 'Verified via Google Places' : placesStatus === 'flagged' ? 'Flagged – needs attention' : 'Not yet verified'

                return (
                  <tr
                    key={dealer.id}
                    className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/60' : ''}`}
                  >
                    {/* Row checkbox */}
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(dealer.id)}
                        className="rounded accent-blue-600 cursor-pointer"
                      />
                    </td>

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

                    {/* Frequency — inline dropdown */}
                    <td className="px-3 py-2">
                      <select
                        value={dealer.audit_frequency}
                        onChange={e => onPatchDealer(dealer.id, { audit_frequency: Number(e.target.value) })}
                        className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                        title="Change audit frequency"
                      >
                        {AUDIT_FREQUENCIES.map(f => (
                          <option key={f} value={f}>{f}d</option>
                        ))}
                      </select>
                    </td>

                    {/* Auditor */}
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
                        {/* Verification status icon */}
                        <Tip label={verifyTitle}>
                          <span className="cursor-default flex items-center">
                            <VerifyIcon size={13} className={verifyClass} />
                          </span>
                        </Tip>

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
                      <div className="flex items-center gap-0.5">
                        {dealer.lat && dealer.lng && (
                          <Tip label="Show on map">
                            <button
                              onClick={() => onSelectDealer(dealer)}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              <MapPin size={14} />
                            </button>
                          </Tip>
                        )}
                        {dealer.google_maps_url && (
                          <Tip label="Open in Google Maps">
                            <a
                              href={dealer.google_maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors block"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </Tip>
                        )}
                        <Tip label="Edit GPS location / Maps URL">
                          <button
                            onClick={() => setEditingLocation(dealer)}
                            className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                          >
                            <LocateFixed size={14} />
                          </button>
                        </Tip>
                        <Tip label="Edit name / city / code / frequency">
                          <button
                            onClick={() => setEditingDetails(dealer)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        </Tip>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

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
  label: string; sortKey: SortKey; current: SortKey; dir: 'asc' | 'desc'; onSort: (k: SortKey) => void
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
