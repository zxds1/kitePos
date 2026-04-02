import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { SHOP_LOCATION_MODULE } from "../../../modules/shop-location"
import type ShopLocationModuleService from "../../../modules/shop-location/service"
import { SHOP_USER_MODULE } from "../../../modules/shop-user"
import type ShopUserModuleService from "../../../modules/shop-user/service"
import {
  authenticatePosJwt,
  issuePosAuthTokens,
  type PosAuthenticatedRequest,
} from "../_utils/jwt"
import { hashPhone } from "../../../utils/hash"
import { AuthRegisterShop } from "../validators"
import { listShopLocations } from "../../pos/_utils/shop-locations"
import { shapeShopUser } from "../_utils/shop-users"
import { shapeShop } from "../_utils/shape-shop"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)

  if (!auth) {
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const shopLocationService: ShopLocationModuleService =
    req.scope.resolve(SHOP_LOCATION_MODULE)
  const shopUserService: ShopUserModuleService = req.scope.resolve(
    SHOP_USER_MODULE
  )
  const body = AuthRegisterShop.parse(req.validatedBody)
  const ownerPhoneHash = hashPhone(body.owner_phone)

  if (auth.phone_number !== body.owner_phone) {
    res.status(403).json({
      success: false,
      message: "Token does not match owner phone number",
    })
    return
  }


  const [existingShop] = await shopService.listShops(
    { owner_phone_hash: ownerPhoneHash },
    { take: 1 }
  )
  const [existingUsers] = await shopUserService.listAndCountShopUsers(
    { phone_hash: ownerPhoneHash, is_active: true },
    { take: 1 }
  )

  if (existingShop || existingUsers.length > 0) {
    res.status(409).json({
      success: false,
      message: "This phone number is already linked to a shop account",
    })
    return
  }

  const shop = await shopService.createShops({
    id: `shop_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_name: body.shop_name,
    owner_phone_hash: ownerPhoneHash,
    region_code: body.region_code,
    ward_code: body.ward_code,
    category: body.category ?? null,
    consent_given: body.consent_given,
    consent_timestamp: body.consent_timestamp ?? new Date(),
    is_active: body.is_active,
    mpesa_phone: body.mpesa_phone ?? null,
    mpesa_till: body.mpesa_till ?? null,
    mpesa_paybill: body.mpesa_paybill ?? null,
    accept_mpesa: body.accept_mpesa,
    mpesa_display_name: body.mpesa_display_name ?? null,
  })

  const shopId = String((shop as Record<string, unknown>).id)
  await shopLocationService.createShopLocations({
    id: `loc_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_id: shopId,
    name: "Main Shop",
    code: "main",
    address: body.shop_name,
    location_type: "physical",
    is_default: true,
    is_active: true,
  } as unknown as Record<string, unknown>)

  const ownerUser = await shopUserService.createShopUsers({
    id: `user_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_id: shopId,
    phone_hash: ownerPhoneHash,
    full_name: null,
    role: "owner",
    assigned_location_ids: [],
    assigned_terminal_ids: [],
    is_active: true,
    last_login_at: new Date(),
  } as unknown as Record<string, unknown>)

  const tokens = issuePosAuthTokens({
    phone_number: body.owner_phone,
    shop_id: shopId,
    is_registered: true,
    user_id: String((ownerUser as Record<string, unknown>).id),
    role: "owner",
    assigned_location_ids: [],
    assigned_terminal_ids: [],
  })

  const locations = await listShopLocations(req.scope, shopId)

  res.status(201).json({
    success: true,
    ...tokens,
    next_step: "home",
    shop: {
      ...shapeShop(shop as unknown as Record<string, unknown>),
      locations,
      current_user: shapeShopUser(ownerUser as never),
    },
  })
}
