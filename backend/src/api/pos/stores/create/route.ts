import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { ONLINE_STORE_MODULE } from "../../../../modules/online-store"
import type OnlineStoreModuleService from "../../../../modules/online-store/service"
import { SHOP_MODULE } from "../../../../modules/shop"
import type ShopModuleService from "../../../../modules/shop/service"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../auth/_utils/jwt"
import { getAuthorizedShop } from "../../settings/_utils"
import { listNormalizedProducts } from "../../../admin/products/_utils"
import { AIService } from "../../../../services/ai.service"

const CreateStoreSchema = z.object({
  theme_name: z.string().trim().min(1).default("smart-modern"),
  color_seed: z.string().trim().min(1).optional(),
  tagline_hint: z.string().trim().min(1).optional(),
})

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

function buildStoreUrl(slug: string) {
  const baseUrl =
    process.env.ONLINE_STORE_PUBLIC_BASE_URL ?? "https://trace.co.ke/shops"

  if (baseUrl.includes("{slug}")) {
    return baseUrl.replace("{slug}", slug)
  }

  return `${baseUrl.replace(/\/+$/, "")}/${slug}`
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (auth.role !== "owner" && auth.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Only shop owners and admins can create online stores",
    })
    return
  }

  const parsed = CreateStoreSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid store creation payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const storeService: OnlineStoreModuleService = req.scope.resolve(ONLINE_STORE_MODULE)
  const shop = await getAuthorizedShop(shopService, auth.shop_id)
  if (!shop) {
    res.status(404).json({ success: false, message: "Shop not found" })
    return
  }

  const products = await listNormalizedProducts(req, { shopId: auth.shop_id })
  const featuredProducts = products.slice(0, 6).map((product) => ({
    name: product.name,
    category: product.category,
    price: product.selling_units[0]?.["price"] ?? null,
    image_url: product.image_url,
  }))
  const slug = slugify(String(shop.shop_name ?? "store"))
  const publicUrl = buildStoreUrl(slug)
  const aiService = new AIService(req.scope)

  const generated = await aiService.generateJson(
    {
      shopId: auth.shop_id,
      operationType: "store_generation",
      prompt: `Create storefront JSON for ${shop.shop_name}. Theme ${parsed.data.theme_name}. Optional color seed ${parsed.data.color_seed ?? "none"}. Optional tagline hint ${parsed.data.tagline_hint ?? "none"}. Products: ${JSON.stringify(featuredProducts)}.`,
      maxTokens: 500,
      metadata: { theme_name: parsed.data.theme_name, product_count: featuredProducts.length },
    },
    {
      hero_title: `${shop.shop_name} online`,
      hero_subtitle: parsed.data.tagline_hint ?? "Shop trusted products with fast local fulfilment.",
      sections: [
        "featured_products",
        "mpesa_checkout",
        "chat_support",
      ],
      seo_description: `Buy from ${shop.shop_name} online on Trace.`,
      accent_color: parsed.data.color_seed ?? "#195E86",
    }
  )

  const [existing] = await storeService.listOnlineStores(
    { shop_id: auth.shop_id },
    { take: 1, order: { updated_at: "DESC" } }
  )

  const payload = {
    id:
      (existing as Record<string, unknown> | undefined)?.id?.toString() ??
      `ost_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_id: auth.shop_id,
    slug,
    subdomain: slug,
    public_url: publicUrl,
    status: "published",
    theme_name: parsed.data.theme_name,
    theme_config: {
      accent_color: (generated as Record<string, unknown>).accent_color ?? parsed.data.color_seed ?? "#195E86",
      theme_name: parsed.data.theme_name,
    },
    storefront_content: {
      hero_title:
        (generated as Record<string, unknown>).hero_title ?? `${shop.shop_name} online`,
      hero_subtitle:
        (generated as Record<string, unknown>).hero_subtitle ??
        "Order products online with real-time stock visibility.",
      featured_products: featuredProducts,
      sections:
        (generated as Record<string, unknown>).sections ??
        ["featured_products", "mpesa_checkout", "chat_support"],
    },
    seo_metadata: {
      title: `${shop.shop_name} | Trace`,
      description:
        (generated as Record<string, unknown>).seo_description ??
        `Shop ${shop.shop_name} online with M-Pesa checkout.`,
    },
    sharing_metadata: {
      whatsapp_text: `Browse ${shop.shop_name} online: ${publicUrl}`,
      sms_text: `${shop.shop_name} is now online. Visit ${publicUrl}`,
    },
    generation_error: null,
    last_generated_at: new Date(),
    is_active: true,
    updated_at: new Date(),
  }

  const onlineStore = existing
    ? (await storeService.updateOnlineStores([payload as Record<string, unknown>]))[0]
    : await storeService.createOnlineStores(payload as Record<string, unknown>)

  res.status(200).json({
    success: true,
    store: onlineStore,
  })
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const storeService: OnlineStoreModuleService = req.scope.resolve(ONLINE_STORE_MODULE)
  const [store] = await storeService.listOnlineStores(
    { shop_id: auth.shop_id },
    { take: 1, order: { updated_at: "DESC" } }
  )
  const storeRecord = (store as Record<string, unknown> | undefined) ?? null

  if (storeRecord?.slug) {
    storeRecord.public_url = buildStoreUrl(String(storeRecord.slug))
  }

  res.status(200).json({
    success: true,
    store: storeRecord,
  })
}
