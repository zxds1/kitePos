import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP_MODULE } from "../../src/modules/shop"
import type ShopModuleService from "../../src/modules/shop/service"
import { SALE_SNAPSHOT_MODULE } from "../../src/modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../src/modules/sale-snapshot/service"
import { hashPhone } from "../../src/utils/hash"
import { issuePosAuthTokens } from "../../src/api/auth/_utils/jwt"
import { POST as postBatchSales } from "../../src/api/admin/inventory/batch-sales/route"
import { GET as getPaymentAnalytics } from "../../src/api/admin/analytics/payments/route"

jest.setTimeout(90 * 1000)

type PosProduct = {
  id: string
  variant_id: string
  name: string
  stock_remaining: number
  is_active: boolean
}

type MockResponseState<T> = {
  statusCode: number
  body: T | null
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
    name: `Test Product ${randomUUID().slice(0, 6)}`,
    category: "groceries",
    inventory_type: "discrete",
    purchase_unit: "crate",
    purchase_value: 12,
    cost_per_purchase: 2400,
    selling_units: [
      {
        unit: "piece",
        price: 250,
        conversion_value: 1,
      },
    ],
    low_stock_threshold: 3,
    is_active: true,
    stock_remaining: 12,
    ...overrides,
  }
}

function createMockResponse<T>() {
  const state: MockResponseState<T> = {
    statusCode: 200,
    body: null,
  }

  const response = {
    status(code: number) {
      state.statusCode = code
      return this
    },
    json(payload: T) {
      state.body = payload
      return this
    },
  } as unknown as MedusaResponse<T>

  return { response, state }
}

async function invokeBatchSales(
  scope: MedusaRequest["scope"],
  body: Record<string, unknown>
) {
  const { response, state } = createMockResponse<Record<string, unknown>>()

  await postBatchSales(
    {
      scope,
      validatedBody: body,
    } as MedusaRequest,
    response
  )

  return state
}

async function invokePaymentAnalytics(
  scope: MedusaRequest["scope"],
  query: Record<string, unknown>
) {
  const { response, state } = createMockResponse<Record<string, unknown>>()

  await getPaymentAnalytics(
    {
      scope,
      query,
    } as MedusaRequest,
    response
  )

  return state
}

function findProduct(products: PosProduct[], variantId: string) {
  const product = products.find((item) => item.variant_id === variantId)
  expect(product).toBeDefined()
  return product as PosProduct
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let authHeaders: Record<string, string>
    let shopId: string
    let otherShopHeaders: Record<string, string>
    let otherShopId: string

    beforeEach(async () => {
      const phoneNumber = `+2547${Date.now().toString().slice(-8)}`
      const createdShopId = `shop_${randomUUID().replace(/-/g, "").slice(0, 24)}`
      const otherPhoneNumber = `+2547${(Date.now() + 54321).toString().slice(-8)}`
      const createdOtherShopId = `shop_${randomUUID().replace(/-/g, "").slice(0, 24)}`
      const shopService = getContainer().resolve(
        SHOP_MODULE
      ) as ShopModuleService

      await shopService.createShops([
        {
          id: createdShopId,
          shop_name: "Batch Sales Test Duka",
          owner_phone_hash: hashPhone(phoneNumber),
          region_code: "47",
          ward_code: "001",
          category: "retail",
          consent_given: true,
          consent_timestamp: new Date(),
          is_active: true,
          accept_mpesa: true,
        },
        {
          id: createdOtherShopId,
          shop_name: "Other Batch Sales Test Duka",
          owner_phone_hash: hashPhone(otherPhoneNumber),
          region_code: "47",
          ward_code: "002",
          category: "retail",
          consent_given: true,
          consent_timestamp: new Date(),
          is_active: true,
          accept_mpesa: true,
        },
      ] as unknown as Record<string, unknown>)

      shopId = createdShopId
      otherShopId = createdOtherShopId
      authHeaders = buildAuthHeaders(shopId, phoneNumber)
      otherShopHeaders = buildAuthHeaders(otherShopId, otherPhoneNumber)
    })

    describe("admin inventory batch sales", () => {
      it("validates stock through the POS route and rejects overselling", async () => {
        const sugarResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Validation Sugar",
            inventory_type: "bulk_loose",
            purchase_unit: "kg",
            purchase_value: 1,
            cost_per_purchase: 130,
            stock_remaining: 0.5,
            selling_units: [
              {
                unit: "500g",
                price: 95,
                conversion_value: 0.5,
              },
              {
                unit: "1kg",
                price: 180,
                conversion_value: 1,
              },
            ],
          }),
          { headers: authHeaders }
        )

        const sugar = sugarResponse.data.product as PosProduct

        const allowedResponse = await api.post(
          "/pos/inventory/validate-sale",
          {
            variant_id: sugar.variant_id,
            unit_sold: "500g",
            quantity: 1,
            local_stock: 0.5,
          },
          { headers: authHeaders }
        )

        expect(allowedResponse.status).toBe(200)
        expect(allowedResponse.data.allowed).toBe(true)
        expect(allowedResponse.data.deduction_value).toBe(0.5)

        const rejectedResponse = await api.post(
          "/pos/inventory/validate-sale",
          {
            variant_id: sugar.variant_id,
            unit_sold: "1kg",
            quantity: 1,
            local_stock: 0.5,
          },
          { headers: authHeaders }
        )

        expect(rejectedResponse.status).toBe(200)
        expect(rejectedResponse.data.allowed).toBe(false)
        expect(rejectedResponse.data.message).toBe("Insufficient stock")
        expect(rejectedResponse.data.current_stock).toBe(0.5)
      })

      it("rejects validation and sale sync attempts from a different shop", async () => {
        const createResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Shop A Cooking Fat",
            stock_remaining: 6,
          }),
          { headers: authHeaders }
        )

        const product = createResponse.data.product as PosProduct

        await expect(
          api.post(
            "/pos/inventory/validate-sale",
            {
              variant_id: product.variant_id,
              unit_sold: "piece",
              quantity: 1,
              local_stock: 6,
            },
            { headers: otherShopHeaders }
          )
        ).rejects.toMatchObject({
          response: expect.objectContaining({
            status: 404,
          }),
        })

        const crossShopSaleResponse = await api.post(
          "/pos/sales",
          {
            sales: [
              {
                client_transaction_id: `cross-shop:${randomUUID()}`,
                order_id: `order:${randomUUID()}`,
                variant_id: product.variant_id,
                shop_id: otherShopId,
                inventory_type: "discrete",
                unit_sold: "piece",
                quantity_sold: 1,
                conversion_factor_snapshot: 1,
                deduction_value: 1,
                stock_before: 6,
                stock_after: 5,
                price_charged: 250,
                payment_method: "cash",
                timestamp: new Date().toISOString(),
              },
            ],
          },
          { headers: otherShopHeaders }
        )

        expect(crossShopSaleResponse.status).toBe(200)
        expect(crossShopSaleResponse.data.results).toEqual([
          expect.objectContaining({
            status: "error",
            error: expect.stringContaining("Inventory config not found"),
          }),
        ])
      })

      it("records bulk and discrete sales, updates computed stock, and skips duplicate replays", async () => {
        const flourResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Wheat Flour",
            stock_remaining: 10,
          }),
          { headers: authHeaders }
        )

        const sugarResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Sugar",
            inventory_type: "bulk_loose",
            purchase_unit: "kg",
            purchase_value: 50,
            cost_per_purchase: 6500,
            stock_remaining: 50,
            selling_units: [
              {
                unit: "200g",
                price: 40,
                conversion_value: 0.2,
              },
              {
                unit: "500g",
                price: 95,
                conversion_value: 0.5,
              },
            ],
          }),
          { headers: authHeaders }
        )

        const flour = flourResponse.data.product as PosProduct
        const sugar = sugarResponse.data.product as PosProduct

        const firstSync = await api.post(
          "/pos/sales",
          {
          shop_id: shopId,
          sales: [
            {
              client_transaction_id: `offline-flour:${randomUUID()}`,
              order_id: `order:${randomUUID()}`,
              variant_id: flour.variant_id,
              shop_id: shopId,
              inventory_type: "discrete",
              unit_sold: "piece",
              quantity_sold: 2,
              conversion_factor_snapshot: 1,
              deduction_value: 2,
              stock_before: 10,
              stock_after: 8,
              price_charged: 500,
              payment_method: "cash",
              timestamp: new Date().toISOString(),
            },
            {
              client_transaction_id: `offline-sugar-200:${randomUUID()}`,
              order_id: `order:${randomUUID()}`,
              variant_id: sugar.variant_id,
              shop_id: shopId,
              inventory_type: "bulk_loose",
              unit_sold: "200g",
              quantity_sold: 1,
              conversion_factor_snapshot: 0.2,
              deduction_value: 0.2,
              stock_before: 50,
              stock_after: 49.8,
              price_charged: 40,
              payment_method: "cash",
              timestamp: new Date().toISOString(),
            },
            {
              client_transaction_id: `offline-sugar-500:${randomUUID()}`,
              order_id: `order:${randomUUID()}`,
              variant_id: sugar.variant_id,
              shop_id: shopId,
              inventory_type: "bulk_loose",
              unit_sold: "500g",
              quantity_sold: 1,
              conversion_factor_snapshot: 0.5,
              deduction_value: 0.5,
              stock_before: 49.8,
              stock_after: 49.3,
              price_charged: 95,
              payment_method: "cash",
              timestamp: new Date().toISOString(),
            },
          ],
          sync_metadata: {
            device_id_hash: "integration-test-device",
            app_version: "1.0.0-test",
            sync_started_at: new Date().toISOString(),
          },
          },
          { headers: authHeaders }
        )

        expect(firstSync.status).toBe(200)
        expect(firstSync.data.processed).toBe(3)
        expect(firstSync.data.results).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ status: "success" }),
            expect.objectContaining({ status: "success" }),
            expect.objectContaining({ status: "success" }),
          ])
        )

        const listAfterFirstSync = await api.get("/pos/products", {
          headers: authHeaders,
        })

        const flourAfterFirstSync = findProduct(
          listAfterFirstSync.data.products as PosProduct[],
          flour.variant_id
        )
        const sugarAfterFirstSync = findProduct(
          listAfterFirstSync.data.products as PosProduct[],
          sugar.variant_id
        )

        expect(flourAfterFirstSync.stock_remaining).toBe(8)
        expect(sugarAfterFirstSync.stock_remaining).toBeCloseTo(49.3, 5)

        const duplicateSaleId = `offline-replay:${randomUUID()}`
        const duplicatePayload = {
          shop_id: shopId,
          sales: [
            {
              client_transaction_id: duplicateSaleId,
              order_id: `order:${randomUUID()}`,
              variant_id: flour.variant_id,
              shop_id: shopId,
              inventory_type: "discrete",
              unit_sold: "piece",
              quantity_sold: 1,
              conversion_factor_snapshot: 1,
              deduction_value: 1,
              stock_before: 8,
              stock_after: 7,
              price_charged: 250,
              payment_method: "cash",
              timestamp: new Date().toISOString(),
            },
          ],
        }

        const firstReplay = await api.post("/pos/sales", duplicatePayload, {
          headers: authHeaders,
        })

        const secondReplay = await api.post("/pos/sales", duplicatePayload, {
          headers: authHeaders,
        })

        expect(firstReplay.status).toBe(200)
        expect(firstReplay.data.results).toEqual([
          expect.objectContaining({
            client_transaction_id: duplicateSaleId,
            status: "success",
          }),
        ])
        expect(secondReplay.status).toBe(200)
        expect(secondReplay.data.results).toEqual([
          expect.objectContaining({
            client_transaction_id: duplicateSaleId,
            status: "skipped_duplicate",
          }),
        ])

        const listAfterReplay = await api.get("/pos/products", {
          headers: authHeaders,
        })

        const flourAfterReplay = findProduct(
          listAfterReplay.data.products as PosProduct[],
          flour.variant_id
        )
        expect(flourAfterReplay.stock_remaining).toBe(7)
      })

      it("stores mpesa metadata and surfaces payment totals in analytics", async () => {
        const oilResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Cooking Oil",
            inventory_type: "bulk_liquid",
            purchase_unit: "L",
            purchase_value: 20,
            cost_per_purchase: 4200,
            stock_remaining: 20,
            selling_units: [
              {
                unit: "1L",
                price: 260,
                conversion_value: 1,
              },
            ],
          }),
          { headers: authHeaders }
        )

        const oil = oilResponse.data.product as PosProduct
        const mpesaSaleId = `offline-mpesa:${randomUUID()}`
        const syncResponse = await invokeBatchSales(getContainer(), {
          shop_id: shopId,
          sales: [
            {
              client_transaction_id: mpesaSaleId,
              order_id: `order:${randomUUID()}`,
              variant_id: oil.variant_id,
              shop_id: shopId,
              inventory_type: "bulk_liquid",
              unit_sold: "1L",
              quantity_sold: 1,
              conversion_factor_snapshot: 1,
              deduction_value: 1,
              stock_before: 20,
              stock_after: 19,
              price_charged: 260,
              payment_method: "mpesa",
              mpesa_receipt_number: "QKH1234567",
              mpesa_customer_phone: "254712345678",
              amount_paid: 260,
              timestamp: new Date().toISOString(),
            },
          ],
        })

        expect(syncResponse.statusCode).toBe(200)
        expect(syncResponse.body?.results).toEqual([
          expect.objectContaining({
            client_transaction_id: mpesaSaleId,
            status: "success",
          }),
        ])
        expect(syncResponse.body?.payment_summary).toEqual({
          cash_count: 0,
          mpesa_count: 1,
          mpesa_total: 260,
        })

        const saleSnapshotService = getContainer().resolve(
          SALE_SNAPSHOT_MODULE
        ) as SaleSnapshotModuleService

        const [snapshots] = await saleSnapshotService.listAndCountSaleSnapshots(
          {
            client_transaction_id: mpesaSaleId,
            shop_id: shopId,
            variant_id: oil.variant_id,
          },
          { take: 1 }
        )

        expect(snapshots).toHaveLength(1)
        expect(snapshots[0].payment_method).toBe("mpesa")
        expect(snapshots[0].mpesa_receipt_number).toBe("QKH1234567")
        expect(snapshots[0].mpesa_customer_phone).toBe("254712345678")

        const analytics = await invokePaymentAnalytics(getContainer(), {
          shop_id: shopId,
          start_date: new Date(Date.now() - 60_000).toISOString(),
          end_date: new Date(Date.now() + 60_000).toISOString(),
          group_by: "day",
        })

        expect(analytics.statusCode).toBe(200)
        expect(analytics.body?.success).toBe(true)
        expect(analytics.body?.summary).toEqual(
          expect.objectContaining({
            total_sales: 1,
            total_revenue: 260,
            mpesa_adoption_rate: "100.00%",
            payment_breakdown: {
              cash: { count: 0, total: 0 },
              mpesa: { count: 1, total: 260 },
              card: { count: 0, total: 0 },
              other: { count: 0, total: 0 },
            },
          })
        )
      })
    })
  },
})
