import type ShopModuleService from "../../../modules/shop/service"
import type { PosAuthTokenPayload } from "../../auth/_utils/jwt"

export function shapeShopProfile(
  shop: Record<string, unknown>,
  auth?: PosAuthTokenPayload | null
) {
  return {
    id: shop.id,
    shop_name: shop.shop_name,
    owner_name: shop.owner_name,
    owner_phone: auth?.phone_number ?? null,
    region_code: shop.region_code,
    ward_code: shop.ward_code,
    address: shop.address,
    business_license: shop.business_license,
    category: shop.category,
    created_at: shop.created_at,
    updated_at: shop.updated_at,
  }
}

export function shapePaymentSettings(shop: Record<string, unknown>) {
  return {
    id: shop.id,
    shop_name: shop.shop_name,
    mpesa_phone: shop.mpesa_phone,
    mpesa_till: shop.mpesa_till,
    mpesa_paybill: shop.mpesa_paybill,
    accept_mpesa: shop.accept_mpesa,
    mpesa_display_name: shop.mpesa_display_name,
    accept_cash: true,
    accept_card: false,
  }
}

export function shapePrivacyConsent(shop: Record<string, unknown>) {
  return {
    data_collection: shop.consent_given === true,
    data_sharing: shop.data_sharing_consent === true,
    analytics: shop.analytics_consent === true,
    consent_date: shop.consent_timestamp,
    consent_version: shop.consent_version ?? "2026-04",
  }
}

export async function getAuthorizedShop(
  shopService: ShopModuleService,
  shopId: string
) {
  const [shop] = await shopService.listShops(
    { id: shopId },
    {
      take: 1,
    }
  )

  return (shop as Record<string, unknown> | undefined) ?? null
}
