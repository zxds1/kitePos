import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADJUSTMENT_MODULE } from "../../../../modules/adjustment"
import type AdjustmentModuleService from "../../../../modules/adjustment/service"
import { numbersMatch } from "../_utils/stock"
import {
  AdminCreateAdjustment,
  AdminGetAdjustmentsParams,
} from "./validator"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const adjustmentService: AdjustmentModuleService = req.scope.resolve(
    ADJUSTMENT_MODULE
  )

  const validated = AdminCreateAdjustment.parse(req.validatedBody)

  if (
    !numbersMatch(
      validated.before_stock + validated.quantity_change,
      validated.after_stock
    )
  ) {
    res.status(400).json({
      message: "Stock math mismatch: before + change must equal after",
    })
    return
  }

  const adjustment = await adjustmentService.createAdjustments({
    ...validated,
    reference: validated.reference ?? null,
    evidence_url: validated.evidence_url ?? null,
    timestamp: new Date(),
  })

  res.status(201).json({ adjustment })
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const adjustmentService: AdjustmentModuleService = req.scope.resolve(
    ADJUSTMENT_MODULE
  )
  const validated = AdminGetAdjustmentsParams.parse(req.query)

  const filters: Record<string, unknown> = {}

  if (validated.shop_id) {
    filters.shop_id = validated.shop_id
  }

  if (validated.variant_id) {
    filters.variant_id = validated.variant_id
  }

  if (validated.adjustment_type) {
    filters.adjustment_type = validated.adjustment_type
  }

  if (validated.start_date || validated.end_date) {
    filters.timestamp = {
      ...(validated.start_date ? { $gte: validated.start_date } : {}),
      ...(validated.end_date ? { $lte: validated.end_date } : {}),
    }
  }

  const [adjustments, count] = await adjustmentService.listAndCountAdjustments(
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
    adjustments,
    count,
    limit: validated.limit,
    offset: validated.offset,
  })
}
