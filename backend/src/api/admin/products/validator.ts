import { z } from "zod"

export const InventoryTypeSchema = z.enum([
  "discrete",
  "bulk_loose",
  "bulk_liquid",
  "multi_pack",
  "expiry_tracked",
])

export const SellingUnitSchema = z.object({
  unit: z.string().min(1),
  price: z.number().positive(),
  conversion_value: z.number().positive(),
})

export const ListProductsSchema = z.object({
  shop_id: z.string().optional(),
  location_id: z.string().optional(),
  inventory_type: InventoryTypeSchema.optional(),
  is_active: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => {
      if (value == null) {
        return true
      }

      return value === true || value === "true"
    }),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const CreateProductSchema = z.object({
  name: z.string().min(1),
  location_id: z.string().optional(),
  category: z.string().min(1).optional(),
  inventory_type: InventoryTypeSchema.default("discrete"),
  purchase_unit: z.string().min(1).default("Unit"),
  purchase_value: z.number().positive(),
  cost_per_purchase: z.number().positive().optional(),
  selling_units: z.array(SellingUnitSchema).min(1),
  low_stock_threshold: z.number().min(0).default(10),
  is_active: z.boolean().default(true),
  stock_remaining: z.number().min(0).optional(),
})

export const UpdateProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: z.string().min(1).nullable().optional(),
    inventory_type: InventoryTypeSchema.optional(),
    purchase_unit: z.string().min(1).optional(),
    purchase_value: z.number().positive().optional(),
    cost_per_purchase: z.number().positive().nullable().optional(),
    selling_units: z.array(SellingUnitSchema).min(1).optional(),
    low_stock_threshold: z.number().min(0).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  })

export const AdjustStockSchema = z.object({
  adjustment_type: z.enum([
    "restock",
    "sale",
    "correction",
    "wastage",
    "theft",
  ]),
  quantity: z.number().positive(),
  reason: z.string().optional(),
  shop_id: z.string().optional(),
  location_id: z.string().optional(),
})
