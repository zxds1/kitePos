import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_CONFIG_MODULE } from "../../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../../modules/inventory-config/service"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../modules/sale-snapshot/service"
import { numbersMatch } from "../_utils/stock"
import {
  isPostgresUniqueViolation,
  isRetryableSyncError,
} from "../../_utils/idempotency"
import {
  AdminBatchSalesRequest,
  type BatchSaleConflict,
  type BatchSaleResult,
  type BatchSalesResponse,
} from "./validator"
import { calculateDeduction, validateStock } from "../../../../utils/inventory-math"
import { calculateServerStock } from "../../../../utils/stock-calculator"
import type { InventoryType, SellingUnit } from "../../../../types/inventory"

async function findExistingOfflineSnapshot(
  saleSnapshotService: SaleSnapshotModuleService,
  shopId: string,
  variantId: string,
  offlineLineItemId: string
) {
  const [existingSnapshots] = await saleSnapshotService.listAndCountSaleSnapshots(
    {
      line_item_id: offlineLineItemId,
      shop_id: shopId,
      variant_id: variantId,
    },
    {
      take: 1,
    }
  )

  return existingSnapshots[0]
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse<BatchSalesResponse>
) {
  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )
  const inventoryConfigService: InventoryConfigModuleService =
    req.scope.resolve(INVENTORY_CONFIG_MODULE)

  const validated = AdminBatchSalesRequest.parse(req.validatedBody)

  const results: BatchSaleResult[] = []
  const paymentSummary = {
    cash_count: 0,
    mpesa_count: 0,
    mpesa_total: 0,
  }

  const stockCache = new Map<string, number>()

  for (const sale of validated.sales) {
    try {
      const offlineLineItemId = `offline-item:${sale.client_transaction_id}`

      const existingSnapshot = await findExistingOfflineSnapshot(
        saleSnapshotService,
        validated.shop_id,
        sale.variant_id,
        offlineLineItemId
      )

      if (existingSnapshot) {
        results.push({
          client_transaction_id: sale.client_transaction_id,
          status: "skipped_duplicate",
          snapshot_id: existingSnapshot.id,
        })
        continue
      }

      const [config] = await inventoryConfigService.listInventoryConfigs(
        { variant_id: sale.variant_id },
        {
          take: 1,
          order: {
            created_at: "DESC",
          },
        }
      )

      if (!config) {
        throw new Error(`Inventory config not found for variant ${sale.variant_id}`)
      }

      const expectedDeduction =
        calculateDeduction(
          config.inventory_type as InventoryType,
          sale.unit_sold,
          config.selling_units as unknown as SellingUnit[]
        ) * sale.quantity_sold

      if (!numbersMatch(expectedDeduction, sale.deduction_value)) {
        throw new Error(
          `Deduction mismatch for ${sale.client_transaction_id}: expected ${expectedDeduction}, got ${sale.deduction_value}`
        )
      }

      if (
        !numbersMatch(
          sale.stock_before - sale.deduction_value,
          sale.stock_after
        )
      ) {
        throw new Error(
          `Stock math mismatch for ${sale.client_transaction_id}: before - deduction must equal after`
        )
      }

      const stockCacheKey = `${validated.shop_id}:${sale.variant_id}`
      const serverStock =
        stockCache.get(stockCacheKey) ??
        (await calculateServerStock(req.scope, validated.shop_id, sale.variant_id))

      if (!validateStock(serverStock, sale.deduction_value)) {
        throw new Error(
          `Insufficient server stock for ${sale.client_transaction_id}`
        )
      }

      const stockDifference = Math.abs(serverStock - sale.stock_before)
      const conflictThreshold = Math.max(5, serverStock * 0.1)
      let syncStatus: "success" | "success_with_conflict" = "success"
      let conflict: BatchSaleConflict | undefined

      if (stockDifference > conflictThreshold) {
        syncStatus = "success_with_conflict"
        conflict = {
          type: "stock_mismatch",
          client_stock_before: sale.stock_before,
          server_stock_before: serverStock,
          difference: stockDifference,
          message: `Stock mismatch detected (${stockDifference} units). Server accepted sale but flagged it for review.`,
        }
      }

      let snapshot

      try {
        snapshot = await saleSnapshotService.createSaleSnapshots({
          client_transaction_id: sale.client_transaction_id,
          order_id: sale.order_id ?? `offline:${sale.client_transaction_id}`,
          line_item_id: offlineLineItemId,
          shop_id: validated.shop_id,
          variant_id: sale.variant_id,
          inventory_type: sale.inventory_type,
          unit_sold: sale.unit_sold,
          quantity_sold: sale.quantity_sold,
          conversion_factor_snapshot: sale.conversion_factor_snapshot,
          deduction_value: sale.deduction_value,
          stock_before: sale.stock_before,
          stock_after: sale.stock_after,
          price_charged: sale.price_charged,
          payment_method: sale.payment_method,
          mpesa_receipt_number: sale.mpesa_receipt_number ?? null,
          mpesa_customer_phone: sale.mpesa_customer_phone ?? null,
          amount_paid: sale.amount_paid ?? sale.price_charged,
          sync_status: syncStatus,
          sync_conflict: conflict ?? null,
          timestamp: sale.timestamp,
        })
      } catch (error) {
        if (!isPostgresUniqueViolation(error)) {
          throw error
        }

        const existingSnapshot = await findExistingOfflineSnapshot(
          saleSnapshotService,
          validated.shop_id,
          sale.variant_id,
          offlineLineItemId
        )

        if (!existingSnapshot) {
          throw error
        }

        results.push({
          client_transaction_id: sale.client_transaction_id,
          status: "skipped_duplicate",
          snapshot_id: existingSnapshot.id,
        })
        continue
      }

      stockCache.set(stockCacheKey, sale.stock_after)

      if (sale.payment_method === "cash") {
        paymentSummary.cash_count += 1
      }

      if (sale.payment_method === "mpesa") {
        paymentSummary.mpesa_count += 1
        paymentSummary.mpesa_total += sale.amount_paid ?? sale.price_charged
      }

      results.push({
        client_transaction_id: sale.client_transaction_id,
        status: syncStatus,
        snapshot_id: snapshot.id,
        conflict,
      })
    } catch (error) {
      results.push({
        client_transaction_id: sale.client_transaction_id,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        retry_after_seconds: isRetryableSyncError(error) ? 60 : null,
        is_retryable: isRetryableSyncError(error),
      })
    }
  }

  res.status(200).json({
    shop_id: validated.shop_id,
    processed: results.length,
    results,
    payment_summary: paymentSummary,
  })
}
