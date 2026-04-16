import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type InventoryConfigModuleService from "../../src/modules/inventory-config/service"
import { INVENTORY_CONFIG_MODULE } from "../../src/modules/inventory-config"
import { SHOP_MODULE } from "../../src/modules/shop"
import type ShopModuleService from "../../src/modules/shop/service"
import { hashPhone } from "../../src/utils/hash"
import { issuePosAuthTokens } from "../../src/api/auth/_utils/jwt"

jest.setTimeout(90 * 1000)

function buildAuthHeaders(shopId: string, phoneNumber: string) {
  const tokens = issuePosAuthTokens({
    phone_number: phoneNumber,
    shop_id: shopId,
    is_registered: true,
    role: "owner",
  })

  return {
    Authorization: `Bearer ${tokens.access_token}`,
  }
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let authHeaders: Record<string, string>
    let shopId: string
    let phoneNumber: string

    beforeEach(async () => {
      phoneNumber = `+2547${Date.now().toString().slice(-8)}`
      shopId = `shop_${randomUUID().replace(/-/g, "").slice(0, 24)}`
      const shopService = getContainer().resolve(
        SHOP_MODULE
      ) as ShopModuleService

      await shopService.createShops({
        id: shopId,
        shop_name: "Settings Test Shop",
        owner_phone_hash: hashPhone(phoneNumber),
        owner_name: "Asha",
        region_code: "47",
        ward_code: "001",
        address: "Market Street",
        business_license: "LIC-22",
        category: "retail",
        consent_given: true,
        consent_timestamp: new Date(),
        consent_version: "2026-04",
        data_sharing_consent: false,
        analytics_consent: true,
        is_active: true,
        mpesa_phone: "254712345678",
        accept_mpesa: true,
      } as unknown as Record<string, unknown>)

      authHeaders = buildAuthHeaders(shopId, phoneNumber)
    })

    describe("POS settings", () => {
      it("updates profile and payment settings", async () => {
        const profileResponse = await api.patch(
          `/pos/shops/${shopId}/profile`,
          {
            shop_name: "Updated Duka",
            owner_name: "John Mwangi",
            address: "New Stage",
            business_license: "LIC-99",
          },
          { headers: authHeaders }
        )

        expect(profileResponse.status).toBe(200)
        expect(profileResponse.data.profile).toEqual(
          expect.objectContaining({
            shop_name: "Updated Duka",
            owner_name: "John Mwangi",
            address: "New Stage",
            business_license: "LIC-99",
            owner_phone: phoneNumber,
          })
        )

        const paymentResponse = await api.patch(
          `/pos/shops/${shopId}/payment-settings`,
          {
            mpesa_phone: "0712345678",
            mpesa_till: "123456",
            mpesa_display_name: "Updated Till",
          },
          { headers: authHeaders }
        )

        expect(paymentResponse.status).toBe(200)
        expect(paymentResponse.data.payment_settings).toEqual(
          expect.objectContaining({
            mpesa_phone: "254712345678",
            mpesa_till: "123456",
            mpesa_display_name: "Updated Till",
          })
        )
      })

      it("updates privacy consent and exports account data", async () => {
        const consentResponse = await api.post(
          "/pos/consent",
          {
            data_collection: true,
            data_sharing: true,
            analytics: false,
            consent_version: "2026-05",
          },
          { headers: authHeaders }
        )

        expect(consentResponse.status).toBe(200)
        expect(consentResponse.data.consent).toEqual(
          expect.objectContaining({
            data_collection: true,
            data_sharing: true,
            analytics: false,
            consent_version: "2026-05",
          })
        )

        const exportResponse = await api.get("/pos/export-data", {
          headers: authHeaders,
        })

        expect(exportResponse.status).toBe(200)
        expect(exportResponse.data.data).toEqual(
          expect.objectContaining({
            profile: expect.objectContaining({
              id: shopId,
            }),
            payment_settings: expect.objectContaining({
              mpesa_phone: "254712345678",
            }),
            privacy_consent: expect.objectContaining({
              data_sharing: true,
            }),
          })
        )
      })

      it("fully deletes the account data on delete", async () => {
        const createProductResponse = await api.post(
          "/pos/products",
          {
            name: "Delete Me Flour",
            category: "groceries",
            inventory_type: "discrete",
            purchase_unit: "bag",
            purchase_value: 1,
            cost_per_purchase: 180,
            selling_units: [
              {
                unit: "bag",
                price: 220,
                conversion_value: 1,
              },
            ],
            low_stock_threshold: 2,
            is_active: true,
            stock_remaining: 4,
          },
          { headers: authHeaders }
        )

        expect(createProductResponse.status).toBe(201)
        const createdVariantId = createProductResponse.data.product.variant_id as string

        const response = await api.post(
          "/pos/delete-account",
          {
            reason: "No longer needed",
            timestamp: new Date().toISOString(),
          },
          { headers: authHeaders }
        )

        expect(response.status).toBe(200)
        expect(response.data.success).toBe(true)

        const shopService = getContainer().resolve(
          SHOP_MODULE
        ) as ShopModuleService
        const [, shopCount] = await shopService.listAndCountShops(
          { id: shopId },
          { take: 1 }
        )

        expect(shopCount).toBe(0)

        const inventoryConfigService = getContainer().resolve(
          INVENTORY_CONFIG_MODULE
        ) as InventoryConfigModuleService
        const configs = await inventoryConfigService.listInventoryConfigs({
          variant_id: createdVariantId,
        })
        expect(configs).toHaveLength(1)
        expect(configs[0]).toEqual(
          expect.objectContaining({
            is_active: false,
          })
        )
      })
    })
  },
})
