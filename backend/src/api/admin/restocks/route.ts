import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RESTOCK_MODULE } from "../../../modules/restock"
import type RestockModuleService from "../../../modules/restock/service"
import { AdminListRestocks } from "./validators"
import {
  buildCursorPage,
  decodeCursor,
  parseLimit,
} from "../_utils/pagination"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)

  const query = AdminListRestocks.parse(req.query)

  const limit = parseLimit(query.limit)
  const skip = decodeCursor(query.cursor)
  const filters: Record<string, unknown> = {}

  if (query.shop_id) {
    filters.shop_id = query.shop_id
  }

  if (query.variant_id) {
    filters.variant_id = query.variant_id
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
  const service: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)

  const restock = await service.createRestocks(
    req.validatedBody as Record<string, unknown>
  )

  res.status(200).json({ restock })
}
