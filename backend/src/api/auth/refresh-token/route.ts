import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { issuePosAuthTokens, verifyPosRefreshToken } from "../_utils/jwt"
import { AuthRefreshToken } from "../validators"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = AuthRefreshToken.parse(req.validatedBody ?? req.body)

  let payload
  try {
    payload = verifyPosRefreshToken(body.refresh_token)
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Invalid or expired refresh token",
    })
    return
  }

  const tokens = issuePosAuthTokens({
    phone_number: payload.phone_number,
    shop_id: payload.shop_id ?? null,
    is_registered: payload.is_registered ?? false,
    user_id: payload.user_id ?? null,
    role: payload.role ?? null,
    assigned_location_ids: payload.assigned_location_ids ?? [],
    assigned_terminal_ids: payload.assigned_terminal_ids ?? [],
  })

  res.status(200).json({
    success: true,
    ...tokens,
  })
}
