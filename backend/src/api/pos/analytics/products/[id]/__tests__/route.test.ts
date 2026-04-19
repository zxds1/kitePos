jest.mock("../../../../../auth/_utils/jwt", () => ({
  authenticatePosJwt: jest.fn(),
}))

jest.mock("../../../_shared", () => ({
  AnalyticsQuerySchema: {
    safeParse: jest.fn(),
  },
  buildProductAnalyticsDetail: jest.fn(),
}))

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GET } from "../route"
import { authenticatePosJwt } from "../../../../../auth/_utils/jwt"
import {
  AnalyticsQuerySchema,
  buildProductAnalyticsDetail,
} from "../../../_shared"

const mockedAuthenticatePosJwt = jest.mocked(authenticatePosJwt)
const mockedSafeParse = jest.mocked(AnalyticsQuerySchema.safeParse)
const mockedBuildProductAnalyticsDetail = jest.mocked(buildProductAnalyticsDetail)

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as MedusaResponse & {
    status: jest.Mock
    json: jest.Mock
  }
}

describe("GET /pos/analytics/products/:id", () => {
  beforeEach(() => {
    mockedAuthenticatePosJwt.mockReset()
    mockedSafeParse.mockReset()
    mockedBuildProductAnalyticsDetail.mockReset()
  })

  it("rejects worker product analytics when an unauthorized branch is requested", async () => {
    const req = {
      params: { id: "variant_1" },
      query: {
        location_id: "loc_denied",
      },
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
        location_id: "loc_denied",
        sales_channel: "all",
      },
    } as any)

    await GET(req, res)

    expect(mockedBuildProductAnalyticsDetail).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Location analytics access denied",
    })
  })
})
