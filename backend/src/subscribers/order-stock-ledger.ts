import {
  type SubscriberArgs,
  type SubscriberConfig,
  ContainerRegistrationKeys,
} from "@medusajs/framework"
import { ADJUSTMENT_MODULE } from "../modules/adjustment"
import type AdjustmentModuleService from "../modules/adjustment/service"
import { INVENTORY_CONFIG_MODULE } from "../modules/inventory-config"
import type InventoryConfigModuleService from "../modules/inventory-config/service"
import { SALE_SNAPSHOT_MODULE } from "../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../modules/sale-snapshot/service"
import { calculateServerStock } from "../utils/stock-calculator"
import { getDefaultShopLocation } from "../api/pos/_utils/shop-locations"
import { syncAggregateInventoryLevelForVariant } from "../api/admin/products/_utils"
import type { InventoryType, SellingUnit } from "../types/inventory"
import { calculateDeduction } from "../utils/inventory-math"

type OrderItemRecord = {
  id: string
  quantity?: number | null
  unit_price?: number | null
  total?: number | null
  variant?: {
    id?: string | null
    product?: {
      metadata?: Record<string, unknown> | null
    } | null
  } | null
}

type OrderRecord = {
  id: string
  created_at?: string | Date | null
  display_id?: number | string | null
  total?: number | null
  metadata?: Record<string, unknown> | null
  items?: OrderItemRecord[] | null
}

async function getOrder(
  container: SubscriberArgs["container"],
  orderId: string
): Promise<OrderRecord | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const result = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id",
      "display_id",
      "created_at",
      "total",
      "metadata",
      "*items",
      "*items.variant",
      "*items.variant.product",
    ],
  })

  return ((result.data as OrderRecord[] | undefined) ?? [])[0] ?? null
}

async function resolveShopAndLocation(
  container: SubscriberArgs["container"],
  order: OrderRecord
) {
  const items = order.items ?? []
  const shopIds = new Set<string>()

  for (const item of items) {
    const shopId = item.variant?.product?.metadata?.["pos_shop_id"]
    if (typeof shopId === "string" && shopId.trim().length > 0) {
      shopIds.add(shopId)
    }
  }

  if (shopIds.size !== 1) {
    return null
  }

  const shopId = [...shopIds][0]
  const metadataLocationId =
    typeof order.metadata?.["shop_location_id"] === "string"
      ? (order.metadata?.["shop_location_id"] as string)
      : typeof order.metadata?.["pos_location_id"] === "string"
        ? (order.metadata?.["pos_location_id"] as string)
        : null

  const location = await getDefaultShopLocation(container, shopId, metadataLocationId)

  return {
    shopId,
    locationId: location?.id ?? null,
  }
}

async function getInventoryConfig(
  container: SubscriberArgs["container"],
  shopId: string,
  variantId: string
) {
  const inventoryConfigService: InventoryConfigModuleService =
    container.resolve(INVENTORY_CONFIG_MODULE)
  const [config] = await inventoryConfigService.listInventoryConfigs(
    { shop_id: shopId, variant_id: variantId },
    { take: 1, order: { created_at: "DESC" } }
  )

  return config as
    | {
        inventory_type: string
        purchase_unit?: string | null
        selling_units?: unknown
      }
    | undefined
}

async function createSnapshotsForOrder(
  args: SubscriberArgs<{ id: string }>
) {
  const order = await getOrder(args.container, args.event.data.id)
  if (!order || !order.items?.length) {
    return
  }

  const saleSnapshotService: SaleSnapshotModuleService =
    args.container.resolve(SALE_SNAPSHOT_MODULE)

  const ownership = await resolveShopAndLocation(args.container, order)
  if (!ownership) {
    return
  }

  const touchedVariants = new Set<string>()

  for (const item of order.items) {
    const variantId = item.variant?.id
    if (!variantId) {
      continue
    }

    const [existing] = await saleSnapshotService.listAndCountSaleSnapshots(
      {
        order_id: order.id,
        line_item_id: item.id,
        shop_id: ownership.shopId,
        variant_id: variantId,
      },
      { take: 1 }
    )

    if (existing) {
      continue
    }

    const config = await getInventoryConfig(args.container, ownership.shopId, variantId)
    if (!config) {
      continue
    }

    const sellingUnits = Array.isArray(config.selling_units)
      ? (config.selling_units as SellingUnit[])
      : []
    const primarySellingUnit = sellingUnits[0]
    const quantitySold = Number(item.quantity ?? 0)
    if (!primarySellingUnit || quantitySold <= 0) {
      continue
    }

    const deductionValue =
      calculateDeduction(
        config.inventory_type as InventoryType,
        primarySellingUnit.unit,
        sellingUnits
      ) * quantitySold

    const stockBefore = await calculateServerStock(
      args.container,
      ownership.shopId,
      variantId,
      ownership.locationId
    )

    await saleSnapshotService.createSaleSnapshots({
      client_transaction_id: null,
      order_id: order.id,
      line_item_id: item.id,
      shop_id: ownership.shopId,
      location_id: ownership.locationId,
      variant_id: variantId,
      sales_channel: "storefront",
      inventory_type: config.inventory_type,
      unit_sold: primarySellingUnit.unit,
      quantity_sold: quantitySold,
      conversion_factor_snapshot: primarySellingUnit.conversionValue,
      deduction_value: deductionValue,
      price_charged: Number(item.total ?? item.unit_price ?? 0),
      payment_method: "online",
      amount_paid: Number(item.total ?? item.unit_price ?? 0),
      stock_before: stockBefore,
      stock_after: Math.max(0, stockBefore - deductionValue),
      timestamp: order.created_at ? new Date(order.created_at) : new Date(),
    } as unknown as Record<string, unknown>)

    touchedVariants.add(variantId)
  }

  for (const variantId of touchedVariants) {
    await syncAggregateInventoryLevelForVariant(args.container, ownership.shopId, variantId)
  }
}

async function restoreSnapshotsForCanceledOrder(
  args: SubscriberArgs<{ id: string }>
) {
  const order = await getOrder(args.container, args.event.data.id)
  if (!order || !order.items?.length) {
    return
  }

  const adjustmentService: AdjustmentModuleService =
    args.container.resolve(ADJUSTMENT_MODULE)
  const ownership = await resolveShopAndLocation(args.container, order)
  if (!ownership) {
    return
  }

  const touchedVariants = new Set<string>()

  for (const item of order.items) {
    const variantId = item.variant?.id
    if (!variantId) {
      continue
    }

    const config = await getInventoryConfig(args.container, ownership.shopId, variantId)
    if (!config) {
      continue
    }

    const sellingUnits = Array.isArray(config.selling_units)
      ? (config.selling_units as SellingUnit[])
      : []
    const primarySellingUnit = sellingUnits[0]
    const quantitySold = Number(item.quantity ?? 0)
    if (!primarySellingUnit || quantitySold <= 0) {
      continue
    }

    const reference = `order-cancel:${order.id}:${item.id}`
    const [existing] = await adjustmentService.listAndCountAdjustments(
      { reference },
      { take: 1 }
    )

    if (existing) {
      continue
    }

    const quantityChange =
      calculateDeduction(
        config.inventory_type as InventoryType,
        primarySellingUnit.unit,
        sellingUnits
      ) * quantitySold
    const stockBefore = await calculateServerStock(
      args.container,
      ownership.shopId,
      variantId,
      ownership.locationId
    )

    await adjustmentService.createAdjustments({
      shop_id: ownership.shopId,
      location_id: ownership.locationId,
      variant_id: variantId,
      adjustment_type: "correction",
      quantity_change: quantityChange,
      reason: `Storefront order canceled (${order.display_id ?? order.id})`,
      reference,
      before_stock: stockBefore,
      after_stock: stockBefore + quantityChange,
      timestamp: new Date(),
    } as unknown as Record<string, unknown>)

    touchedVariants.add(variantId)
  }

  for (const variantId of touchedVariants) {
    await syncAggregateInventoryLevelForVariant(args.container, ownership.shopId, variantId)
  }
}

export default async function orderStockLedgerHandler(
  args: SubscriberArgs<{ id: string }>
) {
  if (args.event.name === "order.canceled") {
    await restoreSnapshotsForCanceledOrder(args)
    return
  }

  await createSnapshotsForOrder(args)
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.canceled"],
  context: {
    subscriberId: "uza-order-stock-ledger",
  },
}
