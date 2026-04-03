import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { AUTO_REORDER_RULE_MODULE } from "../../../../modules/auto-reorder-rule"
import type AutoReorderRuleModuleService from "../../../../modules/auto-reorder-rule/service"
import type { PosAuthTokenPayload } from "../../../auth/_utils/jwt"

const UpdateRuleSchema = z
  .object({
    trigger_type: z.enum(["stock_threshold", "schedule", "predictive"]).optional(),
    stock_threshold: z.coerce.number().positive().optional().nullable(),
    schedule_frequency_days: z.coerce.number().int().positive().optional().nullable(),
    order_quantity: z.coerce.number().positive().optional(),
    preferred_supplier: z.boolean().optional(),
    auto_approve: z.boolean().optional(),
    max_price: z.coerce.number().positive().optional().nullable(),
    budget_limit_monthly: z.coerce.number().positive().optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })

function shapeRule(rule: Record<string, unknown>) {
  return {
    id: String(rule.id),
    retailer_shop_id: String(rule.retailer_shop_id),
    supplier_shop_id: String(rule.supplier_shop_id),
    variant_id: String(rule.variant_id),
    trigger_type: String(rule.trigger_type ?? "stock_threshold"),
    stock_threshold: rule.stock_threshold == null ? null : Number(rule.stock_threshold),
    schedule_frequency_days:
      rule.schedule_frequency_days == null
        ? null
        : Number(rule.schedule_frequency_days),
    last_ordered_at: rule.last_ordered_at ?? null,
    order_quantity: Number(rule.order_quantity ?? 0),
    preferred_supplier: rule.preferred_supplier !== false,
    auto_approve: rule.auto_approve === true,
    max_price: rule.max_price == null ? null : Number(rule.max_price),
    budget_limit_monthly:
      rule.budget_limit_monthly == null
        ? null
        : Number(rule.budget_limit_monthly),
    is_active: rule.is_active !== false,
  }
}

function ensureOwner(
  req: MedusaRequest,
  res: MedusaResponse
): PosAuthTokenPayload | null {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return null
  }

  if (auth.role !== "owner") {
    res.status(403).json({
      success: false,
      message: "Only the shop owner can configure auto-reorder rules",
    })
    return null
  }

  return auth
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = ensureOwner(req, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = UpdateRuleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid auto-reorder payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const service: AutoReorderRuleModuleService = req.scope.resolve(
    AUTO_REORDER_RULE_MODULE
  )
  const [rules] = await service.listAndCountAutoReorderRules(
    { id: req.params.id, retailer_shop_id: auth.shop_id },
    { take: 1 }
  )
  if (!rules[0]) {
    res.status(404).json({ success: false, message: "Rule not found" })
    return
  }

  const [updated] = await service.updateAutoReorderRules([
    {
      id: req.params.id,
      ...parsed.data,
    },
  ] as Record<string, unknown>[])

  res.status(200).json({
    success: true,
    rule: shapeRule(updated as Record<string, unknown>),
  })
}
