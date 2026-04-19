jest.mock("../../../auth/_utils/jwt", () => ({
  authenticatePosJwt: jest.fn(),
}))

jest.mock("../../../admin/restocks/route", () => ({
  POST: jest.fn(),
}))

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { POST } from "../route"
import { authenticatePosJwt } from "../../../auth/_utils/jwt"
import { POST as adminCreateRestock } from "../../../admin/restocks/route"

const mockedAuthenticatePosJwt = jest.mocked(authenticatePosJwt)
const mockedAdminCreateRestock = jest.mocked(adminCreateRestock)

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as MedusaResponse & {
    status: jest.Mock
    json: jest.Mock
  }
}

describe("POST /pos/restocks", () => {
  beforeEach(() => {
    mockedAuthenticatePosJwt.mockReset()
    mockedAdminCreateRestock.mockReset()
  })

  it("injects the authenticated shop id into the restock payload", async () => {
    const req = {
      body: {
        location_id: "loc_1",
        variant_id: "variant_1",
        quantity_received: 10,
        purchase_unit_qty: 1,
        cost_per_unit: 25,
        total_cost: 250,
        source: "manual",
        conversion_snapshot: {
          unit: "piece",
        },
        timestamp: "2026-04-19T09:15:00.000Z",
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

    expect(mockedAdminCreateRestock).toHaveBeenCalledTimes(1)
    expect(req.validatedBody).toMatchObject({
      shop_id: "shop_auth",
      location_id: "loc_1",
      variant_id: "variant_1",
    })
    expect(res.status).not.toHaveBeenCalledWith(400)
  })

  it("rejects invalid restock payloads before delegating", async () => {
    const req = {
      body: {
        source: "manual",
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

    expect(mockedAdminCreateRestock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Invalid request format",
      })
    )
  })
})
