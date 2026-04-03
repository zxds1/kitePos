import { z } from "zod"

export const ReturnReasonCategorySchema = z.enum([
  "defective",
  "expired",
  "wrong_item",
  "damaged",
  "overstock",
  "customer_change",
  "other",
])

export const ReturnItemConditionSchema = z.enum([
  "new",
  "opened",
  "used",
  "damaged",
  "expired",
])

export const ReturnMethodSchema = z.enum(["pickup", "drop_off", "delivery"])

export const RefundMethodSchema = z.enum([
  "mpesa",
  "cash",
  "store_credit",
  "bank_transfer",
  "original_payment",
])

export const ReturnItemSchema = z.object({
  variant_id: z.string().min(1),
  product_name: z.string().min(1),
  quantity: z.coerce.number().positive(),
  reason: z.string().min(1),
  reason_category: ReturnReasonCategorySchema,
  condition: ReturnItemConditionSchema,
  photo_urls: z.array(z.string()).optional().default([]),
  batch_number: z.string().optional().nullable(),
  unit_price: z.coerce.number().min(0).optional().nullable(),
  refund_amount: z.coerce.number().min(0).optional().nullable(),
})
