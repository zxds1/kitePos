import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GET } from "../route"
import { authenticatePartnerRequest, getRequestMetadata } from "../../../_utils/auth"
import { billPartnerExport } from "../../../_utils/billing"
import { DataAggregationService } from "../../../../../services/data-aggregation.service"
import { ComplianceLoggerService } from "../../../../../services/compliance-logger.service"

jest.mock("../../../_utils/auth", () => ({
  authenticatePartnerRequest: jest.fn(),
  getRequestMetadata: jest.fn(),
}))

jest.mock("../../../_utils/billing", () => ({
  billPartnerExport: jest.fn(),
}))

const mockGetAggregatedSales = jest.fn()
const mockToCsv = jest.fn()
const mockLogDataAccess = jest.fn()

jest.mock("../../../../../services/data-aggregation.service", () => ({
  DataAggregationService: jest.fn().mockImplementation(() => ({
    getAggregatedSales: mockGetAggregatedSales,
    toCsv: mockToCsv,
  })),
}))

jest.mock("../../../../../services/compliance-logger.service", () => ({
  ComplianceLoggerService: jest.fn().mockImplementation(() => ({
    logDataAccess: mockLogDataAccess,
  })),
}))

describe("partner sales export route", () => {
  const createRes = () => {
    const res: Partial<MedusaResponse> & {
      status: jest.Mock
      json: jest.Mock
      send: jest.Mock
      setHeader: jest.Mock
    } = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    }
    return res
  }

  const partner = {
    id: "partner_1",
    name: "Partner One",
    billing_tier: "premium",
    billing_email: "billing@example.com",
    stripe_customer_id: "cus_123",
    permissions: {
      regions: ["nairobi"],
      data_types: ["sales"],
    },
    rate_limit: 100,
    quota_monthly: 1000,
    is_active: true,
    is_verified: true,
    api_key_last4: "abcd",
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(authenticatePartnerRequest as jest.Mock).mockResolvedValue({
      ok: true,
      partner,
      quotaRemaining: 100,
      partnerService: {
        enforcePermission: jest.fn(),
      },
      dataExportLogService: {},
    })
    ;(getRequestMetadata as jest.Mock).mockReturnValue({
      ipAddress: "127.0.0.1",
      userAgent: "Jest",
    })
    mockGetAggregatedSales.mockResolvedValue({
      success: true,
      data: [
        {
          key: "nairobi",
          total_revenue: 1000,
          total_transactions: 10,
          shop_count: 2,
          average_transaction_value: 100,
        },
      ],
      metadata: {
        total_shops_included: 2,
      },
    })
    mockToCsv.mockReturnValue("csv")
    mockLogDataAccess.mockResolvedValue({ id: "log_1" })
    ;(billPartnerExport as jest.Mock).mockResolvedValue({
      provider: "stripe",
      status: "succeeded",
      payment_intent_id: "pi_123",
      client_secret: "secret_123",
      stripe_customer_id: "cus_123",
      amount: 1.5,
      currency: "usd",
      description: "Partner sales export (json)",
      metadata: {
        rows_exported: 1,
        price_per_row: 0.02,
      },
    })
  })

  it("charges billing before returning the export payload", async () => {
    const req = {
      query: {
        start_date: "2025-01-01T00:00:00.000Z",
        end_date: "2025-01-31T23:59:59.999Z",
        format: "json",
      },
      scope: {},
    } as Partial<MedusaRequest> as MedusaRequest
    const res = createRes()

    await GET(req, res as MedusaResponse)

    expect(billPartnerExport).toHaveBeenCalledWith({
      partner,
      rowsExported: 1,
      dataType: "sales",
      format: "json",
    })
    expect(mockLogDataAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        billingAmount: 1.5,
        quotaUsed: 1,
      })
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        billing: expect.objectContaining({
          provider: "stripe",
          status: "succeeded",
        }),
      })
    )
  })
})
