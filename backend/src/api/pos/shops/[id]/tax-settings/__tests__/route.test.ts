jest.mock("../../../../../auth/_utils/jwt", () => ({
  authenticatePosJwt: jest.fn(),
}))

jest.mock("../../../../../../services/tax.service", () => ({
  TaxService: jest.fn(),
}))

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GET, PATCH } from "../route"
import { authenticatePosJwt } from "../../../../../auth/_utils/jwt"
import { TaxService } from "../../../../../../services/tax.service"

const mockedAuthenticatePosJwt = jest.mocked(authenticatePosJwt)
const MockedTaxService = jest.mocked(TaxService)

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as MedusaResponse & {
    status: jest.Mock
    json: jest.Mock
  }
}

describe("/pos/shops/:id/tax-settings route", () => {
  beforeEach(() => {
    mockedAuthenticatePosJwt.mockReset()
    MockedTaxService.mockReset()
  })

  describe("GET", () => {
    it("rejects workers from owner-only tax settings", async () => {
      const req = {
        params: { id: "shop_auth" },
        query: {},
      } as unknown as MedusaRequest
      const res = createResponse()

      mockedAuthenticatePosJwt.mockReturnValue({
        phone_number: "+254700000333",
        shop_id: "shop_auth",
        is_registered: true,
        role: "cashier",
      })

      await GET(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Only the owner can access KRA and TIMS credentials",
      })
    })

    it("allows owners to read tax settings", async () => {
      const getEffectiveTaxContext = jest.fn().mockResolvedValue({
        settings: {
          shop_id: "shop_auth",
          kra_pin: "A123456789B",
          tims_enabled: true,
        },
      })
      const req = {
        params: { id: "shop_auth" },
        query: {
          location_id: "loc_1",
        },
        scope: {},
      } as unknown as MedusaRequest
      const res = createResponse()

      mockedAuthenticatePosJwt.mockReturnValue({
        phone_number: "+254700000111",
        shop_id: "shop_auth",
        is_registered: true,
        role: "owner",
      })
      MockedTaxService.mockImplementation(
        () =>
          ({
            getEffectiveTaxContext,
          }) as any
      )

      await GET(req, res)

      expect(getEffectiveTaxContext).toHaveBeenCalledWith("shop_auth", "loc_1")
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        tax_settings: {
          shop_id: "shop_auth",
          kra_pin: "A123456789B",
          tims_enabled: true,
        },
      })
    })
  })

  describe("PATCH", () => {
    it("rejects admins from owner-only tax updates", async () => {
      const req = {
        params: { id: "shop_auth" },
        query: {},
        body: {
          tims_enabled: true,
        },
      } as unknown as MedusaRequest
      const res = createResponse()

      mockedAuthenticatePosJwt.mockReturnValue({
        phone_number: "+254700000222",
        shop_id: "shop_auth",
        is_registered: true,
        role: "admin",
      })

      await PATCH(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Only the owner can update KRA and TIMS credentials",
      })
    })
  })
})
