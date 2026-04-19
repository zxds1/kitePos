import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../auth/_utils/jwt"
import CloudflareR2Service from "../../../services/cloudflare-r2.service"

const UploadSchema = z.object({
  file_name: z.string().min(1).max(255),
  content_type: z.string().min(1).max(100),
  data_base64: z.string().min(1).max(4_000_000),
  context: z
    .enum(["shop_profile", "user_profile", "product", "receipt", "other"])
    .default("other"),
})

const allowedContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/bmp",
  "image/tiff",
])

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = UploadSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid upload payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  if (!allowedContentTypes.has(parsed.data.content_type)) {
    res.status(400).json({
      success: false,
      message: "Only JPEG, PNG, WEBP, and GIF images are supported",
    })
    return
  }

  const sanitizedBase64 = parsed.data.data_base64.replace(/\s+/g, "")
  let buffer: Buffer

  try {
    buffer = Buffer.from(sanitizedBase64, "base64")
    if (buffer.length <= 0) {
      throw new Error("empty")
    }
    if (buffer.length > 3 * 1024 * 1024) {
      res.status(400).json({
        success: false,
        message: "Image must be 3MB or smaller",
      })
      return
    }
  } catch (_) {
    res.status(400).json({
      success: false,
      message: "Image payload is not valid base64",
    })
    return
  }

  const mediaService = new CloudflareR2Service()
  const upload = await mediaService.uploadImage({
    buffer,
    contentType: parsed.data.content_type,
    fileName: parsed.data.file_name,
    context: parsed.data.context,
    shopId: auth.shop_id,
  })

  res.status(201).json({
    success: true,
    upload: {
      file_name: parsed.data.file_name,
      content_type: parsed.data.content_type,
      context: parsed.data.context,
      url: upload.url,
      key: upload.key,
      bucket: upload.bucket,
    },
  })
}
