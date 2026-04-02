import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ANALYTICS_SNAPSHOT_MODULE } from "../../src/modules/analytics-snapshot"
import type AnalyticsSnapshotModuleService from "../../src/modules/analytics-snapshot/service"
import { SHOP_MODULE } from "../../src/modules/shop"
import type ShopModuleService from "../../src/modules/shop/service"
import { hashPhone } from "../../src/utils/hash"
import { issuePosAuthTokens } from "../../src/api/auth/_utils/jwt"

jest.setTimeout(90 * 1000)

type PosProduct = {
  variant_id: string
  stock_remaining: number
  name: string
}

function buildAuthHeaders(shopId: string, phoneNumber: string) {
  const tokens = issuePosAuthTokens({
    phone_number: phoneNumber,
    shop_id: shopId,
    is_registered: true,
  })

  return {
    Authorization: `Bearer ${tokens.access_token}`,
  }
}

function buildCreatePayload(overrides: Record<string, unknown> = {}) {
  return {
    name: `Analytics Product ${randomUUID().slice(0, 6)}`,
    category: "groceries",
    inventory_type: "discrete",
    purchase_unit: "crate",
    purchase_value: 10,
    cost_per_purchase: 100,
    selling_units: [
      {
        unit: "piece",
        price: 30,
        conversion_value: 1,
      },
    ],
    low_stock_threshold: 3,
    is_active: true,
    stock_remaining: 10,
    ...overrides,
  }
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let authHeaders: Record<string, string>
    let shopId: string

    beforeEach(async () => {
      const phoneNumber = `+2547${Date.now().toString().slice(-8)}`
      const createdShopId = `shop_${randomUUID().replace(/-/g, "").slice(0, 24)}`
      const shopService = getContainer().resolve(
        SHOP_MODULE
      ) as ShopModuleService

      await shopService.createShops({
        id: createdShopId,
        shop_name: "Analytics Test Duka",
        owner_phone_hash: hashPhone(phoneNumber),
        region_code: "47",
        ward_code: "001",
        category: "retail",
        consent_given: true,
        consent_timestamp: new Date(),
        is_active: true,
        accept_mpesa: true,
      } as unknown as Record<string, unknown>)

      shopId = createdShopId
      authHeaders = buildAuthHeaders(shopId, phoneNumber)
    })

    describe("POS analytics", () => {
      it("returns backend-computed KPI summary with profit/loss and turnover", async () => {
        const createResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Profit Bread",
            stock_remaining: 10,
            purchase_value: 10,
            cost_per_purchase: 100,
            selling_units: [
              {
                unit: "piece",
                price: 30,
                conversion_value: 1,
              },
            ],
          }),
          { headers: authHeaders }
        )

        expect(createResponse.status).toBe(201)
        const product = createResponse.data.product as PosProduct

        const syncResponse = await api.post(
          "/pos/sales",
          {
            shop_id: shopId,
            sales: [
              {
                client_transaction_id: `analytics-sale:${randomUUID()}`,
                order_id: `order:${randomUUID()}`,
                variant_id: product.variant_id,
                shop_id: shopId,
                inventory_type: "discrete",
                unit_sold: "piece",
                quantity_sold: 2,
                conversion_factor_snapshot: 1,
                deduction_value: 2,
                stock_before: 10,
                stock_after: 8,
                price_charged: 60,
                payment_method: "cash",
                timestamp: new Date().toISOString(),
              },
            ],
          },
          { headers: authHeaders }
        )

        expect(syncResponse.status).toBe(200)

        const analyticsResponse = await api.get("/pos/analytics", {
          headers: authHeaders,
          params: {
            start_date: new Date(Date.now() - 60_000).toISOString(),
            end_date: new Date(Date.now() + 60_000).toISOString(),
          },
        })

        expect(analyticsResponse.status).toBe(200)
        expect(analyticsResponse.data.success).toBe(true)
        expect(analyticsResponse.data.sales_summary).toEqual(
          expect.objectContaining({
            total_revenue: 60,
            total_transactions: 1,
            estimated_cost_of_goods_sold: 20,
            gross_profit_loss: 40,
            cash_revenue: 60,
            mpesa_revenue: 0,
            inventory_value: 80,
          })
        )
        expect(analyticsResponse.data.sales_summary.gross_margin_percent).toBeCloseTo(
          66.67,
          1
        )
        expect(analyticsResponse.data.sales_summary.inventory_turnover_ratio).toBeCloseTo(
          0.22,
          1
        )
        expect(analyticsResponse.data.top_products).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              variant_id: product.variant_id,
              units_sold: 2,
              revenue: 60,
              estimated_cost: 20,
              gross_profit_loss: 40,
              stock_remaining: 8,
            }),
          ])
        )

        const analyticsSnapshotService = getContainer().resolve(
          ANALYTICS_SNAPSHOT_MODULE
        ) as AnalyticsSnapshotModuleService
        const [snapshots] = await analyticsSnapshotService.listAndCountAnalyticsSnapshots(
          {
            shop_id: shopId,
            snapshot_type: "summary",
          },
          { take: 10 }
        )

        expect(snapshots.length).toBeGreaterThan(0)
      })

      it("returns backend-computed individual product analytics detail", async () => {
        const createResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Cooking Fat",
            stock_remaining: 10,
            purchase_value: 10,
            cost_per_purchase: 100,
            selling_units: [
              {
                unit: "piece",
                price: 30,
                conversion_value: 1,
              },
            ],
          }),
          { headers: authHeaders }
        )

        const product = createResponse.data.product as PosProduct

        const saleResponse = await api.post(
          "/pos/sales",
          {
            shop_id: shopId,
            sales: [
              {
                client_transaction_id: `analytics-mpesa:${randomUUID()}`,
                order_id: `order:${randomUUID()}`,
                variant_id: product.variant_id,
                shop_id: shopId,
                inventory_type: "discrete",
                unit_sold: "piece",
                quantity_sold: 3,
                conversion_factor_snapshot: 1,
                deduction_value: 3,
                stock_before: 10,
                stock_after: 7,
                price_charged: 90,
                payment_method: "mpesa",
                amount_paid: 90,
                mpesa_receipt_number: "QKH9999999",
                timestamp: new Date().toISOString(),
              },
            ],
          },
          { headers: authHeaders }
        )

        expect(saleResponse.status).toBe(200)

        const detailResponse = await api.get(
          `/pos/analytics/products/${product.variant_id}`,
          {
            headers: authHeaders,
            params: {
              start_date: new Date(Date.now() - 60_000).toISOString(),
              end_date: new Date(Date.now() + 60_000).toISOString(),
            },
          }
        )

        expect(detailResponse.status).toBe(200)
        expect(detailResponse.data.success).toBe(true)
        expect(detailResponse.data.data).toEqual(
          expect.objectContaining({
            variant_id: product.variant_id,
            product_name: "Cooking Fat",
            total_revenue: 90,
            units_sold: 3,
            transaction_count: 1,
            estimated_cost: 30,
            gross_profit_loss: 60,
            cash_revenue: 0,
            mpesa_revenue: 90,
            stock_remaining: 7,
          })
        )
        expect(detailResponse.data.data.gross_margin_percent).toBeCloseTo(66.67, 1)
        expect(detailResponse.data.data.average_selling_price).toBe(30)
        expect(detailResponse.data.data.turnover_rate).toBeCloseTo(0.3, 1)
        expect(detailResponse.data.data.daily_trends).toHaveLength(1)

        const analyticsSnapshotService = getContainer().resolve(
          ANALYTICS_SNAPSHOT_MODULE
        ) as AnalyticsSnapshotModuleService
        const [snapshots] = await analyticsSnapshotService.listAndCountAnalyticsSnapshots(
          {
            shop_id: shopId,
            snapshot_type: "product",
            variant_id: product.variant_id,
          },
          { take: 10 }
        )

        expect(snapshots.length).toBeGreaterThan(0)
      })

      it("treats online analytics filter as storefront sales channel", async () => {
        const createResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Online Biscuits",
            stock_remaining: 10,
            purchase_value: 10,
            cost_per_purchase: 100,
          }),
          { headers: authHeaders }
        )

        const product = createResponse.data.product as PosProduct

        const saleSnapshotService = getContainer().resolve(
          "sale_snapshot"
        ) as any
        await saleSnapshotService.createSaleSnapshots({
          client_transaction_id: null,
          order_id: `storefront:${randomUUID()}`,
          line_item_id: `line:${randomUUID()}`,
          shop_id: shopId,
          location_id: null,
          variant_id: product.variant_id,
          sales_channel: "storefront",
          inventory_type: "discrete",
          unit_sold: "piece",
          quantity_sold: 1,
          conversion_factor_snapshot: 1,
          deduction_value: 1,
          price_charged: 30,
          payment_method: "online",
          amount_paid: 30,
          stock_before: 10,
          stock_after: 9,
          timestamp: new Date(),
        })

        const analyticsResponse = await api.get("/pos/analytics", {
          headers: authHeaders,
          params: {
            start_date: new Date(Date.now() - 60_000).toISOString(),
            end_date: new Date(Date.now() + 60_000).toISOString(),
            sales_channel: "online",
          },
        })

        expect(analyticsResponse.status).toBe(200)
        expect(analyticsResponse.data.sales_summary.total_revenue).toBe(30)
        expect(analyticsResponse.data.top_products).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              variant_id: product.variant_id,
            }),
          ])
        )
      })
    })
  },
})
