import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { canManageBranches } from "../../../auth/_utils/shop-users"
import { SUPPLIER_MODULE } from "../../../../modules/supplier"
import type SupplierModuleService from "../../../../modules/supplier/service"

const UpdateSupplierSchema = z.object({
  supplier_shop_id: z.string().optional().nullable(),
  name: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().trim().min(7).optional().nullable(),
  billing_tier: z.enum(["standard", "premium", "strategic"]).optional(),
  lead_time_days: z.coerce.number().int().min(1).max(90).optional(),
  notes: z.string().trim().optional().nullable(),
  delivery_options: z.record(z.string(), z.any()).optional().nullable(),
  accepts_auto_reorder: z.boolean().optional(),
  preferred: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

function shapeSupplier(supplier: Record<string, unknown>) {
  return {
    id: String(supplier.id),
    shop_id: String(supplier.shop_id),
    supplier_shop_id:
      typeof supplier.supplier_shop_id === "string" ? supplier.supplier_shop_id : null,
    name: String(supplier.name ?? ""),
    category: String(supplier.category ?? "general"),
    contact_email:
      typeof supplier.contact_email === "string" ? supplier.contact_email : null,
    contact_phone:
      typeof supplier.contact_phone === "string" ? supplier.contact_phone : null,
    billing_tier: String(supplier.billing_tier ?? "standard"),
    lead_time_days: Number(supplier.lead_time_days ?? 3),
    notes: typeof supplier.notes === "string" ? supplier.notes : null,
    delivery_options:
      supplier.delivery_options && typeof supplier.delivery_options === "object"
        ? supplier.delivery_options
        : null,
    accepts_auto_reorder: supplier.accepts_auto_reorder === true,
    preferred: supplier.preferred === true,
    is_active: supplier.is_active !== false,
    created_at: supplier.created_at ?? null,
    updated_at: supplier.updated_at ?? null,
  }
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageBranches(auth.role)) {
    res.status(403).json({ success: false, message: "Only owner or admin can update suppliers" })
    return
  }

  const parsed = UpdateSupplierSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid supplier payload", errors: parsed.error.flatten() })
    return
  }

  const service: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE)
  const [suppliers] = await service.listAndCountSuppliers(
    { id: req.params.id, shop_id: auth.shop_id },
    { take: 1 }
  )
  const existing = suppliers[0] as Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ success: false, message: "Supplier not found" })
    return
  }

  const [updated] = await service.updateSuppliers([
    {
      id: req.params.id,
      ...parsed.data,
    },
  ])

  res.status(200).json({ success: true, supplier: shapeSupplier(updated as Record<string, unknown>) })
}
