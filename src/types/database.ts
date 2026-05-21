export type ProjectStatus = 'estimating' | 'won' | 'in_progress' | 'completed' | 'lost'
export type LineItemCategory = 'material' | 'labor' | 'transport' | 'other'
export type RoundingMode = 'floor' | 'round' | 'ceil'

export interface Customer {
  id: string
  user_id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  postal_code: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  customer_id: string
  title: string
  property_address: string | null
  status: ProjectStatus
  estimated_at: string | null
  start_date: string | null
  end_date: string | null
  description: string | null
  tax_rate: number
  rounding_mode: RoundingMode
  default_labor_unit_price: number | null
  received_amount: number | null
  notes: string | null
  created_at: string
  updated_at: string
  customers?: Customer
}

export interface LineItem {
  id: string
  project_id: string
  user_id: string
  category: LineItemCategory
  sort_order: number
  name: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  actual_amount: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProjectWithCustomer extends Project {
  customers: Customer
}
