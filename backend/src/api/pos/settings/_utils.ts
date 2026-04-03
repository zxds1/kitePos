import type ShopModuleService from "../../../modules/shop/service"
import type { ShopUserRecord } from "../../auth/_utils/shop-users"
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
    profile_image_url: shop.profile_image_url,
    category: shop.category,
    created_at: shop.created_at,
    updated_at: shop.updated_at,
  }
}

export function shapeViewerProfile(
  user: ShopUserRecord | null | undefined,
  auth?: PosAuthTokenPayload | null
) {
  return {
    id: user?.id ?? auth?.user_id ?? null,
    full_name: user?.full_name ?? null,
    phone_number: auth?.phone_number ?? null,
    role: user?.role ?? auth?.role ?? "cashier",
    profile_image_url: user?.profile_image_url ?? null,
    assigned_location_ids:
      Array.isArray(user?.assigned_location_ids)
        ? user!.assigned_location_ids
        : auth?.assigned_location_ids ?? [],
    assigned_terminal_ids:
      Array.isArray(user?.assigned_terminal_ids)
        ? user!.assigned_terminal_ids
        : auth?.assigned_terminal_ids ?? [],
    can_manage_shop_profile:
      auth?.role === "owner" || auth?.role === "admin",
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

export function shapeTaxSettings(shop: Record<string, unknown>) {
  return {
    shop_id: shop.id,
    shop_name: shop.shop_name,
    kra_pin: shop.kra_pin ?? null,
    vat_registered: shop.vat_registered === true,
    vat_registration_number: shop.vat_registration_number ?? null,
    tax_type: shop.tax_type ?? "exempt",
    turnover_threshold: Number(shop.turnover_threshold ?? 0),
    tims_enabled: shop.tims_enabled === true,
    tims_device_id: shop.tims_device_id ?? null,
    etr_serial_number: shop.etr_serial_number ?? null,
    invoice_prefix: shop.invoice_prefix ?? "INV",
    invoice_number_sequence: Number(shop.invoice_number_sequence ?? 1),
    tax_invoice_enabled: shop.tax_invoice_enabled === true,
    whvat_applicable: shop.whvat_applicable === true,
    whvat_registration: shop.whvat_registration ?? null,
    tax_reporting_email: shop.tax_reporting_email ?? null,
    last_vat_return_filed: shop.last_vat_return_filed ?? null,
    last_vat_return_period: shop.last_vat_return_period ?? null,
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
