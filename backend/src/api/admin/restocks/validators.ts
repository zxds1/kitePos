import { z } from "zod"

export const AdminCreateRestock = z.object({
  shop_id: z.string().min(1),
  variant_id: z.string().min(1),
  quantity_received: z.number(),
  purchase_unit_qty: z.number(),
  cost_per_unit: z.number(),
  total_cost: z.number(),
  source: z.enum(["manual", "barcode_scan", "receipt_scan"]),
  receipt_image_url: z.string().url().nullable().optional(),
  receipt_raw_text: z.string().nullable().optional(),
  supplier_name: z.string().nullable().optional(),
  conversion_snapshot: z.record(z.string(), z.unknown()),
  timestamp: z.coerce.date(),
})

export const AdminListRestocks = z.object({
  shop_id: z.string().optional(),
  variant_id: z.string().optional(),
  source: z.enum(["manual", "barcode_scan", "receipt_scan"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
})
