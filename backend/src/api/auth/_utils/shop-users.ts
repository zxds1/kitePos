import type { MedusaContainer } from "@medusajs/framework/types"
import { SHOP_USER_MODULE } from "../../../modules/shop-user"
import type ShopUserModuleService from "../../../modules/shop-user/service"
import type { PosAuthTokenPayload } from "./jwt"

export const POS_ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "cashier",
] as const

export type PosRole = (typeof POS_ROLES)[number]

export type ShopUserRecord = {
  id: string
  shop_id: string
  phone_hash: string
  full_name?: string | null
  profile_image_url?: string | null
  role?: PosRole | null
  assigned_location_ids?: unknown
  assigned_terminal_ids?: unknown
  is_active?: boolean | null
  pin_hash?: string | null
  must_change_pin?: boolean | null
  device_hash?: string | null
  invite_expires_at?: Date | string | null
  recovery_expires_at?: Date | string | null
  last_login_at?: Date | string | null
}

function serviceFrom(container: MedusaContainer) {
  return container.resolve<ShopUserModuleService>(SHOP_USER_MODULE)
}

export function normalizeAssignedLocationIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
}

export function normalizeAssignedTerminalIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
}

export function roleHasGlobalBranchAccess(role?: string | null) {
  return role === "owner" || role === "admin"
}

export function isOwnerRole(role?: string | null) {
  return role === "owner"
}

export function canManageBranches(role?: string | null) {
  return role === "owner" || role === "admin"
}

export function canManageStaff(role?: string | null) {
  return role === "owner" || role === "admin"
}

export function canUseLocation(
  auth: Pick<PosAuthTokenPayload, "role" | "assigned_location_ids">,
  locationId?: string | null
) {
  if (!locationId) {
    return roleHasGlobalBranchAccess(auth.role)
  }

  if (roleHasGlobalBranchAccess(auth.role)) {
    return true
  }

  return normalizeAssignedLocationIds(auth.assigned_location_ids).includes(
    locationId
  )
}

export function shapeShopUser(user: ShopUserRecord) {
  return {
    id: user.id,
    shop_id: user.shop_id,
    full_name: user.full_name ?? null,
    profile_image_url: user.profile_image_url ?? null,
    role: user.role ?? "cashier",
    assigned_location_ids: normalizeAssignedLocationIds(
      user.assigned_location_ids
    ),
    assigned_terminal_ids: normalizeAssignedTerminalIds(
      user.assigned_terminal_ids
    ),
    is_active: user.is_active !== false,
    has_pin: typeof user.pin_hash === "string" && user.pin_hash.length > 0,
    must_change_pin: user.must_change_pin === true,
    is_device_bound: typeof user.device_hash === "string" && user.device_hash.length > 0,
    last_login_at: user.last_login_at ?? null,
  }
}

export async function findActiveShopUserByPhoneHash(
  container: MedusaContainer,
  phoneHash: string
): Promise<ShopUserRecord | null> {
  const service = serviceFrom(container)
  const [users] = await service.listAndCountShopUsers(
    {
      phone_hash: phoneHash,
      is_active: true,
    },
    {
      take: 1,
      order: { created_at: "ASC" },
    }
  )

  return (users[0] as ShopUserRecord | undefined) ?? null
}

export async function listActiveShopUsers(
  container: MedusaContainer,
  shopId: string
): Promise<ShopUserRecord[]> {
  const service = serviceFrom(container)
  const [users] = await service.listAndCountShopUsers(
    { shop_id: shopId, is_active: true },
    {
      take: 200,
      order: { created_at: "ASC" },
    }
  )

  return users as ShopUserRecord[]
}

export async function createShopUser(
  container: MedusaContainer,
  data: Record<string, unknown>
) {
  return serviceFrom(container).createShopUsers(data)
}

export async function updateShopUser(
  container: MedusaContainer,
  data: Record<string, unknown>
) {
  return serviceFrom(container).updateShopUsers(data)
}
