import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { canManageBranches } from "../../../auth/_utils/shop-users"
import { SHOP_TERMINAL_MODULE } from "../../../../modules/shop-terminal"
import type ShopTerminalModuleService from "../../../../modules/shop-terminal/service"
import { listShopTerminals, shapeShopTerminal } from "../../_utils/terminals"
import { listActiveShopUsers } from "../../../auth/_utils/shop-users"
import { recordAuditLog } from "../../_utils/audit"

const UpdateTerminalSchema = z.object({
  name: z.string().trim().min(1).optional(),
  assigned_user_id: z.string().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageBranches(auth.role)) {
    res.status(403).json({
      success: false,
      message: "Only owner or admin can update checkouts",
    })
    return
  }

  const terminalId = req.params.id
  if (!terminalId) {
    res.status(400).json({
      success: false,
      message: "Checkout id is required",
    })
    return
  }

  const parsed = UpdateTerminalSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request format",
      errors: parsed.error.flatten(),
    })
    return
  }

  const terminals = await listShopTerminals(req.scope, auth.shop_id)
  const existing = terminals.find((terminal) => terminal.id === terminalId)
  if (!existing) {
    res.status(404).json({
      success: false,
      message: "Checkout not found",
    })
    return
  }

  if (parsed.data.assigned_user_id) {
    const users = await listActiveShopUsers(req.scope, auth.shop_id)
    const assignedUser = users.find((user) => user.id === parsed.data.assigned_user_id)
    if (!assignedUser) {
      res.status(400).json({
        success: false,
        message: "Assigned staff user not found",
      })
      return
    }
  }

  const service: ShopTerminalModuleService = req.scope.resolve(SHOP_TERMINAL_MODULE)
  const updated = await service.updateShopTerminals({
    id: terminalId,
    name: parsed.data.name ?? existing.name,
    assigned_user_id:
      parsed.data.assigned_user_id !== undefined
        ? parsed.data.assigned_user_id
        : existing.assigned_user_id ?? null,
    is_active: parsed.data.is_active ?? (existing.is_active !== false),
  } as unknown as Record<string, unknown>)

  await recordAuditLog(req.scope, {
    shop_id: auth.shop_id,
    actor_user_id: auth.user_id ?? null,
    actor_role: auth.role ?? null,
    action: "terminal.updated",
    entity_type: "terminal",
    entity_id: terminalId,
    location_id: existing.location_id,
    metadata: {
      assigned_user_id:
        parsed.data.assigned_user_id !== undefined
          ? parsed.data.assigned_user_id
          : existing.assigned_user_id ?? null,
      is_active: parsed.data.is_active ?? (existing.is_active !== false),
    },
  })

  res.status(200).json({
    success: true,
    terminal: shapeShopTerminal(updated as never),
  })
}
