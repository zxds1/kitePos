import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP_USER_MODULE } from "../../../modules/shop-user"
import type ShopUserModuleService from "../../../modules/shop-user/service"
import { authenticatePosJwt, issuePosAuthTokens, type PosAuthenticatedRequest } from "../_utils/jwt"
import { AuthChangePin } from "../validators"
import { hashPin, hashSecret } from "../../../utils/hash"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { listShopLocations } from "../../pos/_utils/shop-locations"
import { shapeShopResponse } from "../_utils/shape-shop"
import { shapeShopUser } from "../_utils/shop-users"
import { recordAuditLog } from "../../pos/_utils/audit"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id || !auth.user_id) {
    return
  }

  const body = AuthChangePin.parse(req.validatedBody ?? req.body)
  const deviceHash = hashSecret(body.device_id, "device")
  const userService: ShopUserModuleService = req.scope.resolve(SHOP_USER_MODULE)
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const [users] = await userService.listAndCountShopUsers(
    { id: auth.user_id, shop_id: auth.shop_id, is_active: true },
    { take: 1 }
  )
  const user = users[0] as Record<string, unknown> | undefined
  if (!user) {
    res.status(404).json({ success: false, message: "Staff account not found" })
    return
  }

  if (typeof user.device_hash === "string" && user.device_hash.length > 0 && user.device_hash !== deviceHash) {
    res.status(423).json({
      success: false,
      message: "This account is locked to another device",
      code: "DEVICE_MISMATCH",
    })
    return
  }

  const updated = await userService.updateShopUsers({
    id: auth.user_id,
    pin_hash: hashPin(body.pin),
    pin_updated_at: new Date(),
    must_change_pin: false,
    device_hash: deviceHash,
  } as unknown as Record<string, unknown>)

  const [shops] = await shopService.listAndCountShops({ id: auth.shop_id }, { take: 1 })
  const shop = shops[0] as Record<string, unknown> | undefined
  const locations = await listShopLocations(req.scope, auth.shop_id)
  const assignedLocationIds = Array.isArray(updated.assigned_location_ids)
    ? updated.assigned_location_ids.filter((entry): entry is string => typeof entry === "string")
    : []
  const assignedTerminalIds = Array.isArray(updated.assigned_terminal_ids)
    ? updated.assigned_terminal_ids.filter((entry): entry is string => typeof entry === "string")
    : []

  const tokens = issuePosAuthTokens({
    phone_number: auth.phone_number,
    shop_id: auth.shop_id,
    is_registered: Boolean(shop?.consent_given),
    user_id: auth.user_id,
    role: (updated.role as "owner" | "admin" | "branch_manager" | "cashier") ?? null,
    assigned_location_ids: assignedLocationIds,
    assigned_terminal_ids: assignedTerminalIds,
  })

  await recordAuditLog(req.scope, {
    shop_id: auth.shop_id,
    actor_user_id: auth.user_id,
    actor_role: auth.role ?? null,
    action: "staff.pin_changed",
    entity_type: "shop_user",
    entity_id: auth.user_id,
    metadata: {
      forced_rotation_completed: true,
      device_bound: true,
    },
  })

  res.status(200).json({
    success: true,
    ...tokens,
    user_id: auth.user_id,
    role: updated.role,
    assigned_location_ids: assignedLocationIds,
    assigned_terminal_ids: assignedTerminalIds,
    next_step: "home",
    shop: shop ? shapeShopResponse(shop, locations, updated as never) : null,
    current_user: shapeShopUser(updated as never),
  })
}
