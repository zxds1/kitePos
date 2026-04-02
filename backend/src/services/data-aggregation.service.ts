import type { MedusaContainer } from "@medusajs/framework/types"
import { SALE_SNAPSHOT_MODULE } from "../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../modules/sale-snapshot/service"
import { SHOP_MODULE } from "../modules/shop"
import type ShopModuleService from "../modules/shop/service"
import { asNumber, toCsv } from "../api/admin/_utils/admin-analytics"
import { listNormalizedProducts } from "../api/admin/products/_utils"
import type { MedusaRequest } from "@medusajs/framework/http"

type AggregatedSalesInput = {
  partnerId: string
  startDate: Date
  endDate: Date
  regions?: string[]
  groupBy?: "region" | "ward" | "category"
  minShops?: number
  ipAddress?: string
  userAgent?: string
}

export class DataAggregationService {
  constructor(
    private container: MedusaContainer,
    private req?: MedusaRequest
  ) {}

  private get saleSnapshotService(): SaleSnapshotModuleService {
    return this.container.resolve(SALE_SNAPSHOT_MODULE)
  }

  private get shopService(): ShopModuleService {
    return this.container.resolve(SHOP_MODULE)
  }

  async getAggregatedSales(input: AggregatedSalesInput) {
    const groupBy = input.groupBy ?? "region"
    const minShops = Math.max(10, input.minShops ?? 10)

    const shops = await this.shopService.listShops(
      {
        consent_given: true,
        data_sharing_consent: true,
        analytics_consent: true,
        is_active: true,
      },
      {
        take: 10000,
      }
    )

    const scopedShops = input.regions?.length
      ? shops.filter((shop) => input.regions?.includes(shop.region_code))
      : shops

    const shopById = new Map(scopedShops.map((shop) => [shop.id, shop]))
    const shopIds = scopedShops.map((shop) => shop.id)

    if (shopIds.length === 0) {
      return {
        success: true,
        data: [],
        metadata: {
          total_shops_included: 0,
          total_sales_aggregated: 0,
          date_range: {
            start: input.startDate.toISOString(),
            end: input.endDate.toISOString(),
          },
          aggregation_level: groupBy,
          privacy_threshold: minShops,
        },
      }
    }

    const sales = await this.saleSnapshotService.listSaleSnapshots(
      {
        shop_id: shopIds,
        timestamp: {
          $gte: input.startDate,
          $lte: input.endDate,
        },
      },
      {
        take: 10000,
        order: { timestamp: "DESC" },
      }
    )

    const grouped = new Map<
      string,
      {
        key: string
        total_revenue: number
        total_transactions: number
        shop_count: Set<string>
        payment_methods: { cash: number; mpesa: number; card: number; other: number }
      }
    >()

    for (const sale of sales) {
      const shop = shopById.get(sale.shop_id)
      if (!shop) {
        continue
      }

      const key =
        groupBy === "ward"
          ? `${shop.region_code}-${shop.ward_code}`
          : groupBy === "category"
            ? String(sale.inventory_type ?? "unknown")
            : shop.region_code

      const current = grouped.get(key) ?? {
        key,
        total_revenue: 0,
        total_transactions: 0,
        shop_count: new Set<string>(),
        payment_methods: { cash: 0, mpesa: 0, card: 0, other: 0 },
      }

      current.total_revenue +=
        asNumber(sale.amount_paid) || asNumber(sale.price_charged)
      current.total_transactions += 1
      current.shop_count.add(sale.shop_id)

      const method =
        sale.payment_method === "mpesa" ||
        sale.payment_method === "card" ||
        sale.payment_method === "other"
          ? sale.payment_method
          : "cash"
      current.payment_methods[method] += 1
      grouped.set(key, current)
    }

    const data = Array.from(grouped.values())
      .filter((entry) => entry.shop_count.size >= minShops)
      .map((entry) => ({
        key: entry.key,
        total_revenue: Math.round(entry.total_revenue),
        total_transactions: entry.total_transactions,
        shop_count: entry.shop_count.size,
        average_transaction_value:
          entry.total_transactions > 0
            ? Math.round(entry.total_revenue / entry.total_transactions)
            : 0,
        payment_method_mix: {
          mpesa_percent:
            entry.total_transactions > 0
              ? Math.round((entry.payment_methods.mpesa / entry.total_transactions) * 100)
              : 0,
          cash_percent:
            entry.total_transactions > 0
              ? Math.round((entry.payment_methods.cash / entry.total_transactions) * 100)
              : 0,
          card_percent:
            entry.total_transactions > 0
              ? Math.round((entry.payment_methods.card / entry.total_transactions) * 100)
              : 0,
        },
      }))

    return {
      success: true,
      data,
      metadata: {
        total_shops_included: scopedShops.length,
        total_sales_aggregated: sales.length,
        date_range: {
          start: input.startDate.toISOString(),
          end: input.endDate.toISOString(),
        },
        aggregation_level: groupBy,
        privacy_threshold: minShops,
      },
    }
  }

  async getProductBenchmarks({
    partnerId,
    startDate,
    endDate,
    regions,
    category,
    minShops = 10,
    ipAddress,
    userAgent,
  }: {
    partnerId: string
    startDate: Date
    endDate: Date
    regions?: string[]
    category?: string
    minShops?: number
    ipAddress?: string
    userAgent?: string
  }) {
    const safeMinShops = Math.max(10, minShops)
    const shops = await this.shopService.listShops(
      {
        consent_given: true,
        data_sharing_consent: true,
        analytics_consent: true,
        is_active: true,
      },
      { take: 10000 }
    )

    const scopedShops = regions?.length
      ? shops.filter((shop) => regions.includes(shop.region_code))
      : shops
    const shopIds = new Set(scopedShops.map((shop) => shop.id))

    const sales = await this.saleSnapshotService.listSaleSnapshots(
      {
        shop_id: Array.from(shopIds),
        timestamp: {
          $gte: startDate,
          $lte: endDate,
        },
      },
      {
        take: 10000,
        order: { timestamp: "DESC" },
      }
    )

    const products = this.req ? await listNormalizedProducts(this.req) : []
    const productByVariant = new Map(products.map((product) => [product.variant_id, product]))

    const grouped = new Map<
      string,
      {
        product_name: string
        category: string
        total_revenue: number
        total_transactions: number
        prices: number[]
        shops: Set<string>
      }
    >()

    for (const sale of sales) {
      if (!shopIds.has(sale.shop_id)) {
        continue
      }

      const product = productByVariant.get(sale.variant_id)
      const productCategory = product?.category ?? "Uncategorized"
      if (category && productCategory !== category) {
        continue
      }

      const key = sale.variant_id
      const current = grouped.get(key) ?? {
        product_name: product?.name ?? "Unknown product",
        category: productCategory,
        total_revenue: 0,
        total_transactions: 0,
        prices: [],
        shops: new Set<string>(),
      }

      const price = asNumber(sale.amount_paid) || asNumber(sale.price_charged)
      current.total_revenue += price
      current.total_transactions += 1
      current.prices.push(price)
      current.shops.add(sale.shop_id)
      grouped.set(key, current)
    }

    const data = Array.from(grouped.values())
      .filter((entry) => entry.shops.size >= safeMinShops)
      .map((entry) => {
        const sortedPrices = [...entry.prices].sort((left, right) => left - right)
        const medianIndex = Math.floor(sortedPrices.length / 2)
        const medianPrice = sortedPrices[medianIndex] ?? 0
        return {
          product_name: entry.product_name,
          category: entry.category,
          shop_count: entry.shops.size,
          median_price: Math.round(medianPrice),
          average_price:
            entry.prices.length > 0
              ? Math.round(
                  entry.prices.reduce((sum, price) => sum + price, 0) / entry.prices.length
                )
              : 0,
          sales_velocity:
            entry.total_transactions > 0
              ? Math.round(entry.total_transactions / Math.max(1, scopedShops.length))
              : 0,
          total_revenue: Math.round(entry.total_revenue),
        }
      })

    return {
      success: true,
      data,
    }
  }

  toCsv(data: Array<Record<string, unknown>>, fields: string[]) {
    return toCsv(data, fields)
  }
}
