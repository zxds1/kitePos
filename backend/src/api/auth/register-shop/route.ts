import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import {
  authenticatePosJwt,
  issuePosAuthTokens,
  type PosAuthenticatedRequest,
} from "../_utils/jwt"
import { hashPhone } from "../../../utils/hash"
import { AuthRegisterShop } from "../validators"

function shapeShop(shop: Record<string, unknown>) {
  return {
    id: shop.id,
    shop_name: shop.shop_name,
    region_code: shop.region_code,
    ward_code: shop.ward_code,
    category: shop.category,
    consent_given: shop.consent_given,
    consent_timestamp: shop.consent_timestamp,
    is_active: shop.is_active,
    mpesa_phone: shop.mpesa_phone,
    mpesa_till: shop.mpesa_till,
    mpesa_paybill: shop.mpesa_paybill,
    accept_mpesa: shop.accept_mpesa,
    mpesa_display_name: shop.mpesa_display_name,
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)

  if (!auth) {
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
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

  if (existingShop) {
    res.status(409).json({
      success: false,
      message: "A shop is already registered for this phone number",
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

  const tokens = issuePosAuthTokens({
    phone_number: body.owner_phone,
    shop_id: String((shop as Record<string, unknown>).id),
    is_registered: true,
  })

  res.status(201).json({
    success: true,
    ...tokens,
    next_step: "home",
    shop: shapeShop(shop as unknown as Record<string, unknown>),
  })
}
