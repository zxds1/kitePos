import { z } from "zod"

export const AdminGetSyncLogParams = z.object({
  shop_id: z.string().optional(),
  variant_id: z.string().optional(),
  status: z.enum(["success", "success_with_conflict"]).optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})
