import jwt from "jsonwebtoken"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export type PosAuthTokenPayload = {
  phone_number: string
  shop_id: string | null
  is_registered: boolean
  user_id?: string | null
  role?: "owner" | "admin" | "branch_manager" | "cashier" | null
  assigned_location_ids?: string[]
  assigned_terminal_ids?: string[]
  actor_id?: string
  actor_type?: "user" | "api-key"
  auth_identity_id?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
  type?: "access" | "refresh"
}

export type PosAuthenticatedRequest = MedusaRequest & {
  auth_context?: PosAuthTokenPayload
}

const ACCESS_TOKEN_TTL = 60 * 60 * 24
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7

function getJwtSecret() {
  return process.env.JWT_SECRET || "supersecret"
}

export function issuePosAuthTokens(payload: PosAuthTokenPayload) {
  const secret = getJwtSecret()
  const actorId = payload.user_id || payload.shop_id || payload.phone_number
  const authPayload = {
    ...payload,
    actor_id: actorId,
    actor_type: "user" as const,
    auth_identity_id: payload.phone_number,
    app_metadata: payload.app_metadata ?? {},
    user_metadata: payload.user_metadata ?? {},
  }

  const access_token = jwt.sign(
    {
      ...authPayload,
      type: "access",
    },
    secret,
    {
      expiresIn: ACCESS_TOKEN_TTL,
    }
  )

  const refresh_token = jwt.sign(
    {
      ...authPayload,
      type: "refresh",
    },
    secret,
    {
      expiresIn: REFRESH_TOKEN_TTL,
    }
  )

  return {
    access_token,
    refresh_token,
    expires_in: ACCESS_TOKEN_TTL,
  }
}

export function authenticatePosJwt(
  req: PosAuthenticatedRequest,
  res: MedusaResponse
) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Access token required",
    })
    return null
  }

  const token = authHeader.slice("Bearer ".length)

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as PosAuthTokenPayload

    if (decoded.type && decoded.type !== "access") {
      res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      })
      return null
    }

    req.auth_context = decoded
    return decoded
  } catch (_) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    })
    return null
  }
}
