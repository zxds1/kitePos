jest.mock("../../../auth/_utils/jwt", () => ({
  authenticatePosJwt: jest.fn(),
}))

jest.mock("../_shared", () => ({
  AnalyticsQuerySchema: {
    safeParse: jest.fn(),
  },
  buildAnalyticsSummary: jest.fn(),
}))

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GET } from "../route"
import { authenticatePosJwt } from "../../../auth/_utils/jwt"
import { AnalyticsQuerySchema, buildAnalyticsSummary } from "../_shared"

const mockedAuthenticatePosJwt = jest.mocked(authenticatePosJwt)
const mockedSafeParse = jest.mocked(AnalyticsQuerySchema.safeParse)
const mockedBuildAnalyticsSummary = jest.mocked(buildAnalyticsSummary)

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as MedusaResponse & {
    status: jest.Mock
    json: jest.Mock
  }
}

describe("GET /pos/analytics", () => {
  beforeEach(() => {
    mockedAuthenticatePosJwt.mockReset()
    mockedSafeParse.mockReset()
    mockedBuildAnalyticsSummary.mockReset()
  })

  it("auto-scopes worker analytics to their only assigned branch when location is omitted", async () => {
    const req = {
      query: {},
    } as unknown as MedusaRequest
    const res = createResponse()

    mockedAuthenticatePosJwt.mockReturnValue({
      phone_number: "+254700000333",
      shop_id: "shop_auth",
      is_registered: true,
      role: "cashier",
      assigned_location_ids: ["loc_1"],
    })
    mockedSafeParse.mockReturnValue({
      success: true,
      data: {
        start_date: new Date("2026-04-01T00:00:00.000Z"),
        end_date: new Date("2026-04-19T00:00:00.000Z"),
        sales_channel: "all",
      },
    } as any)
    mockedBuildAnalyticsSummary.mockResolvedValue({
      generated_at: new Date().toISOString(),
      sales_summary: {},
    } as any)

    await GET(req, res)

    expect(mockedBuildAnalyticsSummary).toHaveBeenCalledWith(
      req,
      "shop_auth",
      new Date("2026-04-01T00:00:00.000Z"),
      new Date("2026-04-19T00:00:00.000Z"),
      expect.objectContaining({
        locationId: "loc_1",
        salesChannel: "all",
      })
    )
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it("rejects worker analytics when no branch scope is supplied and multiple branches are assigned", async () => {
    const req = {
      query: {},
    } as unknown as MedusaRequest
    const res = createResponse()

    mockedAuthenticatePosJwt.mockReturnValue({
      phone_number: "+254700000333",
      shop_id: "shop_auth",
      is_registered: true,
      role: "cashier",
      assigned_location_ids: ["loc_1", "loc_2"],
    })
    mockedSafeParse.mockReturnValue({
      success: true,
      data: {
        start_date: new Date("2026-04-01T00:00:00.000Z"),
        end_date: new Date("2026-04-19T00:00:00.000Z"),
        sales_channel: "all",
      },
    } as any)

    await GET(req, res)

    expect(mockedBuildAnalyticsSummary).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Worker analytics must be scoped to an assigned branch",
    })
  })
})
