import { z } from "zod"

export const AdminCreateShop = z.object({
  id: z.string().min(1).optional(),
  shop_name: z.string().min(1),
  owner_phone: z
    .string()
    .regex(/^254[0-9]{9}$/, "Owner phone must be in format 2547XXXXXXXX"),
  region_code: z.string().min(1),
  ward_code: z.string().min(1),
  consent_given: z.boolean().optional().default(false),
  consent_timestamp: z.coerce.date().optional(),
  is_active: z.boolean().optional().default(true),
  mpesa_phone: z
    .string()
    .regex(/^254[0-9]{9}$/, "M-Pesa phone must be in format 2547XXXXXXXX")
    .optional(),
  mpesa_till: z.string().optional(),
  mpesa_paybill: z.string().optional(),
  accept_mpesa: z.boolean().optional().default(true),
  mpesa_display_name: z.string().max(50).optional(),
})

export const AdminListShops = z.object({
  region_code: z.string().optional(),
  ward_code: z.string().optional(),
  is_active: z
    .union([
      z.boolean(),
      z.string().transform((value) => value === "true").pipe(z.boolean()),
    ])
    .optional(),
  accept_mpesa: z
    .union([
      z.boolean(),
      z.string().transform((value) => value === "true").pipe(z.boolean()),
    ])
    .optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
})
