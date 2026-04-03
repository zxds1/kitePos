import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import { canManageBranches } from "../../../../auth/_utils/shop-users"
import { SHOP_MODULE } from "../../../../../modules/shop"
import type ShopModuleService from "../../../../../modules/shop/service"
import { getAuthorizedShop } from "../../../settings/_utils"
import { shapeSupplierNetworkShop } from "../../../suppliers/_utils/network"

const DeliveryOptionsSchema = z.object({
  methods: z.array(z.string()).default(["delivery"]),
  areas: z.array(z.string()).default([]),
  fees: z
    .object({
      flat: z.coerce.number().min(0).default(0),
      free_above: z.coerce.number().min(0).optional().nullable(),
    })
    .default({ flat: 0, free_above: null }),
  min_order: z.coerce.number().min(0).default(0),
  lead_time_days: z.coerce.number().int().min(1).default(1),
  schedule: z.array(z.string()).default([]),
})

const UpdateSupplierProfileSchema = z.object({
  is_supplier: z.boolean().optional(),
  supplier_verified: z.boolean().optional(),
  supplier_categories: z.array(z.string()).optional(),
  supplier_description: z.string().optional().nullable(),
  years_in_business: z.coerce.number().int().min(0).optional().nullable(),
  delivery_options: DeliveryOptionsSchema.optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (auth.shop_id !== req.params.id) {
    res.status(403).json({ success: false, message: "Access denied" })
    return
  }

  const service: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const shop = await getAuthorizedShop(service, req.params.id)
  if (!shop) {
    res.status(404).json({ success: false, message: "Shop not found" })
    return
  }

  res.status(200).json({
    success: true,
    supplier_profile: shapeSupplierNetworkShop(shop),
  })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (auth.shop_id !== req.params.id || !canManageBranches(auth.role)) {
    res.status(403).json({ success: false, message: "Access denied" })
    return
  }

  const parsed = UpdateSupplierProfileSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid supplier profile payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const service: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const existingShop = await getAuthorizedShop(service, req.params.id)
  if (!existingShop) {
    res.status(404).json({ success: false, message: "Shop not found" })
    return
  }

  const mergedCategories =
    parsed.data.supplier_categories && parsed.data.supplier_categories.length > 0
      ? parsed.data.supplier_categories
      : undefined

  const [updated] = await service.updateShops([
    {
      id: req.params.id,
      ...parsed.data,
      ...(mergedCategories ? { supplier_categories: mergedCategories } : {}),
    },
  ] as Record<string, unknown>[])

  res.status(200).json({
    success: true,
    supplier_profile: shapeSupplierNetworkShop(updated as Record<string, unknown>),
  })
}
