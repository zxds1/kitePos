import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../auth/_utils/jwt"
import { RESTOCK_MODULE } from "../../../modules/restock"
import type RestockModuleService from "../../../modules/restock/service"
import { AdminListRestocks } from "./validators"
import {
  buildCursorPage,
  decodeCursor,
  parseLimit,
} from "../_utils/pagination"
import { syncAggregateInventoryLevelForVariant } from "../products/_utils"
import { canUseLocation } from "../../auth/_utils/shop-users"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const service: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)

  const query = AdminListRestocks.parse(req.query)

  const limit = parseLimit(query.limit)
  const skip = decodeCursor(query.cursor)
  const filters: Record<string, unknown> = {}

  filters.shop_id = query.shop_id ?? auth.shop_id

  if (filters.shop_id !== auth.shop_id) {
    res.status(403).json({
      success: false,
      message: "Shop access denied",
    })
    return
  }

  if (query.variant_id) {
    filters.variant_id = query.variant_id
  }

  if (query.location_id) {
    if (!canUseLocation(auth, query.location_id)) {
      res.status(403).json({
        success: false,
        message: "Location access denied",
      })
      return
    }
    filters.location_id = query.location_id
  }

  if (query.source) {
    filters.source = query.source
  }

  if (query.from || query.to) {
    filters.timestamp = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    }
  }

  const [restocks, count] = await service.listAndCountRestocks(filters, {
    take: limit,
    skip,
    order: {
      timestamp: "DESC",
    },
  })

  res.json({
    restocks,
    ...buildCursorPage(count, limit, skip),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const payload = req.validatedBody as Record<string, unknown>
  const shopId = typeof payload["shop_id"] === "string" ? payload["shop_id"] : null
  const locationId =
    typeof payload["location_id"] === "string" ? payload["location_id"] : null

  if (!shopId || shopId !== auth.shop_id) {
    res.status(403).json({ success: false, message: "Shop access denied" })
    return
  }

  if (locationId && !canUseLocation(auth, locationId)) {
    res.status(403).json({ success: false, message: "Location access denied" })
    return
  }

  const service: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)

  const restock = await service.createRestocks(
    payload
  )

  const variantId =
    typeof payload["variant_id"] === "string" ? payload["variant_id"] : null

  if (shopId && variantId) {
    await syncAggregateInventoryLevelForVariant(req, shopId, variantId)
  }

  res.status(200).json({ restock })
}
