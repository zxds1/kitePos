jest.mock("../_utils/jwt", () => ({
  issuePosAuthTokens: jest.fn(),
  verifyPosRefreshToken: jest.fn(),
}))

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { POST } from "../refresh-token/route"
import {
  issuePosAuthTokens,
  verifyPosRefreshToken,
} from "../_utils/jwt"

const mockedIssuePosAuthTokens = jest.mocked(issuePosAuthTokens)
const mockedVerifyPosRefreshToken = jest.mocked(verifyPosRefreshToken)

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as MedusaResponse & {
    status: jest.Mock
    json: jest.Mock
  }
}

describe("POST /auth/refresh-token", () => {
  beforeEach(() => {
    mockedIssuePosAuthTokens.mockReset()
    mockedVerifyPosRefreshToken.mockReset()
  })

  it("issues a fresh token pair from a valid refresh token", async () => {
    const req = {
      body: {
        refresh_token: "refresh-token",
      },
    } as MedusaRequest
    const res = createResponse()

    mockedVerifyPosRefreshToken.mockReturnValue({
      phone_number: "+254700000111",
      shop_id: "shop_123",
      is_registered: true,
      user_id: "user_123",
      role: "owner",
      assigned_location_ids: ["loc_1"],
      assigned_terminal_ids: ["term_1"],
      type: "refresh",
    })
    mockedIssuePosAuthTokens.mockReturnValue({
      access_token: "access-next",
      refresh_token: "refresh-next",
      expires_in: 86400,
    })

    await POST(req, res)

    expect(mockedVerifyPosRefreshToken).toHaveBeenCalledWith("refresh-token")
    expect(mockedIssuePosAuthTokens).toHaveBeenCalledWith({
      phone_number: "+254700000111",
      shop_id: "shop_123",
      is_registered: true,
      user_id: "user_123",
      role: "owner",
      assigned_location_ids: ["loc_1"],
      assigned_terminal_ids: ["term_1"],
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      access_token: "access-next",
      refresh_token: "refresh-next",
      expires_in: 86400,
    })
  })

  it("rejects invalid refresh tokens", async () => {
    const req = {
      body: {
        refresh_token: "bad-token-123",
      },
    } as MedusaRequest
    const res = createResponse()

    mockedVerifyPosRefreshToken.mockImplementation(() => {
      throw new Error("Invalid or expired refresh token")
    })

    await POST(req, res)

    expect(mockedIssuePosAuthTokens).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid or expired refresh token",
    })
  })
})
