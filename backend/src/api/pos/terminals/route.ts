import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { canManageBranches } from "../../auth/_utils/shop-users"
import { listShopLocations } from "../_utils/shop-locations"
import {
  canUseTerminal,
  listShopTerminals,
  shapeShopTerminal,
} from "../_utils/terminals"
import { SHOP_TERMINAL_MODULE } from "../../../modules/shop-terminal"
import type ShopTerminalModuleService from "../../../modules/shop-terminal/service"
import { recordAuditLog } from "../_utils/audit"

const CreateTerminalSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  location_id: z.string().min(1),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const terminals = await listShopTerminals(req.scope, auth.shop_id)
  res.status(200).json({
    success: true,
    terminals: terminals
      .filter((terminal) => canUseTerminal(auth, terminal))
      .map(shapeShopTerminal),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageBranches(auth.role)) {
    res.status(403).json({
      success: false,
      message: "Only owner or admin can create checkouts",
    })
    return
  }

  const parsed = CreateTerminalSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request format",
      errors: parsed.error.flatten(),
    })
    return
  }

  const locations = await listShopLocations(req.scope, auth.shop_id)
  const location = locations.find((entry) => entry.id === parsed.data.location_id)
  if (!location) {
    res.status(400).json({
      success: false,
      message: "Unknown branch for checkout",
    })
    return
  }

  const service: ShopTerminalModuleService = req.scope.resolve(SHOP_TERMINAL_MODULE)
  const created = await service.createShopTerminals({
    id: `term_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_id: auth.shop_id,
    location_id: parsed.data.location_id,
    name: parsed.data.name.trim(),
    code: parsed.data.code.trim().toLowerCase(),
    is_active: true,
  } as unknown as Record<string, unknown>)

  await recordAuditLog(req.scope, {
    shop_id: auth.shop_id,
    actor_user_id: auth.user_id ?? null,
    actor_role: auth.role ?? null,
    action: "terminal.created",
    entity_type: "terminal",
    entity_id: String((created as Record<string, unknown>).id),
    location_id: parsed.data.location_id,
    metadata: {
      name: parsed.data.name.trim(),
      code: parsed.data.code.trim().toLowerCase(),
    },
  })

  res.status(201).json({
    success: true,
    terminal: shapeShopTerminal(created as never),
  })
}
