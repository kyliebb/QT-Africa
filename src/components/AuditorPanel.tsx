import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import type { Auditor } from '../types'
import { PROVINCES, AUDITOR_COLOURS } from '../types'

interface Props {
  auditors: Auditor[]
  onAdd: (a: Omit<Auditor, 'id' | 'created_at'>) => Promise<void>
  onEdit: (id: string, patch: Partial<Auditor>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  dealerCountFor: (auditorId: string) => number
}

const BLANK = { name: '', primary_province: 'Gauteng' as Auditor['primary_province'], colour: AUDITOR_COLOURS[0] }

export default function AuditorPanel({ auditors, onAdd, onEdit, onDelete, dealerCountFor }: Props) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)

  const nextColour = AUDITOR_COLOURS[auditors.length % AUDITOR_COLOURS.length]

  const handleAdd = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await onAdd(form)
    setSaving(false)
    setAdding(false)
    setForm({ ...BLANK, colour: AUDITOR_COLOURS[(auditors.length + 1) % AUDITOR_COLOURS.length] })
  }

  const startEdit = (a: Auditor) => {
    setEditingId(a.id)
    setEditForm({ name: a.name, primary_province: a.primary_province, colour: a.colour })
  }

  const handleEdit = async () => {
    if (!editingId || !editForm.name.trim()) return
    setSaving(true)
    await onEdit(editingId, editForm)
    setSaving(false)
    setEditingId(null)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Auditors</h3>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setForm({ ...BLANK, colour: nextColour }) }}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <Plus size={12} /> Add auditor
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {/* Add form */}
        {adding && (
          <AuditorForm
            form={form}
            onChange={setForm}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
            saving={saving}
          />
        )}

        {auditors.length === 0 && !adding && (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">No auditors yet. Add one to start assigning dealers.</p>
        )}

        {auditors.map(a => (
          <div key={a.id}>
            {editingId === a.id ? (
              <AuditorForm
                form={editForm}
                onChange={setEditForm}
                onSave={handleEdit}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: a.colour }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{a.name}</p>
                  <p className="text-xs text-slate-400">{a.primary_province} · {dealerCountFor(a.id)} dealers</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(a)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete ${a.name}? Assignments will be removed.`)) onDelete(a.id) }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AuditorForm({ form, onChange, onSave, onCancel, saving }: {
  form: typeof BLANK
  onChange: (f: typeof BLANK) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  return (
    <div className="px-4 py-3 bg-blue-50 space-y-2">
      <input
        autoFocus
        type="text"
        placeholder="Auditor name e.g. Auditor 1 – Western Cape"
        value={form.name}
        onChange={e => onChange({ ...form, name: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
        className="w-full text-sm border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2">
        <select
          value={form.primary_province}
          onChange={e => onChange({ ...form, primary_province: e.target.value as Auditor['primary_province'] })}
          className="flex-1 text-sm border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {/* Colour picker */}
        <div className="flex gap-1 flex-wrap">
          {AUDITOR_COLOURS.slice(0, 8).map(c => (
            <button
              key={c}
              onClick={() => onChange({ ...form, colour: c })}
              className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: form.colour === c ? '#1e293b' : 'transparent',
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600">
          <X size={12} /> Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Check size={12} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
