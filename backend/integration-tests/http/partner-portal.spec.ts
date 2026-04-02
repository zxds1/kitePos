import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import axios from "axios"
import { SHOP_MODULE } from "../../src/modules/shop"
import type ShopModuleService from "../../src/modules/shop/service"
import { SALE_SNAPSHOT_MODULE } from "../../src/modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../src/modules/sale-snapshot/service"
import { PARTNER_MODULE } from "../../src/modules/partner"
import type PartnerModuleService from "../../src/modules/partner/service"
import { DATA_EXPORT_LOG_MODULE } from "../../src/modules/data-export-log"
import type DataExportLogModuleService from "../../src/modules/data-export-log/service"
import { hashPhone, hashSecret } from "../../src/utils/hash"
import { POST as createPartnerHandler } from "../../src/api/partners/admin/create/route"
import { GET as listPartnersHandler } from "../../src/api/partners/admin/partners/route"
import { GET as complianceReportHandler } from "../../src/api/partners/admin/compliance-report/route"

jest.setTimeout(90 * 1000)

type MockResponseState<T> = {
  statusCode: number
  body: T | null
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
    send(payload: T) {
      state.body = payload
      return this
    },
    setHeader() {
      return this
    },
  } as unknown as MedusaResponse<T>

  return { response, state }
}

async function invokeCreatePartner(
  scope: MedusaRequest["scope"],
  body: Record<string, unknown>
) {
  const { response, state } = createMockResponse<Record<string, unknown>>()

  await createPartnerHandler(
    {
      scope,
      body,
    } as MedusaRequest,
    response
  )

  return state
}

async function invokePartnerList(scope: MedusaRequest["scope"]) {
  const { response, state } = createMockResponse<Record<string, unknown>>()

  await listPartnersHandler(
    {
      scope,
    } as MedusaRequest,
    response
  )

  return state
}

async function invokeComplianceReport(
  scope: MedusaRequest["scope"],
  query: Record<string, unknown>
) {
  const { response, state } = createMockResponse<Record<string, unknown>>()

  await complianceReportHandler(
    {
      scope,
      query,
    } as MedusaRequest,
    response
  )

  return state
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let partnerApiKey: string
    let partnerId: string

    beforeEach(async () => {
      const shopService = getContainer().resolve(SHOP_MODULE) as ShopModuleService
      const saleSnapshotService = getContainer().resolve(
        SALE_SNAPSHOT_MODULE
      ) as SaleSnapshotModuleService

      const consentingShops = Array.from({ length: 12 }).map((_, index) => {
        const phone = `+2547${(Date.now() + index).toString().slice(-8)}`
        return {
          id: `shop_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
          shop_name: `Partner Nairobi ${index + 1}`,
          owner_phone_hash: hashPhone(phone),
          region_code: "NAI",
          ward_code: `W${String(index + 1).padStart(3, "0")}`,
          category: "retail",
          consent_given: true,
          data_sharing_consent: true,
          analytics_consent: true,
          consent_timestamp: new Date(),
          is_active: true,
          accept_mpesa: true,
        }
      })

      const belowThresholdShops = Array.from({ length: 5 }).map((_, index) => {
        const phone = `+2547${(Date.now() + 100 + index).toString().slice(-8)}`
        return {
          id: `shop_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
          shop_name: `Partner Small ${index + 1}`,
          owner_phone_hash: hashPhone(phone),
          region_code: "SML",
          ward_code: `S${String(index + 1).padStart(3, "0")}`,
          category: "retail",
          consent_given: true,
          data_sharing_consent: true,
          analytics_consent: true,
          consent_timestamp: new Date(),
          is_active: true,
          accept_mpesa: true,
        }
      })

      await shopService.createShops(
        [...consentingShops, ...belowThresholdShops] as unknown as Record<string, unknown>
      )

      for (const shop of consentingShops) {
        await saleSnapshotService.createSaleSnapshots({
          client_transaction_id: `partner-sale:${randomUUID()}`,
          order_id: `order:${randomUUID()}`,
          line_item_id: `line:${randomUUID()}`,
          shop_id: shop.id,
          location_id: null,
          terminal_id: null,
          variant_id: "variant_shared_sugar",
          sales_channel: "partner-test",
          inventory_type: "groceries",
          unit_sold: "200g",
          quantity_sold: 2,
          conversion_factor_snapshot: 1,
          deduction_value: 2,
          price_charged: 80,
          payment_method: "mpesa",
          amount_paid: 80,
          stock_before: 20,
          stock_after: 18,
          timestamp: new Date(),
        } as unknown as Record<string, unknown>)
      }

      for (const shop of belowThresholdShops) {
        await saleSnapshotService.createSaleSnapshots({
          client_transaction_id: `partner-small:${randomUUID()}`,
          order_id: `order:${randomUUID()}`,
          line_item_id: `line:${randomUUID()}`,
          shop_id: shop.id,
          location_id: null,
          terminal_id: null,
          variant_id: "variant_shared_sugar",
          sales_channel: "partner-test",
          inventory_type: "groceries",
          unit_sold: "200g",
          quantity_sold: 1,
          conversion_factor_snapshot: 1,
          deduction_value: 1,
          price_charged: 50,
          payment_method: "cash",
          amount_paid: 50,
          stock_before: 12,
          stock_after: 11,
          timestamp: new Date(),
        } as unknown as Record<string, unknown>)
      }

      const partnerService = getContainer().resolve(PARTNER_MODULE) as PartnerModuleService
      const apiKey = `partner_${randomUUID().replace(/-/g, "")}`
      const [partner] = await partnerService.createPartners([
        {
          name: "Coca-Cola EA",
          contact_email: "partner@example.com",
          billing_email: "billing@example.com",
          api_key_hash: hashSecret(apiKey, "partner_api_key"),
          api_key_last4: apiKey.slice(-4),
          permissions: {
            regions: ["NAI", "SML"],
            data_types: ["sales", "products"],
          },
          rate_limit: 100,
          quota_monthly: 100,
          billing_tier: "premium",
          is_active: true,
          is_verified: true,
        },
      ])

      partnerApiKey = apiKey
      partnerId = partner.id
    })

    describe("partner portal", () => {
      it("authenticates the partner and returns quota metadata", async () => {
        const response = await api.get("/partners/auth", {
          headers: {
            "X-Partner-API-Key": partnerApiKey,
          },
        })

        expect(response.status).toBe(200)
        expect(response.data.partner).toEqual(
          expect.objectContaining({
            id: partnerId,
            name: "Coca-Cola EA",
            billing_tier: "premium",
            quota_monthly: 100,
          })
        )
      })

      it("exports aggregated sales without PII and enforces the privacy threshold", async () => {
        const startDate = new Date(Date.now() - 60_000).toISOString()
        const endDate = new Date(Date.now() + 60_000).toISOString()

        const response = await api.get("/partners/data/sales", {
          headers: {
            "X-Partner-API-Key": partnerApiKey,
          },
          params: {
            start_date: startDate,
            end_date: endDate,
            regions: "NAI,SML",
            group_by: "region",
            format: "json",
          },
        })

        expect(response.status).toBe(200)
        expect(response.data.success).toBe(true)
        expect(response.data.data).toHaveLength(1)
        expect(response.data.data[0]).toEqual(
          expect.objectContaining({
            key: "NAI",
            total_transactions: 12,
            shop_count: 12,
          })
        )
        expect(response.data.data[0]).not.toHaveProperty("shop_id")
        expect(response.data.data[0]).not.toHaveProperty("owner_phone")
      })

      it("returns usage and compliance logs after a successful export", async () => {
        const startDate = new Date(Date.now() - 60_000).toISOString()
        const endDate = new Date(Date.now() + 60_000).toISOString()

        const exportResponse = await api.get("/partners/data/sales", {
          headers: {
            "X-Partner-API-Key": partnerApiKey,
          },
          params: {
            start_date: startDate,
            end_date: endDate,
            regions: "NAI",
            group_by: "region",
            format: "json",
          },
        })

        expect(exportResponse.status).toBe(200)

        const usageResponse = await api.get("/partners/usage", {
          headers: {
            "X-Partner-API-Key": partnerApiKey,
          },
        })

        expect(usageResponse.status).toBe(200)
        expect(usageResponse.data.usage.quota_used).toBeGreaterThan(0)
        expect(usageResponse.data.usage.recent_exports).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              data_type: "sales",
              status: "completed",
            }),
          ])
        )

        const dataExportLogService = getContainer().resolve(
          DATA_EXPORT_LOG_MODULE
        ) as DataExportLogModuleService
        const logs = await dataExportLogService.listDataExportLogs({
          partner_id: partnerId,
        })

        expect(logs).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              partner_id: partnerId,
              data_type: "sales",
              consent_verified: true,
              aggregation_threshold_met: true,
              pii_filtered: true,
              status: "completed",
            }),
          ])
        )
      })

      it("rejects over-quota exports with 429 and logs them as rejected", async () => {
        const partnerService = getContainer().resolve(PARTNER_MODULE) as PartnerModuleService
        await partnerService.updatePartners([
          {
            id: partnerId,
            quota_monthly: 0,
          },
        ])

        const startDate = new Date(Date.now() - 60_000).toISOString()
        const endDate = new Date(Date.now() + 60_000).toISOString()

        let responseStatus = 0
        let responseData: Record<string, unknown> = {}

        try {
          await api.get("/partners/data/sales", {
            headers: {
              "X-Partner-API-Key": partnerApiKey,
            },
            params: {
              start_date: startDate,
              end_date: endDate,
              regions: "NAI",
              group_by: "region",
              format: "json",
            },
          })
        } catch (error) {
          if (!axios.isAxiosError(error) || !error.response) {
            throw error
          }
          responseStatus = error.response.status
          responseData = error.response.data as Record<string, unknown>
        }

        expect(responseStatus).toBe(429)
        expect(String(responseData.message ?? "")).toMatch(/quota exceeded/i)

        const dataExportLogService = getContainer().resolve(
          DATA_EXPORT_LOG_MODULE
        ) as DataExportLogModuleService
        const logs = await dataExportLogService.listDataExportLogs({
          partner_id: partnerId,
          status: "rejected",
        })

        expect(logs.length).toBeGreaterThan(0)
      })

      it("creates a partner from the admin handler and includes it in the admin list/report handlers", async () => {
        const createState = await invokeCreatePartner(getContainer(), {
          name: "Twiga Foods",
          contact_email: "twiga@example.com",
          billing_email: "finance@twiga.example.com",
          billing_tier: "basic",
          permissions: {
            regions: ["NAI"],
            data_types: ["sales"],
          },
          rate_limit: 25,
          quota_monthly: 250,
        })

        expect(createState.statusCode).toBe(201)
        expect(createState.body?.success).toBe(true)
        expect(createState.body?.api_key).toEqual(expect.any(String))

        const listState = await invokePartnerList(getContainer())
        expect(listState.statusCode).toBe(200)
        expect(listState.body?.partners).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: "Twiga Foods",
              billing_tier: "basic",
            }),
          ])
        )

        await api.get("/partners/data/sales", {
          headers: {
            "X-Partner-API-Key": partnerApiKey,
          },
          params: {
            start_date: new Date(Date.now() - 60_000).toISOString(),
            end_date: new Date(Date.now() + 60_000).toISOString(),
            regions: "NAI",
            group_by: "region",
            format: "json",
          },
        })

        const reportState = await invokeComplianceReport(getContainer(), {
          start_date: new Date(Date.now() - 86_400_000).toISOString(),
          end_date: new Date(Date.now() + 86_400_000).toISOString(),
        })

        expect(reportState.statusCode).toBe(200)
        expect(reportState.body?.report).toEqual(
          expect.objectContaining({
            total_exports: expect.any(Number),
            consent_compliance_rate: 100,
            aggregation_compliance_rate: 100,
          })
        )
      })
    })
  },
})
