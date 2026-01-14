export type Kind = 'incoming' | 'expense'

export interface Card {
  id: string
  user_id: string
  bank_name: string
  description?: string
  due_day: number
  color: string
  created_at: string
}

export interface RecurringTemplate {
  id: string
  user_id: string
  kind: Kind
  description: string
  default_amount: number
  day_of_month: number
  month_ref?: string
  is_active: boolean
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  kind: Kind
  month_ref: string // YYYY-MM
  description: string
  amount: number
  paid: boolean
  is_recurring: boolean
  template_id?: string | null
  card_id?: string | null
  installment_current?: number | null
  installment_total?: number | null
  created_at: string
}

export interface CardTransaction {
  id: string
  user_id: string
  card_id: string
  month_ref: string
  description: string
  amount: number
  installment_total?: number | null
  installment_current?: number | null
  plan_id?: string | null
  created_at: string
}

// Helper type for the unified list view
export interface DashboardItem {
  type: 'real' | 'expected'
  id: string // Transaction ID or Template ID
  kind: Kind
  description: string
  amount: number
  day?: number // For ordering: from template.day_of_month or created_at
  paid: boolean
  isRecurring: boolean
  originalTemplateId?: string // If expected, this is the template ID
  transactionId?: string // If real, the transaction ID
  installmentCurrent?: number
  installmentTotal?: number
}
