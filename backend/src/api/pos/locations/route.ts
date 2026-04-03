import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { SHOP_LOCATION_MODULE } from "../../../modules/shop-location"
import type ShopLocationModuleService from "../../../modules/shop-location/service"
import { listShopLocations, shapeShopLocation } from "../_utils/shop-locations"
import {
  canManageBranches,
  canUseLocation,
} from "../../auth/_utils/shop-users"
import { recordAuditLog } from "../_utils/audit"
import {
  mergeIndustryFeatures,
  validateIndustryTypes,
} from "../../../utils/catalog-config"

const IndustryTypeSchema = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/,
    "Industry type must be a lowercase slug"
  )

const CreateLocationSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  location_type: z.enum(["physical", "online", "shared"]).default("physical"),
  is_default: z.boolean().optional().default(false),
  industry_types: z.array(IndustryTypeSchema).min(1).optional(),
  industry_features: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const locations = await listShopLocations(req.scope, auth.shop_id)
  res.status(200).json({
    locations: locations
      .filter((location) => canUseLocation(auth, location.id))
      .map(shapeShopLocation),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageBranches(auth.role)) {
    res.status(403).json({
      success: false,
      message: "Only owner or admin can create branches",
    })
    return
  }

  const parsed = CreateLocationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request format",
      errors: parsed.error.flatten(),
    })
    return
  }

  const service: ShopLocationModuleService = req.scope.resolve(SHOP_LOCATION_MODULE)
  const body = parsed.data
  const requestedIndustryTypes = body.industry_types ?? []
  const { normalized: normalizedIndustryTypes, unknown } =
    validateIndustryTypes(requestedIndustryTypes)

  if (unknown.length > 0) {
    res.status(400).json({
      success: false,
      message: "Unknown industry types provided",
      unknown_industry_types: unknown,
    })
    return
  }

  if (body.is_default) {
    const [existingLocations] = await service.listAndCountShopLocations(
      { shop_id: auth.shop_id, is_default: true },
      { take: 100 }
    )
    for (const location of existingLocations) {
      await service.updateShopLocations({
        id: location.id,
        is_default: false,
      } as unknown as Record<string, unknown>)
    }
  }

  const created = await service.createShopLocations({
    id: `loc_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_id: auth.shop_id,
    name: body.name,
    code: body.code,
    address: body.address ?? null,
    location_type: body.location_type,
    is_default: body.is_default,
    is_active: true,
    metadata:
      normalizedIndustryTypes.length > 0 || body.industry_features != null
        ? {
            industry_types: normalizedIndustryTypes,
            industry_features: {
              ...mergeIndustryFeatures(normalizedIndustryTypes),
              ...(body.industry_features ?? {}),
            },
          }
        : null,
  } as unknown as Record<string, unknown>)

  await recordAuditLog(req.scope, {
    shop_id: auth.shop_id,
    actor_user_id: auth.user_id ?? null,
    actor_role: auth.role ?? null,
    action: "location.created",
    entity_type: "location",
    entity_id: String((created as Record<string, unknown>).id),
    location_id: String((created as Record<string, unknown>).id),
    metadata: {
      name: body.name,
      code: body.code,
      location_type: body.location_type,
      is_default: body.is_default,
    },
  })

  res.status(201).json({
    success: true,
    location: shapeShopLocation(created as never),
  })
}
