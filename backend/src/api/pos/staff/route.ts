import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../auth/_utils/jwt"
import {
  generateNumericCode,
  hashPhone,
  hashPin,
  hashSecret,
  normalizeKenyanPhone,
} from "../../../utils/hash"
import { SHOP_USER_MODULE } from "../../../modules/shop-user"
import type ShopUserModuleService from "../../../modules/shop-user/service"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import {
  canManageStaff,
  listActiveShopUsers,
  normalizeAssignedLocationIds,
  normalizeAssignedTerminalIds,
  shapeShopUser,
  type PosRole,
} from "../../auth/_utils/shop-users"
import { listShopLocations } from "../_utils/shop-locations"
import { listShopTerminals } from "../_utils/terminals"
import { recordAuditLog } from "../_utils/audit"

const StaffInputSchema = z.object({
  phone_number: z.string().min(1),
  full_name: z.string().trim().min(1).optional(),
  role: z.enum(["owner", "admin", "branch_manager", "cashier"]).default("cashier"),
  pin: z.string().regex(/^[0-9]{4,8}$/).optional(),
  assigned_location_ids: z.array(z.string().min(1)).optional().default([]),
  assigned_terminal_ids: z.array(z.string().min(1)).optional().default([]),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageStaff(auth.role)) {
    res.status(403).json({
      success: false,
      message: "Only owner or admin can view staff management",
    })
    return
  }

  const [users, locations] = await Promise.all([
    listActiveShopUsers(req.scope, auth.shop_id),
    listShopLocations(req.scope, auth.shop_id),
  ])

  res.status(200).json({
    success: true,
    staff: users.map(shapeShopUser),
    locations: locations.map((location) => ({
      id: location.id,
      name: location.name,
      code: location.code,
      is_default: location.is_default ?? false,
      location_type: location.location_type ?? "physical",
    })),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageStaff(auth.role)) {
    res.status(403).json({
      success: false,
      message: "Only owner or admin can add staff",
    })
    return
  }

  const parsed = StaffInputSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request format",
      errors: parsed.error.flatten(),
    })
    return
  }

  let normalizedPhone: string
  try {
    normalizedPhone = normalizeKenyanPhone(parsed.data.phone_number)
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Phone must be a valid Kenyan number",
    })
    return
  }

  const locationIds = normalizeAssignedLocationIds(parsed.data.assigned_location_ids)
  const terminalIds = normalizeAssignedTerminalIds(parsed.data.assigned_terminal_ids)
  const locations = await listShopLocations(req.scope, auth.shop_id)
  const locationSet = new Set(locations.map((location) => location.id))
  const invalidLocationId = locationIds.find((locationId) => !locationSet.has(locationId))
  if (invalidLocationId) {
    res.status(400).json({
      success: false,
      message: `Unknown branch assignment: ${invalidLocationId}`,
    })
    return
  }
  const terminals = await listShopTerminals(req.scope, auth.shop_id)
  const invalidTerminalId = terminalIds.find((terminalId) => {
    const terminal = terminals.find((entry) => entry.id === terminalId)
    if (!terminal) {
      return true
    }
    if (locationIds.length === 0) {
      return false
    }
    return !locationIds.includes(terminal.location_id)
  })
  if (invalidTerminalId) {
    res.status(400).json({
      success: false,
      message: `Unknown or invalid checkout assignment: ${invalidTerminalId}`,
    })
    return
  }

  const users = await listActiveShopUsers(req.scope, auth.shop_id)
  const phoneHash = hashPhone(normalizedPhone)
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const [shopMatches] = await shopService.listAndCountShops(
    { owner_phone_hash: phoneHash },
    { take: 2 }
  )
  const crossShopOwner = shopMatches.find(
    (shop) => (shop as Record<string, unknown>).id !== auth.shop_id
  )
  if (crossShopOwner) {
    res.status(409).json({
      success: false,
      message: "That phone number already owns another shop",
    })
    return
  }

  const existingGlobalUser = await req.scope
    .resolve<ShopUserModuleService>(SHOP_USER_MODULE)
    .listShopUsers({
      phone_hash: phoneHash,
      is_active: true,
    })
  const crossShopUser = existingGlobalUser.find(
    (user) => (user as Record<string, unknown>).shop_id !== auth.shop_id
  )
  if (crossShopUser) {
    res.status(409).json({
      success: false,
      message: "That phone number is already assigned to another shop",
    })
    return
  }
  const existing = users.find((user) => user.phone_hash === phoneHash)
  if (existing) {
    res.status(409).json({
      success: false,
      message: "That phone number is already assigned to this shop",
    })
    return
  }

  const recoveryCode = generateNumericCode(6)
  const created = await req.scope
    .resolve<ShopUserModuleService>(SHOP_USER_MODULE)
    .createShopUsers({
      id: `user_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      shop_id: auth.shop_id,
      phone_hash: phoneHash,
      pin_hash: parsed.data.pin ? hashPin(parsed.data.pin) : null,
      full_name: parsed.data.full_name ?? null,
      role: parsed.data.role as PosRole,
      assigned_location_ids: locationIds,
      assigned_terminal_ids: terminalIds,
      must_change_pin: parsed.data.pin != null,
      invite_code_hash: null,
      invite_expires_at: null,
      recovery_code_hash: hashSecret(recoveryCode, "recovery"),
      recovery_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      device_hash: null,
      is_active: true,
      pin_updated_at: parsed.data.pin ? new Date() : null,
      last_login_at: null,
    } as unknown as Record<string, unknown>)

  await recordAuditLog(req.scope, {
    shop_id: auth.shop_id,
    actor_user_id: auth.user_id ?? null,
    actor_role: auth.role ?? null,
    action: "staff.created",
    entity_type: "shop_user",
    entity_id: String((created as Record<string, unknown>).id),
    metadata: {
      role: parsed.data.role,
      assigned_location_ids: locationIds,
      assigned_terminal_ids: terminalIds,
    },
  })

  res.status(201).json({
    success: true,
    staff_user: {
      ...shapeShopUser(created as never),
      phone_number: normalizedPhone,
    },
    recovery_code: recoveryCode,
  })
}
