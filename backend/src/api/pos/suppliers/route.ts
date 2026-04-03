import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { canManageBranches } from "../../auth/_utils/shop-users"
import { SUPPLIER_MODULE } from "../../../modules/supplier"
import type SupplierModuleService from "../../../modules/supplier/service"
import { recordAuditLog } from "../_utils/audit"

const SupplierSchema = z.object({
  supplier_shop_id: z.string().optional().nullable(),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1).default("general"),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().trim().min(7).optional().nullable(),
  billing_tier: z.enum(["standard", "premium", "strategic"]).default("standard"),
  lead_time_days: z.coerce.number().int().min(1).max(90).default(3),
  notes: z.string().trim().optional().nullable(),
  delivery_options: z.record(z.string(), z.any()).optional().nullable(),
  accepts_auto_reorder: z.boolean().optional().default(false),
  preferred: z.boolean().optional().default(false),
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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const service: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE)
  const [suppliers] = await service.listAndCountSuppliers(
    { shop_id: auth.shop_id },
    { take: 200, order: { created_at: "ASC" } }
  )

  res.status(200).json({
    success: true,
    suppliers: (suppliers as Array<Record<string, unknown>>).map(shapeSupplier),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageBranches(auth.role)) {
    res.status(403).json({ success: false, message: "Only owner or admin can add suppliers" })
    return
  }

  const parsed = SupplierSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid supplier payload", errors: parsed.error.flatten() })
    return
  }

  const service: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE)
  const created = await service.createSuppliers({
    id: `sup_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_id: auth.shop_id,
    ...parsed.data,
    is_active: true,
  } as Record<string, unknown>)

  await recordAuditLog(req.scope, {
    shop_id: auth.shop_id,
    actor_user_id: auth.user_id ?? null,
    actor_role: auth.role ?? null,
    action: "supplier.created",
    entity_type: "supplier",
    entity_id: String((created as Record<string, unknown>).id),
    metadata: { name: parsed.data.name, category: parsed.data.category },
  })

  res.status(201).json({ success: true, supplier: shapeSupplier(created as Record<string, unknown>) })
}
