import { z } from "zod"

export const AdminValidateSaleRequest = z.object({
  shop_id: z.string().min(1),
  location_id: z.string().optional(),
  variant_id: z.string().min(1),
  unit_sold: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  local_stock: z.number().optional(),
})
