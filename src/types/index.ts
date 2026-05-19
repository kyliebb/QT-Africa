export type Bank = 'wesbank' | 'standardbank' | 'nedbank'

export type Province =
  | 'Western Cape'
  | 'Eastern Cape'
  | 'Northern Cape'
  | 'North West'
  | 'Gauteng'
  | 'Mpumalanga'
  | 'Limpopo'
  | 'Free State'
  | 'KwaZulu-Natal'
  | 'Namibia'
  | 'Botswana'
  | 'Lesotho'
  | 'Eswatini'
  | 'Unknown'

export interface Dealer {
  id: string
  name: string
  city: string
  province: Province
  country: string
  bank: Bank
  audit_frequency: number
  qty: number | null
  lat: number | null
  lng: number | null
  full_address: string | null
  google_maps_url: string | null
  place_id: string | null
  dealer_code: string | null
  enriched: boolean
  is_duplicate: boolean
  duplicate_tag: string | null
  places_status?: 'unverified' | 'verified' | 'flagged'
  created_at?: string
}

export interface Auditor {
  id: string
  name: string
  primary_province: Province
  colour: string
  created_at?: string
}

export interface Assignment {
  dealer_id: string
  auditor_id: string
  assigned_at?: string
}

export type DuplicateTag = 'garage' | 'separate entity' | 'fleet' | 'rental' | 'branch' | string

export interface FilterState {
  bank: Bank | 'all'
  province: Province | 'all'
  auditorId: string | 'all' | 'unassigned'
  frequency: number | 'all'
  search: string
  showDuplicates: boolean
  placesStatus: 'all' | 'verified' | 'unverified' | 'flagged'
}

export const PROVINCES: Province[] = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Free State',
  'Northern Cape',
  'Namibia',
  'Botswana',
  'Lesotho',
  'Eswatini',
  'Unknown',
]

export const BANKS: { value: Bank; label: string; colour: string }[] = [
  { value: 'wesbank', label: 'WesBank', colour: '#1d4ed8' },
  { value: 'standardbank', label: 'Standard Bank', colour: '#15803d' },
  { value: 'nedbank', label: 'Nedbank', colour: '#166534' },
]

export const AUDITOR_COLOURS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f59e0b', '#10b981', '#6366f1', '#d946ef', '#0ea5e9',
]

export const AUDIT_FREQUENCIES = [7, 14, 30, 60, 90, 120, 180]
