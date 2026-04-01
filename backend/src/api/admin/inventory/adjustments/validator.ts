import { z } from "zod"

export const AdminCreateAdjustment = z.object({
  shop_id: z.string().min(1),
  variant_id: z.string().min(1),
  adjustment_type: z.enum([
    "correction",
    "wastage",
    "theft",
    "expiry",
    "other",
  ]),
  quantity_change: z.number(),
  reason: z.string().min(1),
  reference: z.string().optional(),
  before_stock: z.number(),
  after_stock: z.number(),
  evidence_url: z.string().url().optional(),
})

export const AdminGetAdjustmentsParams = z.object({
  shop_id: z.string().optional(),
  variant_id: z.string().optional(),
  adjustment_type: z
    .enum(["correction", "wastage", "theft", "expiry", "other"])
    .optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})
