import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../auth/_utils/jwt"
import {
  canManageStaff,
  normalizeAssignedLocationIds,
  normalizeAssignedTerminalIds,
  shapeShopUser,
} from "../../../auth/_utils/shop-users"
import { listShopLocations } from "../../_utils/shop-locations"
import { SHOP_USER_MODULE } from "../../../../modules/shop-user"
import type ShopUserModuleService from "../../../../modules/shop-user/service"
import { generateNumericCode, hashPin, hashSecret } from "../../../../utils/hash"
import { listShopTerminals } from "../../_utils/terminals"
import { recordAuditLog } from "../../_utils/audit"

const UpdateStaffSchema = z.object({
  full_name: z.string().trim().min(1).nullable().optional(),
  role: z.enum(["owner", "admin", "branch_manager", "cashier"]).optional(),
  pin: z.string().regex(/^[0-9]{4,8}$/).nullable().optional(),
  assigned_location_ids: z.array(z.string().min(1)).optional(),
  assigned_terminal_ids: z.array(z.string().min(1)).optional(),
  reset_device_binding: z.boolean().optional(),
  regenerate_recovery_code: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageStaff(auth.role)) {
    res.status(403).json({
      success: false,
      message: "Only owner or admin can update staff",
    })
    return
  }

  const staffUserId = req.params.id
  if (!staffUserId) {
    res.status(400).json({
      success: false,
      message: "Staff user id is required",
    })
    return
  }

  const parsed = UpdateStaffSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request format",
      errors: parsed.error.flatten(),
    })
    return
  }

  const service: ShopUserModuleService = req.scope.resolve(SHOP_USER_MODULE)
  const [users] = await service.listAndCountShopUsers(
    { shop_id: auth.shop_id },
    {
      take: 200,
      order: { created_at: "ASC" },
    }
  )
  const existing = users.find((user) => user.id === staffUserId)
  if (!existing) {
    res.status(404).json({
      success: false,
      message: "Staff user not found",
    })
    return
  }

  if (existing.id === auth.user_id && parsed.data.is_active === false) {
    res.status(400).json({
      success: false,
      message: "You cannot deactivate your own account from this screen",
    })
    return
  }

  const nextLocationIds =
    parsed.data.assigned_location_ids != null
      ? normalizeAssignedLocationIds(parsed.data.assigned_location_ids)
      : normalizeAssignedLocationIds(existing.assigned_location_ids)
  const nextTerminalIds =
    parsed.data.assigned_terminal_ids != null
      ? normalizeAssignedTerminalIds(parsed.data.assigned_terminal_ids)
      : normalizeAssignedTerminalIds(existing.assigned_terminal_ids)

  const locations = await listShopLocations(req.scope, auth.shop_id)
  const locationSet = new Set(locations.map((location) => location.id))
  const invalidLocationId = nextLocationIds.find((locationId) => !locationSet.has(locationId))
  if (invalidLocationId) {
    res.status(400).json({
      success: false,
      message: `Unknown branch assignment: ${invalidLocationId}`,
    })
    return
  }
  const terminals = await listShopTerminals(req.scope, auth.shop_id)
  const invalidTerminalId = nextTerminalIds.find((terminalId) => {
    const terminal = terminals.find((entry) => entry.id === terminalId)
    if (!terminal) {
      return true
    }
    if (nextLocationIds.length === 0) {
      return false
    }
    return !nextLocationIds.includes(terminal.location_id)
  })
  if (invalidTerminalId) {
    res.status(400).json({
      success: false,
      message: `Unknown or invalid checkout assignment: ${invalidTerminalId}`,
    })
    return
  }

  const recoveryCode =
    parsed.data.regenerate_recovery_code == true ||
    ((parsed.data.pin?.length ?? 0) > 0)
      ? generateNumericCode(6)
      : null
  const updated = await service.updateShopUsers({
    id: staffUserId,
    full_name:
      parsed.data.full_name !== undefined ? parsed.data.full_name : existing.full_name ?? null,
    role: parsed.data.role ?? existing.role ?? "cashier",
    assigned_location_ids: nextLocationIds,
    assigned_terminal_ids: nextTerminalIds,
    is_active: parsed.data.is_active ?? (existing.is_active !== false),
    ...(parsed.data.reset_device_binding == true ? {
      device_hash: null,
    } : {}),
    ...(parsed.data.pin != null
      ? {
          pin_hash: parsed.data.pin.length === 0 ? null : hashPin(parsed.data.pin),
          pin_updated_at: new Date(),
          must_change_pin: parsed.data.pin.length > 0,
          device_hash: null,
        }
      : {}),
    ...(recoveryCode != null
      ? {
          recovery_code_hash: hashSecret(recoveryCode, "recovery"),
          recovery_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        }
      : {}),
  } as unknown as Record<string, unknown>)

  await recordAuditLog(req.scope, {
    shop_id: auth.shop_id,
    actor_user_id: auth.user_id ?? null,
    actor_role: auth.role ?? null,
    action: "staff.updated",
    entity_type: "shop_user",
    entity_id: staffUserId,
    metadata: {
      role: parsed.data.role ?? existing.role ?? "cashier",
      assigned_location_ids: nextLocationIds,
      assigned_terminal_ids: nextTerminalIds,
      is_active: parsed.data.is_active ?? (existing.is_active !== false),
      reset_device_binding: parsed.data.reset_device_binding == true,
    },
  })

  res.status(200).json({
    success: true,
    staff_user: shapeShopUser(updated as never),
    recovery_code: recoveryCode,
  })
}
