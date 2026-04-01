import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SALE_SNAPSHOT_MODULE } from "../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../modules/sale-snapshot/service"
import { AdminListSaleSnapshots } from "./validators"
import {
  buildCursorPage,
  decodeCursor,
  parseLimit,
} from "../_utils/pagination"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )

  const query = AdminListSaleSnapshots.parse(req.query)

  const limit = parseLimit(query.limit)
  const skip = decodeCursor(query.cursor)
  const filters: Record<string, unknown> = {}

  if (query.shop_id) {
    filters.shop_id = query.shop_id
  }

  if (query.variant_id) {
    filters.variant_id = query.variant_id
  }

  if (query.order_id) {
    filters.order_id = query.order_id
  }

  if (query.line_item_id) {
    filters.line_item_id = query.line_item_id
  }

  if (query.from || query.to) {
    filters.timestamp = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    }
  }

  const [sale_snapshots, count] = await service.listAndCountSaleSnapshots(
    filters,
    {
      take: limit,
      skip,
      order: {
        timestamp: "DESC",
      },
    }
  )

  res.json({
    sale_snapshots,
    ...buildCursorPage(count, limit, skip),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const service: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )

  const body = req.validatedBody as {
    order_id: string
    line_item_id: string
  }

  const [existingSnapshot] = await service.listSaleSnapshots(
    {
      order_id: body.order_id,
      line_item_id: body.line_item_id,
    },
    {
      take: 1,
      order: {
        timestamp: "DESC",
      },
    }
  )

  if (existingSnapshot) {
    res.status(200).json({
      sale_snapshot: existingSnapshot,
      idempotent: true,
    })
    return
  }

  const sale_snapshot = await service.createSaleSnapshots(
    req.validatedBody as Record<string, unknown>
  )

  res.status(200).json({
    sale_snapshot,
    idempotent: false,
  })
}
