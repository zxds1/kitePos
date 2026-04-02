import type { ShopUserRecord } from "./shop-users"
import { shapeShopUser } from "./shop-users"

export function shapeShop(shop: Record<string, unknown>) {
  return {
    id: shop.id,
    shop_name: shop.shop_name,
    owner_name: shop.owner_name,
    region_code: shop.region_code,
    ward_code: shop.ward_code,
    address: shop.address,
    business_license: shop.business_license,
    category: shop.category,
    consent_given: shop.consent_given,
    consent_timestamp: shop.consent_timestamp,
    consent_version: shop.consent_version,
    is_active: shop.is_active,
    mpesa_phone: shop.mpesa_phone,
    mpesa_till: shop.mpesa_till,
    mpesa_paybill: shop.mpesa_paybill,
    accept_mpesa: shop.accept_mpesa,
    mpesa_display_name: shop.mpesa_display_name,
  }
}

export function shapeShopResponse(
  shop: Record<string, unknown>,
  locations: unknown[],
  currentUser?: ShopUserRecord | null
) {
  return {
    ...shapeShop(shop),
    locations,
    current_user: currentUser ? shapeShopUser(currentUser) : null,
  }
}
