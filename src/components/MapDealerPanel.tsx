import { MapPin, ExternalLink, Pencil, CheckCircle, HelpCircle, AlertTriangle } from 'lucide-react'
import type { Dealer, Auditor } from '../types'
import { BANKS } from '../types'

interface Props {
  dealer: Dealer
  auditors: Auditor[]
  assignments: Map<string, string>
  onEditLocation: () => void
}

export default function MapDealerPanel({ dealer: d, auditors, assignments, onEditLocation }: Props) {
  const bank = BANKS.find(b => b.value === d.bank)
  const auditorId = assignments.get(d.id)
  const auditor = auditors.find(a => a.id === auditorId)

  const placesStatus = d.places_status ?? 'unverified'
  const VerifyIcon = placesStatus === 'verified' ? CheckCircle : placesStatus === 'flagged' ? AlertTriangle : HelpCircle
  const verifyClass = placesStatus === 'verified' ? 'text-emerald-500' : placesStatus === 'flagged' ? 'text-amber-500' : 'text-slate-300'
  const verifyLabel = placesStatus === 'verified' ? 'Verified via Google Places' : placesStatus === 'flagged' ? 'Flagged – needs attention' : 'Not yet verified'

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-slate-800 text-sm truncate">{d.name}</p>
            <span title={verifyLabel} className="shrink-0 cursor-default">
              <VerifyIcon size={13} className={verifyClass} />
            </span>
          </div>
          {d.dealer_code && (
            <p className="font-mono text-xs text-slate-400">{d.dealer_code}</p>
          )}
        </div>
      </div>

      {/* City / Province — click pencil to edit */}
      <div className="text-xs text-slate-600 space-y-1">
        <div className="flex items-center gap-1.5">
          <MapPin size={11} className="text-slate-400 shrink-0" />
          <span className="font-medium">{d.city}</span>
          <span className="text-slate-400">·</span>
          <span>{d.province}</span>
          <button
            onClick={onEditLocation}
            className="ml-auto shrink-0 p-0.5 rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
            title="Edit city, province, GPS &amp; more"
          >
            <Pencil size={11} />
          </button>
        </div>
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
