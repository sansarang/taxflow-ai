export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ─── Table Row / Insert / Update helpers ─────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      users_profile: {
        Row: {
          id: string
          email: string
          full_name: string | null
          business_name: string | null
          business_number: string | null
          business_type: string
          business_type_code: string | null
          is_simplified_tax: boolean
          annual_revenue_tier: string
          plan: 'free' | 'pro' | 'business'
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          monthly_classify_count: number
          monthly_classify_reset_at: string
          onboarding_completed: boolean
          referral_code: string | null
          referred_by: string | null
          free_months_remaining: number
          kakao_token: string | null
          notification_email: boolean
          notification_kakao: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          business_name?: string | null
          business_number?: string | null
          business_type?: string
          business_type_code?: string | null
          is_simplified_tax?: boolean
          annual_revenue_tier?: string
          plan?: 'free' | 'pro' | 'business'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          monthly_classify_count?: number
          monthly_classify_reset_at?: string
          onboarding_completed?: boolean
          referral_code?: string | null
          referred_by?: string | null
          free_months_remaining?: number
          kakao_token?: string | null
          notification_email?: boolean
          notification_kakao?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['users_profile']['Insert']>
      }

      csv_batches: {
        Row: {
          id: string
          user_id: string
          filename: string
          bank_name: string
          storage_path: string | null
          total_rows: number
          processed_rows: number
          status: 'pending' | 'processing' | 'done' | 'error'
          period_start: string | null
          period_end: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          bank_name: string
          storage_path?: string | null
          total_rows?: number
          processed_rows?: number
          status?: 'pending' | 'processing' | 'done' | 'error'
          period_start?: string | null
          period_end?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['csv_batches']['Insert']>
      }

      transactions: {
        Row: {
          id: string
          user_id: string
          batch_id: string | null
          tx_hash: string
          transaction_date: string
          description: string
          amount: number
          bank_name: string | null
          account_last4: string | null
          tax_category: string | null
          category_label: string | null
          vat_deductible: boolean | null
          expense_type: string | null
          confidence: number | null
          ai_reason: string | null
          risk_flag: string[] | null
          receipt_required: boolean
          manually_reviewed: boolean
          user_category: string | null
          user_note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          batch_id?: string | null
          tx_hash: string
          transaction_date: string
          description: string
          amount: number
          bank_name?: string | null
          account_last4?: string | null
          tax_category?: string | null
          category_label?: string | null
          vat_deductible?: boolean | null
          expense_type?: string | null
          confidence?: number | null
          ai_reason?: string | null
          risk_flag?: string[] | null
          receipt_required?: boolean
          manually_reviewed?: boolean
          user_category?: string | null
          user_note?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>
      }

      tax_reports: {
        Row: {
          id: string
          user_id: string
          report_type: 'vat_q1' | 'vat_q2' | 'vat_q3' | 'vat_q4' | 'income_tax' | 'monthly'
          period_year: number
          period_quarter: number | null
          total_income: number
          total_expense: number
          vat_payable: number
          estimated_tax: number
          risk_score: number
          deductions: Json
          optimization_tips: Json
          file_url: string | null
          disclaimer_shown: boolean
          generated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          report_type: 'vat_q1' | 'vat_q2' | 'vat_q3' | 'vat_q4' | 'income_tax' | 'monthly'
          period_year: number
          period_quarter?: number | null
          total_income?: number
          total_expense?: number
          vat_payable?: number
          estimated_tax?: number
          risk_score?: number
          deductions?: Json
          optimization_tips?: Json
          file_url?: string | null
          disclaimer_shown?: boolean
          generated_at?: string
        }
        Update: Partial<Database['public']['Tables']['tax_reports']['Insert']>
      }

      optimization_alerts: {
        Row: {
          id: string
          user_id: string
          alert_type: 'receipt_missing' | 'deduction_found' | 'tax_deadline' | 'law_change' | 'saving_opportunity'
          title: string
          body: string
          amount_impact: number | null
          is_read: boolean
          is_pushed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          alert_type: 'receipt_missing' | 'deduction_found' | 'tax_deadline' | 'law_change' | 'saving_opportunity'
          title: string
          body: string
          amount_impact?: number | null
          is_read?: boolean
          is_pushed?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['optimization_alerts']['Insert']>
      }

      tax_law_table: {
        Row: {
          id: number
          category: string
          key: string
          value: Json
          description: string | null
          effective_year: number
          updated_at: string
        }
        Insert: {
          id?: number
          category: string
          key: string
          value: Json
          description?: string | null
          effective_year?: number
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['tax_law_table']['Insert']>
      }
    }

    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ─── Convenience aliases ──────────────────────────────────────────────────────

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// ─── Domain-level aliases ─────────────────────────────────────────────────────

export type UserProfile        = Tables<'users_profile'>
export type CsvBatch           = Tables<'csv_batches'>
export type DbTransaction      = Tables<'transactions'>
export type TaxReport          = Tables<'tax_reports'>
export type OptimizationAlert  = Tables<'optimization_alerts'>
export type TaxLawEntry        = Tables<'tax_law_table'>

export type UserPlan           = UserProfile['plan']
export type BatchStatus        = CsvBatch['status']
export type ReportType         = TaxReport['report_type']
export type AlertType          = OptimizationAlert['alert_type']

// ─── Tax law typed value payloads ─────────────────────────────────────────────

export interface TaxBracket {
  min: number
  max: number | null
  rate: number
  deduction: number
}

export interface VatRate {
  rate: number
}

export interface DeductionLimit {
  annual_limit?: number
  per_receipt_limit?: number
  business_use_ratio?: number
  max_deduction?: number
  income_threshold?: number
}

export interface CreatorDeductionCategory {
  items: string[]
  note: string
}
