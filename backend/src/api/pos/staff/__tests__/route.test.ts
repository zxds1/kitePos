jest.mock("../../../auth/_utils/jwt", () => ({
  authenticatePosJwt: jest.fn(),
}))

jest.mock("../../_utils/shop-locations", () => ({
  listShopLocations: jest.fn(),
}))

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP_USER_MODULE } from "../../../../modules/shop-user"
import { GET } from "../route"
import { authenticatePosJwt } from "../../../auth/_utils/jwt"
import { listShopLocations } from "../../_utils/shop-locations"

const mockedAuthenticatePosJwt = jest.mocked(authenticatePosJwt)
const mockedListShopLocations = jest.mocked(listShopLocations)

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as MedusaResponse & {
    status: jest.Mock
    json: jest.Mock
  }
}

describe("GET /pos/staff", () => {
  beforeEach(() => {
    mockedAuthenticatePosJwt.mockReset()
    mockedListShopLocations.mockReset()
  })

  it("rejects workers from staff management", async () => {
    const req = {
      scope: {
        resolve: jest.fn(),
      },
    } as unknown as MedusaRequest
    const res = createResponse()

    mockedAuthenticatePosJwt.mockReturnValue({
      phone_number: "+254700000333",
      shop_id: "shop_auth",
      is_registered: true,
      role: "cashier",
      user_id: "user_cashier",
    })

    await GET(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Only owner or admin can view staff management",
    })
  })

  it("allows owners to view staff management", async () => {
    const shopUserService = {
      listAndCountShopUsers: jest.fn().mockResolvedValue([
        [
          {
            id: "user_1",
            shop_id: "shop_auth",
            full_name: "Cashier One",
            role: "cashier",
            assigned_location_ids: ["loc_1"],
            assigned_terminal_ids: ["term_1"],
            is_active: true,
            pin_hash: "hashed",
          },
        ],
        1,
      ]),
    }
    const req = {
      scope: {
        resolve: jest.fn((key: string) =>
          key === SHOP_USER_MODULE ? shopUserService : null
        ),
      },
    } as unknown as MedusaRequest
    const res = createResponse()

    mockedAuthenticatePosJwt.mockReturnValue({
      phone_number: "+254700000111",
      shop_id: "shop_auth",
      is_registered: true,
      role: "owner",
      user_id: "user_owner",
    })
    mockedListShopLocations.mockResolvedValue([
      {
        id: "loc_1",
        name: "Main Branch",
        code: "MAIN",
        is_default: true,
        location_type: "physical",
      },
    ] as any)

    await GET(req, res)

    expect(shopUserService.listAndCountShopUsers).toHaveBeenCalledWith(
      { shop_id: "shop_auth" },
      expect.objectContaining({
        take: 200,
      })
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      staff: [
        expect.objectContaining({
          id: "user_1",
          role: "cashier",
          is_active: true,
        }),
      ],
      locations: [
        {
          id: "loc_1",
          name: "Main Branch",
          code: "MAIN",
          is_default: true,
          location_type: "physical",
        },
      ],
    })
  })
})
