import { useState } from 'react'
import { MapPin, ExternalLink, LocateFixed, Pencil, Check, X, CheckCircle, HelpCircle, AlertTriangle } from 'lucide-react'
import type { Dealer, Auditor, Province } from '../types'
import { BANKS, PROVINCES } from '../types'

interface Props {
  dealer: Dealer
  auditors: Auditor[]
  assignments: Map<string, string>
  onPatchDealer: (id: string, patch: Partial<Dealer>) => void
  onEditLocation: () => void
}

export default function MapDealerPanel({ dealer: d, auditors, assignments, onPatchDealer, onEditLocation }: Props) {
  const [editingCityProvince, setEditingCityProvince] = useState(false)
  const [editCity, setEditCity] = useState(d.city)
  const [editProvince, setEditProvince] = useState<Province>(d.province)

  const bank = BANKS.find(b => b.value === d.bank)
  const auditorId = assignments.get(d.id)
  const auditor = auditors.find(a => a.id === auditorId)

  const placesStatus = d.places_status ?? 'unverified'
  const VerifyIcon = placesStatus === 'verified' ? CheckCircle : placesStatus === 'flagged' ? AlertTriangle : HelpCircle
  const verifyClass = placesStatus === 'verified' ? 'text-emerald-500' : placesStatus === 'flagged' ? 'text-amber-500' : 'text-slate-300'
  const verifyLabel = placesStatus === 'verified' ? 'Verified via Google Places' : placesStatus === 'flagged' ? 'Flagged – needs attention' : 'Not yet verified'

  const startEdit = () => {
    setEditCity(d.city)
    setEditProvince(d.province)
    setEditingCityProvince(true)
  }

  const cancelEdit = () => {
    setEditingCityProvince(false)
  }

  const saveEdit = () => {
    onPatchDealer(d.id, {
      city: editCity.trim() || d.city,
      province: editProvince,
    })
    setEditingCityProvince(false)
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
      {/* Header: name + GPS edit button */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-slate-800 text-sm truncate">{d.name}</p>
            <span title={verifyLabel} className="shrink-0">
              <VerifyIcon size={13} className={verifyClass} />
            </span>
          </div>
          {d.dealer_code && (
            <p className="font-mono text-xs text-slate-400">{d.dealer_code}</p>
          )}
        </div>
        <button
          onClick={onEditLocation}
          className="shrink-0 p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
          title="Edit GPS location / Google Maps URL"
        >
          <LocateFixed size={14} />
        </button>
      </div>

      {/* City / Province — inline editable */}
      <div className="text-xs text-slate-600 space-y-1">
        {editingCityProvince ? (
          <div className="space-y-2 bg-slate-50 rounded-lg p-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-0.5">City</label>
              <input
                type="text"
                value={editCity}
                onChange={e => setEditCity(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-0.5">Province</label>
              <select
                value={editProvince}
                onChange={e => setEditProvince(e.target.value as Province)}
                className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={saveEdit}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Check size={11} /> Save
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 text-xs px-2.5 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-100"
              >
                <X size={11} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group">
            <MapPin size={11} className="text-slate-400 shrink-0" />
            <span>{d.city}, {d.province}</span>
            <button
              onClick={startEdit}
              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-500 transition-all ml-auto"
              title="Edit city / province"
            >
              <Pencil size={10} />
            </button>
          </div>
        )}
        {d.full_address && (
          <p className="text-slate-400 pl-4 leading-tight">{d.full_address}</p>
        )}
      </div>

      {/* Bank + frequency */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: bank?.colour ?? '#94a3b8' }}
        >
          {bank?.label ?? d.bank}
        </span>
        <span className="text-xs text-slate-500">{d.audit_frequency}d frequency</span>
      </div>

      {/* Auditor */}
      {auditor && (
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: auditor.colour }} />
          <span className="text-slate-600">{auditor.name}</span>
        </div>
      )}

      {/* Coordinates */}
      {d.lat && d.lng && (
        <p className="text-xs font-mono text-slate-400">{d.lat.toFixed(5)}, {d.lng.toFixed(5)}</p>
      )}

      {/* Maps link */}
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
}
