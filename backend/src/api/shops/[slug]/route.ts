import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  renderStorefrontHtml,
  setStorefrontSecurityHeaders,
  resolveStorefront,
  wantsJson,
} from "../_storefront"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const payload = await resolveStorefront(req, {
    slug: req.params.slug,
    host: req.headers.host,
  })

  if (!payload) {
    res.status(404).send("Storefront not found")
    return
  }

  if (wantsJson(req)) {
    setStorefrontSecurityHeaders(res)
    res.status(200).json({
      success: true,
      storefront: payload,
    })
    return
  }

  setStorefrontSecurityHeaders(res)
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.status(200).send(renderStorefrontHtml(payload))
}
