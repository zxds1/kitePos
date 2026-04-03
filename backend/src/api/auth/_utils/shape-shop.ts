import type { ShopUserRecord } from "./shop-users"
import { shapeShopUser } from "./shop-users"

export function shapeShop(shop: Record<string, unknown>) {
  const rawIndustryTypes =
    shop.industry_types &&
    typeof shop.industry_types === "object" &&
    Array.isArray((shop.industry_types as Record<string, unknown>).values)
      ? ((shop.industry_types as Record<string, unknown>).values as unknown[])
      : Array.isArray(shop.industry_types)
        ? (shop.industry_types as unknown[])
        : []

  const industryTypes = rawIndustryTypes.length > 0
    ? rawIndustryTypes
        .map((entry) => entry?.toString())
        .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [shop.shop_type?.toString() ?? "retail_duka"]

  return {
    id: shop.id,
    shop_name: shop.shop_name,
    shop_type: shop.shop_type ?? "retail_duka",
    industry_types: industryTypes,
    industry_features: shop.industry_features ?? null,
    owner_name: shop.owner_name,
    region_code: shop.region_code,
    ward_code: shop.ward_code,
    address: shop.address,
    business_license: shop.business_license,
    profile_image_url: shop.profile_image_url,
    is_supplier: shop.is_supplier === true,
    supplier_verified: shop.supplier_verified === true,
    supplier_categories: shop.supplier_categories ?? [],
    supplier_description: shop.supplier_description ?? null,
    years_in_business: shop.years_in_business ?? null,
    delivery_options: shop.delivery_options ?? null,
    return_policy: shop.return_policy ?? null,
    b2b_return_policy: shop.b2b_return_policy ?? null,
    online_return_policy: shop.online_return_policy ?? null,
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
