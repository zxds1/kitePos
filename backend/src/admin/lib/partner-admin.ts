export type AdminPartnerRecord = {
  id: string
  name: string
  contact_email: string
  billing_tier: string
  permissions: {
    regions?: string[]
    data_types?: string[]
  }
  rate_limit: number
  quota_monthly: number
  quota_used: number
  quota_remaining: number
  is_active: boolean
  is_verified: boolean
  last_accessed_at?: string | null
  api_key_last4?: string | null
}

export type ExportLogRecord = {
  id: string
  partner_id: string
  data_type: string
  result_row_count: number
  requested_at: string
  status: string
  format: string
  consent_verified: boolean
  aggregation_threshold_met: boolean
}
