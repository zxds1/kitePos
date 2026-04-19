jest.mock("../../../auth/_utils/jwt", () => ({
  authenticatePosJwt: jest.fn(),
}))

jest.mock("../../../admin/inventory/batch-sales/route", () => ({
  POST: jest.fn(),
}))

jest.mock("../../_utils/terminals", () => ({
  listShopTerminals: jest.fn(),
  canUseTerminal: jest.requireActual("../../_utils/terminals").canUseTerminal,
}))

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import { GET, POST } from "../route"
import { authenticatePosJwt } from "../../../auth/_utils/jwt"
import { POST as adminBatchSales } from "../../../admin/inventory/batch-sales/route"
import { listShopTerminals } from "../../_utils/terminals"

const mockedAuthenticatePosJwt = jest.mocked(authenticatePosJwt)
const mockedAdminBatchSales = jest.mocked(adminBatchSales)
const mockedListShopTerminals = jest.mocked(listShopTerminals)

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as MedusaResponse & {
    status: jest.Mock
    json: jest.Mock
  }
}

describe("/pos/sales route", () => {
  beforeEach(() => {
    mockedAuthenticatePosJwt.mockReset()
    mockedAdminBatchSales.mockReset()
    mockedListShopTerminals.mockReset()
  })

  describe("GET", () => {
    it("allows owners to read sales across locations and returns grouped sales", async () => {
      const saleSnapshotService = {
        listAndCountSaleSnapshots: jest.fn().mockResolvedValue([
          [
            {
              id: "snapshot_1",
              order_id: "order_1",
              location_id: "loc_1",
              terminal_id: "term_1",
              payment_method: "cash",
              amount_paid: 120,
              price_charged: 120,
              quantity_sold: 2,
              timestamp: "2026-04-19T10:00:00.000Z",
            },
            {
              id: "snapshot_2",
              order_id: "order_1",
              location_id: "loc_1",
              terminal_id: "term_1",
              payment_method: "cash",
              amount_paid: 0,
              price_charged: 80,
              quantity_sold: 1,
              timestamp: "2026-04-19T10:00:00.000Z",
            },
          ],
          2,
        ]),
      }
      const req = {
        query: {
          location_id: "loc_1",
          terminal_id: "term_1",
          limit: "10",
        },
        scope: {
          resolve: jest.fn((key: string) =>
            key === SALE_SNAPSHOT_MODULE ? saleSnapshotService : null
          ),
        },
      } as unknown as MedusaRequest
      const res = createResponse()

      mockedAuthenticatePosJwt.mockReturnValue({
        phone_number: "+254700000111",
        shop_id: "shop_auth",
        is_registered: true,
        role: "owner",
      })
      mockedListShopTerminals.mockResolvedValue([
        {
          id: "term_1",
          shop_id: "shop_auth",
          location_id: "loc_1",
          name: "Front Counter",
          code: "FC1",
        },
      ])

      await GET(req, res)

      expect(mockedListShopTerminals).toHaveBeenCalledWith(req.scope, "shop_auth")
      expect(saleSnapshotService.listAndCountSaleSnapshots).toHaveBeenCalledWith(
        {
          shop_id: "shop_auth",
          location_id: "loc_1",
          terminal_id: "term_1",
        },
        expect.objectContaining({
          take: 500,
        })
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        sales: [
          expect.objectContaining({
            order_id: "order_1",
            total_amount: 200,
            quantity_total: 3,
            item_count: 2,
          }),
        ],
      })
    })

    it("blocks workers from reading sales outside their assigned location", async () => {
      const req = {
        query: {
          location_id: "loc_denied",
        },
        scope: {
          resolve: jest.fn(),
        },
      } as unknown as MedusaRequest
      const res = createResponse()

      mockedAuthenticatePosJwt.mockReturnValue({
        phone_number: "+254700000222",
        shop_id: "shop_auth",
        is_registered: true,
        role: "cashier",
        assigned_location_ids: ["loc_allowed"],
      })

      await GET(req, res)

      expect(mockedListShopTerminals).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Location access denied",
      })
    })

    it("blocks workers from reading sales from unassigned terminals", async () => {
      const req = {
        query: {
          location_id: "loc_1",
          terminal_id: "term_denied",
        },
        scope: {
          resolve: jest.fn(),
        },
      } as unknown as MedusaRequest
      const res = createResponse()

      mockedAuthenticatePosJwt.mockReturnValue({
        phone_number: "+254700000222",
        shop_id: "shop_auth",
        is_registered: true,
        role: "cashier",
        assigned_location_ids: ["loc_1"],
        assigned_terminal_ids: ["term_allowed"],
      })
      mockedListShopTerminals.mockResolvedValue([
        {
          id: "term_denied",
          shop_id: "shop_auth",
          location_id: "loc_1",
          name: "Side Counter",
          code: "SC1",
        },
      ])

      await GET(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Checkout access denied",
      })
    })
  })

  describe("POST", () => {
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
})
