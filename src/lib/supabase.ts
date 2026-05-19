import { createClient } from '@supabase/supabase-js'
import type { Dealer, Auditor, Assignment } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Database {
  dealers: Dealer
  auditors: Auditor
  assignments: Assignment
}

// Dealers
export const fetchDealers = async (): Promise<Dealer[]> => {
  const PAGE = 1000
  const all: Dealer[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('dealers')
      .select('*')
      .order('name')
      .range(from, from + PAGE - 1)
    if (error) throw error
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

export const updateDealer = async (id: string, patch: Partial<Dealer>): Promise<void> => {
  const { error } = await supabase.from('dealers').update(patch).eq('id', id)
  if (error) throw error
}

// Auditors
export const fetchAuditors = async (): Promise<Auditor[]> => {
  const { data, error } = await supabase.from('auditors').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export const createAuditor = async (auditor: Omit<Auditor, 'id' | 'created_at'>): Promise<Auditor> => {
  const { data, error } = await supabase.from('auditors').insert(auditor).select().single()
  if (error) throw error
  return data
}

export const updateAuditor = async (id: string, patch: Partial<Auditor>): Promise<void> => {
  const { error } = await supabase.from('auditors').update(patch).eq('id', id)
  if (error) throw error
}

export const deleteAuditor = async (id: string): Promise<void> => {
  await supabase.from('assignments').delete().eq('auditor_id', id)
  const { error } = await supabase.from('auditors').delete().eq('id', id)
  if (error) throw error
}

// Assignments
export const fetchAssignments = async (): Promise<Assignment[]> => {
  const { data, error } = await supabase.from('assignments').select('*')
  if (error) throw error
  return data ?? []
}

export const assignDealer = async (dealerId: string, auditorId: string): Promise<void> => {
  const { error } = await supabase
    .from('assignments')
    .upsert({ dealer_id: dealerId, auditor_id: auditorId, assigned_at: new Date().toISOString() })
  if (error) throw error
}

export const unassignDealer = async (dealerId: string): Promise<void> => {
  const { error } = await supabase.from('assignments').delete().eq('dealer_id', dealerId)
  if (error) throw error
}

export const bulkAssignDealers = async (dealerIds: string[], auditorId: string): Promise<void> => {
  const rows = dealerIds.map(dealer_id => ({
    dealer_id,
    auditor_id: auditorId,
    assigned_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('assignments').upsert(rows)
  if (error) throw error
}

export const bulkDeleteDealers = async (dealerIds: string[]): Promise<void> => {
  await supabase.from('assignments').delete().in('dealer_id', dealerIds)
  const { error } = await supabase.from('dealers').delete().in('id', dealerIds)
  if (error) throw error
}
