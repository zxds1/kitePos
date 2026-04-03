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
  image_url: z.string().nullable().optional(),
  inventory_type: InventoryTypeSchema.default("discrete"),
  purchase_unit: z.string().min(1).default("Unit"),
  purchase_value: z.number().positive(),
  cost_per_purchase: z.number().positive().optional(),
  selling_units: z.array(SellingUnitSchema).min(1),
  low_stock_threshold: z.number().min(0).default(10),
  is_active: z.boolean().default(true),
  stock_remaining: z.number().min(0).optional(),
  brand: z.string().min(1).optional(),
  style_code: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  gender: z.enum(["men", "women", "unisex", "boys", "girls"]).optional(),
  material: z.string().min(1).optional(),
  imei: z.string().regex(/^\d{15}$/).optional(),
  serial_number: z.string().min(1).optional(),
  model_name: z.string().min(1).optional(),
  storage_capacity: z.string().min(1).optional(),
  device_condition: z.enum(["new", "refurbished", "used"]).optional(),
  warranty_enabled: z.boolean().default(false),
  warranty_months: z.number().int().min(0).nullable().optional(),
  is_returnable: z.boolean().default(true),
  return_window_days: z.number().int().min(0).default(7),
})

export const UpdateProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: z.string().min(1).nullable().optional(),
    image_url: z.string().nullable().optional(),
    inventory_type: InventoryTypeSchema.optional(),
    purchase_unit: z.string().min(1).optional(),
    purchase_value: z.number().positive().optional(),
    cost_per_purchase: z.number().positive().nullable().optional(),
    selling_units: z.array(SellingUnitSchema).min(1).optional(),
    low_stock_threshold: z.number().min(0).optional(),
    is_active: z.boolean().optional(),
    brand: z.string().min(1).nullable().optional(),
    style_code: z.string().min(1).nullable().optional(),
    size: z.string().min(1).nullable().optional(),
    color: z.string().min(1).nullable().optional(),
    gender: z.enum(["men", "women", "unisex", "boys", "girls"]).nullable().optional(),
    material: z.string().min(1).nullable().optional(),
    imei: z.string().regex(/^\d{15}$/).nullable().optional(),
    serial_number: z.string().min(1).nullable().optional(),
    model_name: z.string().min(1).nullable().optional(),
    storage_capacity: z.string().min(1).nullable().optional(),
    device_condition: z.enum(["new", "refurbished", "used"]).optional(),
    warranty_enabled: z.boolean().optional(),
    warranty_months: z.number().int().min(0).nullable().optional(),
    is_returnable: z.boolean().optional(),
    return_window_days: z.number().int().min(0).optional(),
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
