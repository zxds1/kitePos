import { z } from "zod"

const InventoryTypeSchema = z.enum([
  "discrete",
  "bulk_loose",
  "bulk_liquid",
  "multi_pack",
  "expiry_tracked",
])

const BatchSaleItem = z.object({
  client_transaction_id: z.string().min(1),
  order_id: z.string().optional(),
  variant_id: z.string().min(1),
  shop_id: z.string().min(1),
  inventory_type: InventoryTypeSchema,
  unit_sold: z.string().min(1),
  quantity_sold: z.number().int().positive().default(1),
  conversion_factor_snapshot: z.number().positive(),
  deduction_value: z.number().positive(),
  stock_before: z.number(),
  stock_after: z.number(),
  price_charged: z.number().min(0),
  payment_method: z.enum(["cash", "mpesa", "card", "other"]).optional().default("cash"),
  mpesa_receipt_number: z.string().min(1).optional(),
  mpesa_customer_phone: z.string().min(1).optional(),
  amount_paid: z.number().min(0).optional(),
  timestamp: z.coerce.date(),
})

export const AdminBatchSalesRequest = z.object({
  shop_id: z.string().min(1),
  sales: z.array(BatchSaleItem).min(1).max(100),
  sync_metadata: z
    .object({
      device_id_hash: z.string().min(1),
      app_version: z.string().min(1),
      sync_started_at: z.coerce.date(),
      sync_completed_at: z.coerce.date().optional(),
    })
    .optional(),
})

export type BatchSaleConflict = {
  type: string
  client_stock_before: number
  server_stock_before: number
  difference: number
  message: string
}

export type BatchSaleResult = {
  client_transaction_id: string
  status: "success" | "success_with_conflict" | "skipped_duplicate" | "error"
  snapshot_id?: string
  conflict?: BatchSaleConflict
  error?: string
  retry_after_seconds?: number | null
  is_retryable?: boolean
}

export type BatchSalesResponse = {
  shop_id: string
  processed: number
  results: BatchSaleResult[]
  payment_summary?: {
    cash_count: number
    mpesa_count: number
    mpesa_total: number
  }
}
