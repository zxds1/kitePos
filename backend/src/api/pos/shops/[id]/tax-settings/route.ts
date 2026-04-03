import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { SHOP_MODULE } from "../../../../../modules/shop"
import type ShopModuleService from "../../../../../modules/shop/service"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../../auth/_utils/jwt"
import { isOwnerRole } from "../../../../auth/_utils/shop-users"
import { getAuthorizedShop, shapeTaxSettings } from "../../../settings/_utils"
import { TaxService } from "../../../../../services/tax.service"

const UpdateTaxSettingsSchema = z.object({
  kra_pin: z.string().trim().max(20).optional().nullable(),
  vat_registered: z.boolean().optional(),
  vat_registration_number: z.string().trim().max(50).optional().nullable(),
  tax_type: z.enum(["vat", "turnover_tax", "exempt"]).optional(),
  turnover_threshold: z.coerce.number().min(0).optional(),
  tims_enabled: z.boolean().optional(),
  tims_device_id: z.string().trim().max(100).optional().nullable(),
  etr_serial_number: z.string().trim().max(100).optional().nullable(),
  invoice_prefix: z.string().trim().min(1).max(20).optional(),
  invoice_number_sequence: z.coerce.number().int().min(1).optional(),
  tax_invoice_enabled: z.boolean().optional(),
  whvat_applicable: z.boolean().optional(),
  whvat_registration: z.string().trim().max(100).optional().nullable(),
  tax_reporting_email: z.string().email().optional().nullable(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  if (auth.shop_id !== req.params.id) {
    res.status(403).json({ success: false, message: "You can only access your own tax settings" })
    return
  }
  if (!isOwnerRole(auth.role)) {
    res.status(403).json({ success: false, message: "Only the owner can access KRA and TIMS credentials" })
    return
  }

  const locationId =
    typeof req.query.location_id === "string" && req.query.location_id.trim().length > 0
      ? req.query.location_id.trim()
      : null
  const tax = new TaxService(req.scope)
  const context = await tax.getEffectiveTaxContext(req.params.id, locationId)

  res.status(200).json({
    success: true,
    tax_settings: context.settings,
  })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  if (auth.shop_id !== req.params.id) {
    res.status(403).json({ success: false, message: "You can only update your own tax settings" })
    return
  }

  if (!isOwnerRole(auth.role)) {
    res.status(403).json({ success: false, message: "Only the owner can update KRA and TIMS credentials" })
    return
  }

  const parsed = UpdateTaxSettingsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.flatten() })
    return
  }

  const locationId =
    typeof req.query.location_id === "string" && req.query.location_id.trim().length > 0
      ? req.query.location_id.trim()
      : null
  const tax = new TaxService(req.scope)

  if (locationId) {
    const context = await tax.updateBranchTaxSettings(req.params.id, locationId, parsed.data as Record<string, unknown>)
    res.status(200).json({
      success: true,
      tax_settings: context.settings,
    })
    return
  }

  const payload: Record<string, unknown> = { id: req.params.id, ...parsed.data }
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const [updated] = await shopService.updateShops([payload])

  res.status(200).json({
    success: true,
    tax_settings: shapeTaxSettings(updated as Record<string, unknown>),
  })
}
