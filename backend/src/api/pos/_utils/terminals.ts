import type { MedusaContainer } from "@medusajs/framework/types"
import { SHOP_TERMINAL_MODULE } from "../../../modules/shop-terminal"
import type ShopTerminalModuleService from "../../../modules/shop-terminal/service"
import { canUseLocation } from "../../auth/_utils/shop-users"
import type { PosAuthTokenPayload } from "../../auth/_utils/jwt"

export type ShopTerminalRecord = {
  id: string
  shop_id: string
  location_id: string
  name: string
  code: string
  assigned_user_id?: string | null
  is_active?: boolean | null
  metadata?: Record<string, unknown> | null
}

export async function listShopTerminals(
  container: MedusaContainer,
  shopId: string
): Promise<ShopTerminalRecord[]> {
  const service = container.resolve<ShopTerminalModuleService>(SHOP_TERMINAL_MODULE)
  const [terminals] = await service.listAndCountShopTerminals(
    { shop_id: shopId, is_active: true },
    { take: 500, order: { created_at: "ASC" } }
  )
  return terminals as ShopTerminalRecord[]
}

export function canUseTerminal(
  auth: Pick<PosAuthTokenPayload, "role" | "assigned_location_ids" | "assigned_terminal_ids">,
  terminal: Pick<ShopTerminalRecord, "id" | "location_id" | "assigned_user_id">
) {
  if (!canUseLocation(auth, terminal.location_id)) {
    return false
  }

  const assignedTerminalIds = Array.isArray(auth.assigned_terminal_ids)
    ? auth.assigned_terminal_ids.filter((entry): entry is string => typeof entry === "string")
    : []

  if (auth.role === "owner" || auth.role === "admin") {
    return true
  }

  if (assignedTerminalIds.length === 0) {
    return true
  }

  return assignedTerminalIds.includes(terminal.id)
}

export function shapeShopTerminal(terminal: ShopTerminalRecord) {
  return {
    id: terminal.id,
    shop_id: terminal.shop_id,
    location_id: terminal.location_id,
    name: terminal.name,
    code: terminal.code,
    assigned_user_id: terminal.assigned_user_id ?? null,
    is_active: terminal.is_active !== false,
    metadata: terminal.metadata ?? null,
  }
}
