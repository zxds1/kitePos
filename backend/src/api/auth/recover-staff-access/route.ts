import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP_USER_MODULE } from "../../../modules/shop-user"
import type ShopUserModuleService from "../../../modules/shop-user/service"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { AuthRecoverStaffAccess } from "../validators"
import { hashPhone, hashPin, hashSecret } from "../../../utils/hash"
import { issuePosAuthTokens } from "../_utils/jwt"
import { listShopLocations } from "../../pos/_utils/shop-locations"
import { shapeShopResponse } from "../_utils/shape-shop"
import { shapeShopUser } from "../_utils/shop-users"
import { recordAuditLog } from "../../pos/_utils/audit"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = AuthRecoverStaffAccess.parse(req.validatedBody ?? req.body)
  const userService: ShopUserModuleService = req.scope.resolve(SHOP_USER_MODULE)
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const phoneHash = hashPhone(body.phone_number)
  const recoveryHash = hashSecret(body.recovery_code, "recovery")
  const deviceHash = hashSecret(body.device_id, "device")

  const [users] = await userService.listAndCountShopUsers(
    {
      phone_hash: phoneHash,
      recovery_code_hash: recoveryHash,
      is_active: true,
    },
    { take: 1, order: { created_at: "ASC" } }
  )
  const user = users[0] as Record<string, unknown> | undefined
  const recoveryExpiry = user?.recovery_expires_at ? new Date(String(user.recovery_expires_at)) : null
  if (!user?.shop_id || !recoveryExpiry || recoveryExpiry.getTime() <= Date.now()) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired recovery code",
    })
    return
  }

  const updated = await userService.updateShopUsers({
    id: String(user.id),
    pin_hash: hashPin(body.new_pin),
    pin_updated_at: new Date(),
    must_change_pin: false,
    device_hash: deviceHash,
    recovery_code_hash: null,
    recovery_expires_at: null,
  } as unknown as Record<string, unknown>)

  const [shops] = await shopService.listAndCountShops(
    { id: String(user.shop_id) },
    { take: 1 }
  )
  const shop = shops[0] as Record<string, unknown> | undefined
  const allLocations = await listShopLocations(req.scope, String(user.shop_id))
  const assignedLocationIds = Array.isArray(updated.assigned_location_ids)
    ? updated.assigned_location_ids.filter((entry): entry is string => typeof entry === "string")
    : []
  const assignedTerminalIds = Array.isArray(updated.assigned_terminal_ids)
    ? updated.assigned_terminal_ids.filter((entry): entry is string => typeof entry === "string")
    : []
  const locations =
    updated.role === "owner" || updated.role === "admin"
      ? allLocations
      : allLocations.filter((location) => assignedLocationIds.includes(location.id))

  const tokens = issuePosAuthTokens({
    phone_number: body.phone_number,
    shop_id: String(user.shop_id),
    is_registered: Boolean(shop?.consent_given),
    user_id: String(user.id),
    role:
      typeof updated.role === "string"
        ? (updated.role as "owner" | "admin" | "branch_manager" | "cashier")
        : null,
    assigned_location_ids: assignedLocationIds,
    assigned_terminal_ids: assignedTerminalIds,
  })

  await recordAuditLog(req.scope, {
    shop_id: String(user.shop_id),
    actor_user_id: String(user.id),
    actor_role: typeof updated.role === "string" ? updated.role : null,
    action: "staff.access_recovered",
    entity_type: "shop_user",
    entity_id: String(user.id),
    metadata: {
      device_rebound: true,
    },
  })

  res.status(200).json({
    success: true,
    ...tokens,
    user_id: String(user.id),
    role: updated.role,
    assigned_location_ids: assignedLocationIds,
    assigned_terminal_ids: assignedTerminalIds,
    next_step: "home",
    shop: shop ? shapeShopResponse(shop, locations, updated as never) : null,
    current_user: shapeShopUser(updated as never),
  })
}
