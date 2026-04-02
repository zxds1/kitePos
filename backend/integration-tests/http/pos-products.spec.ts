import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { SHOP_MODULE } from "../../src/modules/shop"
import type ShopModuleService from "../../src/modules/shop/service"
import { hashPhone } from "../../src/utils/hash"
import { issuePosAuthTokens } from "../../src/api/auth/_utils/jwt"

jest.setTimeout(90 * 1000)

type PosProduct = {
  id: string
  variant_id: string
  name: string
  stock_remaining: number
  is_active: boolean
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
    name: `Blue Band ${randomUUID().slice(0, 6)}`,
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
    let otherShopHeaders: Record<string, string>
    let otherShopId: string

    beforeEach(async () => {
      const phoneNumber = `+2547${Date.now().toString().slice(-8)}`
      const createdShopId = `shop_${randomUUID().replace(/-/g, "").slice(0, 24)}`
      const otherPhoneNumber = `+2547${(Date.now() + 12345).toString().slice(-8)}`
      const createdOtherShopId = `shop_${randomUUID().replace(/-/g, "").slice(0, 24)}`
      const shopService = getContainer().resolve(
        SHOP_MODULE
      ) as ShopModuleService

      await shopService.createShops([
        {
          id: createdShopId,
          shop_name: "Integration Test Duka",
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
          shop_name: "Other Test Duka",
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

    describe("POS product lifecycle", () => {
      it("replays product creation idempotently when the same Idempotency-Key is retried", async () => {
        const idempotencyKey = `product-create:${randomUUID()}`
        const createPayload = buildCreatePayload({
          name: "Idempotent Soap",
        })

        const firstResponse = await api.post("/pos/products", createPayload, {
          headers: {
            ...authHeaders,
            "Idempotency-Key": idempotencyKey,
          },
        })

        const secondResponse = await api.post("/pos/products", createPayload, {
          headers: {
            ...authHeaders,
            "Idempotency-Key": idempotencyKey,
          },
        })

        expect(firstResponse.status).toBe(201)
        expect(secondResponse.status).toBe(200)
        expect(secondResponse.data.product.variant_id).toBe(
          firstResponse.data.product.variant_id
        )

        const listResponse = await api.get("/pos/products", {
          headers: authHeaders,
        })
        const matchingProducts = (listResponse.data.products as PosProduct[]).filter(
          (product) => product.name === "Idempotent Soap"
        )

        expect(matchingProducts).toHaveLength(1)
      })

      it("creates, updates, lists, and soft deletes a product through /pos routes", async () => {
        const createResponse = await api.post(
          "/pos/products",
          buildCreatePayload(),
          { headers: authHeaders }
        )

        expect(createResponse.status).toBe(201)
        expect(createResponse.data.success).toBe(true)

        const createdProduct = createResponse.data.product as PosProduct
        expect(createdProduct.variant_id).toBeTruthy()
        expect(createdProduct.stock_remaining).toBe(12)

        const updateResponse = await api.patch(
          `/pos/products/${createdProduct.variant_id}`,
          {
            name: "Blue Band Family Pack",
            low_stock_threshold: 5,
            is_active: true,
            selling_units: [
              {
                unit: "piece",
                price: 275,
                conversion_value: 1,
              },
            ],
          },
          { headers: authHeaders }
        )

        expect(updateResponse.status).toBe(200)
        expect(updateResponse.data.success).toBe(true)
        expect(updateResponse.data.product.name).toBe("Blue Band Family Pack")

        const listResponse = await api.get("/pos/products", {
          headers: authHeaders,
        })

        expect(listResponse.status).toBe(200)
        expect(listResponse.data.success).toBe(true)
        expect(
          (listResponse.data.products as PosProduct[]).some(
            (product) => product.variant_id === createdProduct.variant_id
          )
        ).toBe(true)

        const deleteResponse = await api.delete(
          `/pos/products/${createdProduct.variant_id}`,
          { headers: authHeaders }
        )

        expect(deleteResponse.status).toBe(200)
        expect(deleteResponse.data.success).toBe(true)

        const listAfterDelete = await api.get("/pos/products", {
          headers: authHeaders,
        })

        expect(
          (listAfterDelete.data.products as PosProduct[]).some(
            (product) => product.variant_id === createdProduct.variant_id
          )
        ).toBe(false)
      })

      it("isolates POS products by shop ownership", async () => {
        const createResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Shop Owned Rice",
          }),
          { headers: authHeaders }
        )

        expect(createResponse.status).toBe(201)
        const createdProduct = createResponse.data.product as PosProduct

        const otherShopList = await api.get("/pos/products", {
          headers: otherShopHeaders,
        })
        expect(otherShopList.status).toBe(200)
        expect(
          (otherShopList.data.products as PosProduct[]).some(
            (product) => product.variant_id === createdProduct.variant_id
          )
        ).toBe(false)

        await expect(
          api.patch(
            `/pos/products/${createdProduct.variant_id}`,
            {
              name: "Hijacked Name",
            },
            { headers: otherShopHeaders }
          )
        ).rejects.toMatchObject({
          response: expect.objectContaining({
            status: 404,
          }),
        })

        await expect(
          api.patch(
            `/pos/products/${createdProduct.variant_id}/stock`,
            {
              adjustment_type: "sale",
              quantity: 1,
              reason: "cross-shop adjustment",
            },
            { headers: otherShopHeaders }
          )
        ).rejects.toMatchObject({
          response: expect.objectContaining({
            status: 404,
          }),
        })
      })

      it("applies stock changes through the POS stock route when the payload matches backend expectations", async () => {
        const createResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Cooking Oil",
            stock_remaining: 10,
          }),
          { headers: authHeaders }
        )

        const createdProduct = createResponse.data.product as PosProduct

        const saleResponse = await api.patch(
          `/pos/products/${createdProduct.variant_id}/stock`,
          {
            adjustment_type: "sale",
            quantity: 2,
            reason: "offline sale replay",
          },
          { headers: authHeaders }
        )

        expect(saleResponse.status).toBe(200)
        expect(saleResponse.data.success).toBe(true)
        expect(saleResponse.data.product.stock_remaining).toBe(8)

        const restockResponse = await api.patch(
          `/pos/products/${createdProduct.variant_id}/stock`,
          {
            adjustment_type: "restock",
            quantity: 5,
            reason: "supplier delivery",
          },
          { headers: authHeaders }
        )

        expect(restockResponse.status).toBe(200)
        expect(restockResponse.data.success).toBe(true)
        expect(restockResponse.data.product.stock_remaining).toBe(13)
      })

      it("replays stock adjustments idempotently when reconnect retries the same request", async () => {
        const createResponse = await api.post(
          "/pos/products",
          buildCreatePayload({
            name: "Idempotent Flour",
            stock_remaining: 9,
          }),
          { headers: authHeaders }
        )

        const createdProduct = createResponse.data.product as PosProduct

        const saleKey = `stock-sale:${randomUUID()}`
        const firstSale = await api.patch(
          `/pos/products/${createdProduct.variant_id}/stock`,
          {
            adjustment_type: "sale",
            quantity: 2,
            reason: "replayed sale",
          },
          {
            headers: {
              ...authHeaders,
              "Idempotency-Key": saleKey,
            },
          }
        )

        const secondSale = await api.patch(
          `/pos/products/${createdProduct.variant_id}/stock`,
          {
            adjustment_type: "sale",
            quantity: 2,
            reason: "replayed sale",
          },
          {
            headers: {
              ...authHeaders,
              "Idempotency-Key": saleKey,
            },
          }
        )

        expect(firstSale.status).toBe(200)
        expect(secondSale.status).toBe(200)
        expect(firstSale.data.product.stock_remaining).toBe(7)
        expect(secondSale.data.product.stock_remaining).toBe(7)

        const restockKey = `stock-restock:${randomUUID()}`
        const firstRestock = await api.patch(
          `/pos/products/${createdProduct.variant_id}/stock`,
          {
            adjustment_type: "restock",
            quantity: 4,
            reason: "supplier replay",
          },
          {
            headers: {
              ...authHeaders,
              "Idempotency-Key": restockKey,
            },
          }
        )

        const secondRestock = await api.patch(
          `/pos/products/${createdProduct.variant_id}/stock`,
          {
            adjustment_type: "restock",
            quantity: 4,
            reason: "supplier replay",
          },
          {
            headers: {
              ...authHeaders,
              "Idempotency-Key": restockKey,
            },
          }
        )

        expect(firstRestock.status).toBe(200)
        expect(secondRestock.status).toBe(200)
        expect(firstRestock.data.product.stock_remaining).toBe(11)
        expect(secondRestock.data.product.stock_remaining).toBe(11)
      })
    })
  },
})
