import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { SHOP_USER_MODULE } from "../../../modules/shop-user"
import type ShopUserModuleService from "../../../modules/shop-user/service"
import { issuePosAuthTokens } from "../_utils/jwt"
import { hashPin, hashPhone, hashSecret } from "../../../utils/hash"
import { AuthLoginPin } from "../validators"
import { listShopLocations } from "../../pos/_utils/shop-locations"
import { shapeShopResponse } from "../_utils/shape-shop"
import { shapeShopUser } from "../_utils/shop-users"
import { ensureDevBypassAuthRecords } from "../_utils/dev-bypass"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const shopUserService: ShopUserModuleService = req.scope.resolve(SHOP_USER_MODULE)
  const body = AuthLoginPin.parse(req.validatedBody ?? req.body)
  const phoneHash = hashPhone(body.phone_number)
  const pinHash = hashPin(body.pin)
  const deviceHash = hashSecret(body.device_id, "device")

  const [users] = await shopUserService.listAndCountShopUsers(
    {
      phone_hash: phoneHash,
      pin_hash: pinHash,
      is_active: true,
    },
    {
      take: 1,
      order: { created_at: "ASC" },
    }
  )

  let currentUser = users[0] as Record<string, unknown> | undefined
  let shopRecord: Record<string, unknown> | undefined
  let preloadedLocations: Awaited<ReturnType<typeof listShopLocations>> = []

  if (!currentUser?.shop_id) {
    const devAuth = await ensureDevBypassAuthRecords(req.scope, {
      phoneNumber: body.phone_number,
      deviceId: body.device_id,
      pin: body.pin,
    })

    if (devAuth) {
      currentUser = devAuth.user
      shopRecord = devAuth.shop
      preloadedLocations = devAuth.locations
    }
  }

  if (!currentUser?.shop_id) {
    res.status(401).json({
      success: false,
      message: "Invalid phone number or PIN",
    })
    return
  }
  if (typeof currentUser.device_hash === "string" && currentUser.device_hash.length > 0) {
    if (currentUser.device_hash !== deviceHash) {
      res.status(423).json({
        success: false,
        message: "This staff account is locked to another device. Use a recovery code or ask the owner to reset access.",
        code: "DEVICE_MISMATCH",
      })
      return
    }
  }

  if (!shopRecord) {
    const [shops] = await shopService.listAndCountShops(
      { id: String(currentUser.shop_id) },
      { take: 1 }
    )
    shopRecord = shops[0] as Record<string, unknown> | undefined
  }

  if (!shopRecord) {
    res.status(404).json({
      success: false,
      message: "Shop not found",
    })
    return
  }

  const allLocations =
    preloadedLocations.length > 0
      ? preloadedLocations
      : await listShopLocations(req.scope, String(currentUser.shop_id))
  const assignedLocationIds = Array.isArray(currentUser.assigned_location_ids)
    ? currentUser.assigned_location_ids
        .filter((entry): entry is string => typeof entry === "string")
    : []
  const assignedTerminalIds = Array.isArray(currentUser.assigned_terminal_ids)
    ? currentUser.assigned_terminal_ids
        .filter((entry): entry is string => typeof entry === "string")
    : []
  const locations =
    currentUser.role === "owner" || currentUser.role === "admin"
      ? allLocations
      : allLocations.filter((location) => assignedLocationIds.includes(location.id))

  await shopUserService.updateShopUsers({
    id: String(currentUser.id),
    device_hash: currentUser.device_hash ?? deviceHash,
    last_login_at: new Date(),
  } as unknown as Record<string, unknown>)

  const tokens = issuePosAuthTokens({
    phone_number: body.phone_number,
    shop_id: String(currentUser.shop_id),
    is_registered: Boolean(shopRecord.consent_given),
    user_id: String(currentUser.id),
    role:
      typeof currentUser.role === "string"
        ? (currentUser.role as "owner" | "admin" | "branch_manager" | "cashier")
        : null,
    assigned_location_ids: assignedLocationIds,
    assigned_terminal_ids: assignedTerminalIds,
  })

  res.status(200).json({
    success: true,
    is_registered: Boolean(shopRecord.consent_given),
    ...tokens,
    user_id: String(currentUser.id),
    role: currentUser.role,
    assigned_location_ids: assignedLocationIds,
    assigned_terminal_ids: assignedTerminalIds,
    next_step: currentUser.must_change_pin === true
      ? "change_pin"
      : shopRecord.consent_given
        ? "home"
        : "register_shop",
    shop: shapeShopResponse(shopRecord, locations, currentUser as never),
    current_user: shapeShopUser(currentUser as never),
  })
}
