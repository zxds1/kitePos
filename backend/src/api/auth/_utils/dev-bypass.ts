import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { SHOP_LOCATION_MODULE } from "../../../modules/shop-location"
import type ShopLocationModuleService from "../../../modules/shop-location/service"
import { SHOP_USER_MODULE } from "../../../modules/shop-user"
import type ShopUserModuleService from "../../../modules/shop-user/service"
import { hashPhone, hashPin, hashSecret, normalizeKenyanPhone } from "../../../utils/hash"
import { listShopLocations } from "../../pos/_utils/shop-locations"

type ShopRecord = Record<string, unknown>
type ShopUserRecord = Record<string, unknown>

type DevAuthBootstrapResult = {
  shop: ShopRecord
  user: ShopUserRecord
  locations: Awaited<ReturnType<typeof listShopLocations>>
}

function getAllowedPhones(): Set<string> {
  return new Set(
    (process.env.DEV_BYPASS_ALLOWED_PHONES ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => {
        try {
          return normalizeKenyanPhone(entry)
        } catch {
          return ""
        }
      })
      .filter((entry) => entry.length > 0)
  )
}

export function isDevAuthBypassEnabled() {
  return process.env.ENABLE_DEV_AUTH_BYPASS === "true"
}

export function isAllowedDevBypassPhone(phoneNumber: string) {
  return isDevAuthBypassEnabled() && getAllowedPhones().has(phoneNumber)
}

export function getDevBypassPin() {
  return process.env.DEV_BYPASS_PIN || "1234"
}

export function getDevBypassOtp() {
  return process.env.DEV_OTP_CODE || "1234"
}

function devShopId(phoneNumber: string) {
  return `shop_dev_${phoneNumber.slice(-8)}`
}

function devUserId(phoneNumber: string) {
  return `user_dev_${phoneNumber.slice(-8)}`
}

function devLocationId(phoneNumber: string) {
  return `loc_dev_${phoneNumber.slice(-8)}`
}

function defaultShopName(phoneNumber: string) {
  return process.env.DEV_DEMO_SHOP_NAME || `Storflo Demo ${phoneNumber.slice(-4)}`
}

function defaultOwnerName() {
  return process.env.DEV_DEMO_OWNER_NAME || "Storflo Developer"
}

function defaultRegion() {
  return process.env.DEV_DEMO_REGION || "nairobi"
}

function defaultWard() {
  return process.env.DEV_DEMO_WARD || "westlands"
}

function defaultAddress() {
  return process.env.DEV_DEMO_ADDRESS || "Westlands, Nairobi"
}

function defaultBranchName() {
  return process.env.DEV_DEMO_BRANCH_NAME || "Main Branch"
}

function defaultBranchCode() {
  return process.env.DEV_DEMO_BRANCH_CODE || "main"
}

async function findShopByOwnerPhoneHash(
  shopService: ShopModuleService,
  ownerPhoneHash: string
): Promise<ShopRecord | null> {
  const [shops] = await shopService.listAndCountShops(
    { owner_phone_hash: ownerPhoneHash, is_active: true },
    {
      take: 1,
      order: { created_at: "ASC" },
    }
  )

  return (shops[0] as ShopRecord | undefined) ?? null
}

async function findUserByPhoneHash(
  shopUserService: ShopUserModuleService,
  phoneHash: string
): Promise<ShopUserRecord | null> {
  const [users] = await shopUserService.listAndCountShopUsers(
    { phone_hash: phoneHash, is_active: true },
    {
      take: 1,
      order: { created_at: "ASC" },
    }
  )

  return (users[0] as ShopUserRecord | undefined) ?? null
}

export async function ensureDevBypassAuthRecords(
  container: MedusaContainer,
  {
    phoneNumber,
    deviceId,
    pin,
  }: {
    phoneNumber: string
    deviceId: string
    pin?: string
  }
): Promise<DevAuthBootstrapResult | null> {
  if (!isAllowedDevBypassPhone(phoneNumber)) {
    return null
  }

  if (typeof pin === "string" && pin !== getDevBypassPin()) {
    return null
  }

  const shopService = container.resolve<ShopModuleService>(SHOP_MODULE)
  const shopUserService = container.resolve<ShopUserModuleService>(SHOP_USER_MODULE)
  const shopLocationService = container.resolve<ShopLocationModuleService>(SHOP_LOCATION_MODULE)

  const phoneHash = hashPhone(phoneNumber)
  const pinHash = hashPin(pin ?? getDevBypassPin())
  const deviceHash = hashSecret(deviceId, "device")

  let shop = await findShopByOwnerPhoneHash(shopService, phoneHash)
  let user = await findUserByPhoneHash(shopUserService, phoneHash)

  if (!shop && user?.shop_id) {
    const [shops] = await shopService.listAndCountShops(
      { id: String(user.shop_id) },
      { take: 1 }
    )
    shop = (shops[0] as ShopRecord | undefined) ?? null
  }

  if (!shop) {
    shop = (await shopService.createShops({
      id: devShopId(phoneNumber),
      shop_name: defaultShopName(phoneNumber),
      owner_phone_hash: phoneHash,
      owner_name: defaultOwnerName(),
      shop_type: "retail_duka",
      industry_types: { values: ["retail_duka"] },
      industry_features: {},
      region_code: defaultRegion(),
      ward_code: defaultWard(),
      category: "general",
      address: defaultAddress(),
      consent_given: true,
      consent_timestamp: new Date(),
      consent_version: "dev-bypass",
      data_sharing_consent: true,
      analytics_consent: true,
      is_active: true,
      accept_mpesa: true,
      mpesa_phone: phoneNumber,
      mpesa_display_name: defaultShopName(phoneNumber),
      invoice_prefix: "DEV",
      invoice_number_sequence: 1,
    } as unknown as Record<string, unknown>)) as ShopRecord
  } else {
    shop = (await shopService.updateShops({
      id: String(shop.id),
      owner_phone_hash: phoneHash,
      owner_name: shop.owner_name ?? defaultOwnerName(),
      shop_name: shop.shop_name ?? defaultShopName(phoneNumber),
      region_code: shop.region_code ?? defaultRegion(),
      ward_code: shop.ward_code ?? defaultWard(),
      address: shop.address ?? defaultAddress(),
      consent_given: true,
      consent_timestamp: shop.consent_timestamp ?? new Date(),
      consent_version: shop.consent_version ?? "dev-bypass",
      data_sharing_consent: shop.data_sharing_consent ?? true,
      analytics_consent: shop.analytics_consent ?? true,
      is_active: true,
      accept_mpesa: shop.accept_mpesa ?? true,
      mpesa_phone: shop.mpesa_phone ?? phoneNumber,
      mpesa_display_name: shop.mpesa_display_name ?? defaultShopName(phoneNumber),
    } as unknown as Record<string, unknown>)) as ShopRecord
  }

  const shopId = String(shop.id)

  let locations = await listShopLocations(container, shopId)
  if (locations.length === 0) {
    await shopLocationService.createShopLocations({
      id: devLocationId(phoneNumber),
      shop_id: shopId,
      name: defaultBranchName(),
      code: defaultBranchCode(),
      address: shop.address ?? defaultAddress(),
      location_type: "physical",
      is_default: true,
      is_active: true,
      metadata: {
        source: "dev_bypass",
      },
    } as unknown as Record<string, unknown>)
    locations = await listShopLocations(container, shopId)
  }

  if (!user) {
    user = (await shopUserService.createShopUsers({
      id: devUserId(phoneNumber),
      shop_id: shopId,
      phone_hash: phoneHash,
      pin_hash: pinHash,
      full_name: defaultOwnerName(),
      role: "owner",
      assigned_location_ids: [],
      assigned_terminal_ids: [],
      must_change_pin: false,
      device_hash: deviceHash,
      is_active: true,
      pin_updated_at: new Date(),
      last_login_at: new Date(),
    } as unknown as Record<string, unknown>)) as ShopUserRecord
  } else {
    user = (await shopUserService.updateShopUsers({
      id: String(user.id),
      shop_id: shopId,
      pin_hash: pinHash,
      full_name: user.full_name ?? defaultOwnerName(),
      role: user.role ?? "owner",
      assigned_location_ids: Array.isArray(user.assigned_location_ids)
        ? user.assigned_location_ids
        : [],
      assigned_terminal_ids: Array.isArray(user.assigned_terminal_ids)
        ? user.assigned_terminal_ids
        : [],
      must_change_pin: false,
      device_hash: deviceHash,
      is_active: true,
      pin_updated_at: new Date(),
      last_login_at: new Date(),
    } as unknown as Record<string, unknown>)) as ShopUserRecord
  }

  return {
    shop,
    user,
    locations,
  }
}

export function buildDevOtpChallengeRecord(phoneNumber: string) {
  return {
    id: `otp_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    phone_hash: hashPhone(phoneNumber),
    otp_hash: null,
  }
}
