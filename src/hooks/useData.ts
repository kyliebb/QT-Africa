import { useState, useEffect, useCallback } from 'react'
import type { Dealer, Auditor } from '../types'
import {
  fetchDealers, fetchAuditors, fetchAssignments,
  createAuditor, updateAuditor, deleteAuditor,
  assignDealer, unassignDealer, bulkAssignDealers,
  updateDealer,
} from '../lib/supabase'

export function useData() {
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [auditors, setAuditors] = useState<Auditor[]>([])
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [d, a, asgn] = await Promise.all([fetchDealers(), fetchAuditors(), fetchAssignments()])
      setDealers(d)
      setAuditors(a)
      setAssignments(new Map(asgn.map(a => [a.dealer_id, a.auditor_id])))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const addAuditor = async (auditor: Omit<Auditor, 'id' | 'created_at'>) => {
    const created = await createAuditor(auditor)
    setAuditors(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const editAuditor = async (id: string, patch: Partial<Auditor>) => {
    await updateAuditor(id, patch)
    setAuditors(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  const removeAuditor = async (id: string) => {
    await deleteAuditor(id)
    setAuditors(prev => prev.filter(a => a.id !== id))
    setAssignments(prev => {
      const next = new Map(prev)
      for (const [k, v] of next) { if (v === id) next.delete(k) }
      return next
    })
  }

  const assign = async (dealerId: string, auditorId: string | null) => {
    if (auditorId === null) {
      await unassignDealer(dealerId)
      setAssignments(prev => { const n = new Map(prev); n.delete(dealerId); return n })
    } else {
      await assignDealer(dealerId, auditorId)
      setAssignments(prev => new Map(prev).set(dealerId, auditorId))
    }
  }

  const bulkAssign = async (dealerIds: string[], auditorId: string) => {
    await bulkAssignDealers(dealerIds, auditorId)
    setAssignments(prev => {
      const n = new Map(prev)
      dealerIds.forEach(id => n.set(id, auditorId))
      return n
    })
  }

  const patchDealer = async (id: string, patch: Partial<Dealer>) => {
    await updateDealer(id, patch)
    setDealers(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))
  }

  return {
    dealers, auditors, assignments,
    loading, error,
    addAuditor, editAuditor, removeAuditor,
    assign, bulkAssign, patchDealer,
    reload: load,
  }
}
