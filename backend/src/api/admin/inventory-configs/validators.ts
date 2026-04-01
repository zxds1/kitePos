import { z } from "zod"

const SellingUnitSchema = z.object({
  unit: z.string().min(1),
  price: z.number(),
  conversion_value: z.number(),
})

export const AdminCreateInventoryConfig = z.object({
  variant_id: z.string().min(1),
  inventory_type: z.enum([
    "discrete",
    "bulk_loose",
    "bulk_liquid",
    "multi_pack",
    "expiry_tracked",
  ]),
  purchase_unit: z.string().min(1),
  purchase_value: z.number(),
  selling_units: z.array(SellingUnitSchema).min(1),
  low_stock_threshold: z.number(),
  is_active: z.boolean().optional().default(true),
})

export const AdminListInventoryConfigs = z.object({
  variant_id: z.string().optional(),
  inventory_type: z
    .enum([
      "discrete",
      "bulk_loose",
      "bulk_liquid",
      "multi_pack",
      "expiry_tracked",
    ])
    .optional(),
  is_active: z
    .union([
      z.boolean(),
      z
        .string()
        .transform((value) => value === "true")
        .pipe(z.boolean()),
    ])
    .optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().optional(),
})
