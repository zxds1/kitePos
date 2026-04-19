import { z } from "zod"

export const AdminCreateSaleSnapshot = z.object({
  order_id: z.string().min(1),
  line_item_id: z.string().min(1),
  shop_id: z.string().min(1),
  variant_id: z.string().min(1),
  inventory_type: z.string().min(1),
  unit_sold: z.string().min(1),
  conversion_factor_snapshot: z.number(),
  deduction_value: z.number(),
  stock_before: z.number(),
  stock_after: z.number(),
  price_charged: z.number().optional(),
  payment_method: z.enum(["cash", "mpesa", "card", "other"]).optional(),
  mpesa_receipt_number: z.string().optional(),
  mpesa_customer_phone: z.string().optional(),
  amount_paid: z.number().optional(),
  extraction_source: z.string().optional(),
  source_image_url: z.string().optional(),
  source_file_name: z.string().optional(),
  extraction_confidence: z.number().min(0).max(1).optional(),
  extraction_raw: z.string().optional(),
  extraction_timestamp: z.coerce.date().optional(),
  timestamp: z.coerce.date(),
})

export const AdminListSaleSnapshots = z.object({
  shop_id: z.string().optional(),
  variant_id: z.string().optional(),
  order_id: z.string().optional(),
  line_item_id: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
})
