import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../../auth/_utils/jwt"
import { SHOP_MODULE } from "../../../../../modules/shop"
import type ShopModuleService from "../../../../../modules/shop/service"
import { getAuthorizedShop } from "../../../settings/_utils"
import { RAGRouterService } from "../../../../../services/rag-router.service"

const UploadSchema = z.object({
  document_type: z.enum(["receipt", "invoice", "catalog", "policy"]),
  file_name: z.string().trim().min(1).default("document.pdf"),
  file_base64: z.string().trim().min(1),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = UploadSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid document upload payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const shop = await getAuthorizedShop(shopService, auth.shop_id)
  if (!shop) {
    res.status(404).json({ success: false, message: "Shop not found" })
    return
  }

  const fileBuffer = Buffer.from(parsed.data.file_base64, "base64")
  const result = await new RAGRouterService(req.scope).uploadDocument({
    file: fileBuffer,
    fileName: parsed.data.file_name,
    shopId: auth.shop_id,
    shopName: String(shop.shop_name ?? "Trace Shop"),
    documentType: parsed.data.document_type,
  })

  res.status(200).json({
    success: true,
    document: result,
  })
}
