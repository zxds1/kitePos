import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { SHOP_MODULE } from "../../src/modules/shop"
import type ShopModuleService from "../../src/modules/shop/service"
import { RESTOCK_MODULE } from "../../src/modules/restock"
import type RestockModuleService from "../../src/modules/restock/service"
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
    name: `Restock Product ${randomUUID().slice(0, 6)}`,
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
        shop_name: "Restock Test Duka",
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

    describe("POS restocks", () => {
      it("records restocks and applies stock increases through the POS restock route", async () => {
        const createResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Restock Sugar",
            stock_remaining: 10,
          }),
          { headers: authHeaders }
        )

        expect(createResponse.status).toBe(201)
        const product = createResponse.data.product as PosProduct

        const restockPayload = {
          shop_id: shopId,
          variant_id: product.variant_id,
          quantity_received: 50,
          purchase_unit_qty: 1,
          cost_per_unit: 70,
          total_cost: 3500,
          source: "manual",
          supplier_name: "Naivas",
          receipt_raw_text: "Naivas Wholesale Receipt",
          conversion_snapshot: {
            inventory_type: "discrete",
          },
          timestamp: new Date().toISOString(),
        }

        const restockResponse = await api.post("/pos/restocks", restockPayload, {
          headers: authHeaders,
        })

        expect(restockResponse.status).toBe(200)
        expect(restockResponse.data.restock.variant_id).toBe(product.variant_id)
        expect(restockResponse.data.restock.shop_id).toBe(shopId)
        expect(restockResponse.data.restock.quantity_received).toBe(50)

        const listResponse = await api.get("/pos/products", {
          headers: authHeaders,
        })
        const syncedProduct = (listResponse.data.products as PosProduct[]).find(
          (item) => item.variant_id === product.variant_id
        )

        expect(syncedProduct).toBeDefined()
        expect(syncedProduct?.stock_remaining).toBe(60)

        const restockService = getContainer().resolve(
          RESTOCK_MODULE
        ) as RestockModuleService
        const [restocks] = await restockService.listAndCountRestocks({
          shop_id: shopId,
          variant_id: product.variant_id,
        })

        expect(restocks.length).toBeGreaterThanOrEqual(2)
        expect(
          restocks.some((restock) => restock.supplier_name === "Naivas")
        ).toBe(true)
      })
    })
  },
})
