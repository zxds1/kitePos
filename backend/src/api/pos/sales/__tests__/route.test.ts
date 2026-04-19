jest.mock("../../../auth/_utils/jwt", () => ({
  authenticatePosJwt: jest.fn(),
}))

jest.mock("../../../admin/inventory/batch-sales/route", () => ({
  POST: jest.fn(),
}))

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { POST } from "../route"
import { authenticatePosJwt } from "../../../auth/_utils/jwt"
import { POST as adminBatchSales } from "../../../admin/inventory/batch-sales/route"

const mockedAuthenticatePosJwt = jest.mocked(authenticatePosJwt)
const mockedAdminBatchSales = jest.mocked(adminBatchSales)

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as MedusaResponse & {
    status: jest.Mock
    json: jest.Mock
  }
}

describe("POST /pos/sales", () => {
  beforeEach(() => {
    mockedAuthenticatePosJwt.mockReset()
    mockedAdminBatchSales.mockReset()
  })

  it("injects the authenticated shop id before delegating to the admin batch route", async () => {
    const req = {
      headers: {
        authorization: "Bearer token",
      },
      body: {
        location_id: "loc_1",
        terminal_id: "term_1",
        sales: [
          {
            client_transaction_id: "txn_1",
            variant_id: "variant_1",
            shop_id: "client-shop-ignored",
            location_id: "loc_1",
            terminal_id: "term_1",
            inventory_type: "discrete",
            unit_sold: "piece",
            quantity_sold: 1,
            conversion_factor_snapshot: 1,
            deduction_value: 1,
            stock_before: 5,
            stock_after: 4,
            price_charged: 120,
            amount_paid: 120,
            timestamp: "2026-04-19T09:00:00.000Z",
          },
        ],
      },
    } as MedusaRequest & { validatedBody?: unknown }
    const res = createResponse()

    mockedAuthenticatePosJwt.mockReturnValue({
      phone_number: "+254700000111",
      shop_id: "shop_auth",
      is_registered: true,
      role: "owner",
    })

    await POST(req, res)

    expect(mockedAdminBatchSales).toHaveBeenCalledTimes(1)
    expect(req.validatedBody).toMatchObject({
      shop_id: "shop_auth",
      location_id: "loc_1",
      terminal_id: "term_1",
    })
    expect(res.status).not.toHaveBeenCalledWith(400)
  })

  it("rejects malformed sync payloads before delegation", async () => {
    const req = {
      body: {
        sales: [],
      },
    } as MedusaRequest
    const res = createResponse()

    mockedAuthenticatePosJwt.mockReturnValue({
      phone_number: "+254700000111",
      shop_id: "shop_auth",
      is_registered: true,
      role: "owner",
    })

    await POST(req, res)

    expect(mockedAdminBatchSales).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Invalid request format",
      })
    )
  })
})
