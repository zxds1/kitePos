import type { MedusaRequest as BaseMedusaRequest } from "@medusajs/framework/http"

export type PosJwtPayload = {
  phone_number: string
  shop_id: string | null
  is_registered: boolean
  type?: "access" | "refresh"
}

export interface MedusaRequest extends BaseMedusaRequest {
  auth_context?: PosJwtPayload
}
