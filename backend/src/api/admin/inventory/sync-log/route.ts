import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../modules/sale-snapshot/service"
import { AdminGetSyncLogParams } from "./validator"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )
  const validated = AdminGetSyncLogParams.parse(req.query)

  const filters: Record<string, unknown> = {}

  if (validated.shop_id) {
    filters.shop_id = validated.shop_id
  }

  if (validated.variant_id) {
    filters.variant_id = validated.variant_id
  }

  if (validated.status) {
    filters.sync_status = validated.status
  }

  if (validated.start_date || validated.end_date) {
    filters.timestamp = {
      ...(validated.start_date ? { $gte: validated.start_date } : {}),
      ...(validated.end_date ? { $lte: validated.end_date } : {}),
    }
  }

  const [sync_log, count] = await saleSnapshotService.listAndCountSaleSnapshots(
    filters,
    {
      skip: validated.offset,
      take: validated.limit,
      order: {
        timestamp: "DESC",
      },
    }
  )

  res.status(200).json({
    sync_log,
    count,
    limit: validated.limit,
    offset: validated.offset,
  })
}
