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
import { ShopAssistantService } from "../../../../services/shop-assistant.service"

const CreateStoreSchema = z.object({
  theme_name: z.string().trim().min(1).default("smart-modern"),
  color_description: z.string().trim().min(1).optional(),
  color_seed: z.string().trim().min(1).optional(),
  tagline_hint: z.string().trim().min(1).optional(),
  hero_title: z.string().trim().min(1).optional(),
  hero_subtitle: z.string().trim().min(1).optional(),
  seo_description: z.string().trim().min(1).optional(),
  sharing_message: z.string().trim().min(1).optional(),
  selected_product_ids: z.array(z.string().trim().min(1)).optional(),
  section_keys: z.array(z.string().trim().min(1)).optional(),
  store_slug: z.string().trim().min(1).optional(),
  use_ai_copy: z.boolean().optional().default(true),
  site_brief: z.record(z.any()).optional(),
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

function deriveAccentColor(seed: string) {
  const palette = [
    "#195E86",
    "#14532D",
    "#7C2D12",
    "#5B21B6",
    "#0F766E",
    "#A16207",
    "#1E293B",
  ]

  const normalized = seed.trim().toLowerCase()
  if (!normalized) {
    return palette[0]
  }

  const hash = normalized.split("").reduce((sum, char) => {
    return (sum + char.charCodeAt(0)) % 997
  }, 0)

  return palette[hash % palette.length]
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
  const selectedProductIds = parsed.data.selected_product_ids ?? []
  const selectedProducts = selectedProductIds.length > 0
    ? selectedProductIds
        .map((id) => products.find((product) => product.variant_id === id))
        .filter((product): product is (typeof products)[number] => Boolean(product))
    : products.slice(0, 6)
  const featuredProducts = selectedProducts.map((product) => ({
    name: product.name,
    category: product.category,
    price: product.selling_units[0]?.["price"] ?? null,
    image_url: product.image_url,
  }))
  const slug = slugify(
    parsed.data.store_slug ?? String(shop.shop_name ?? "store"),
  )
  const publicUrl = buildStoreUrl(slug)
  const assistantService = new ShopAssistantService(req)
  const siteBrief = parsed.data.site_brief ?? {}
  const colorDescription =
    parsed.data.color_description ??
    parsed.data.color_seed ??
    String((siteBrief as Record<string, unknown>).color_description ?? "")

  const generated = parsed.data.use_ai_copy
      ? await assistantService.generateStoreDraft({
        shopId: auth.shop_id,
        shopName: String(shop.shop_name ?? "Store"),
        query: [
          `Create a secure storefront for ${String(shop.shop_name ?? "Store")}.`,
          `Theme name: ${parsed.data.theme_name}.`,
          `Color description: ${colorDescription || "none"}.`,
          `Tagline hint: ${parsed.data.tagline_hint ?? "none"}.`,
          `Site brief: ${JSON.stringify(siteBrief)}.`,
          `Products: ${JSON.stringify(featuredProducts)}.`,
        ].join(" "),
        model: undefined,
      })
    : {}
  const generatedRecord = generated as Record<string, unknown>

  const sectionKeys = parsed.data.section_keys?.length
    ? parsed.data.section_keys
    : generatedRecord.section_keys instanceof Array
    ? generatedRecord.section_keys as string[]
    : ["featured_products", "mpesa_checkout", "chat_support"]

  const accentColor =
    String(generatedRecord.accent_color ?? "").trim() ||
    deriveAccentColor(
      String(
        generatedRecord.color_description ??
          colorDescription ??
          parsed.data.theme_name
      )
    )

  const securityNotes = Array.isArray(generatedRecord.security_notes)
    ? generatedRecord.security_notes
    : []

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
      accent_color: accentColor,
      color_description:
        colorDescription ||
        String(generatedRecord.color_description ?? ""),
      palette_notes: generatedRecord.palette_notes ?? null,
      theme_name: parsed.data.theme_name,
      secure_site: true,
    },
    storefront_content: {
      hero_title:
        parsed.data.hero_title ??
        generatedRecord.hero_title ??
        `${shop.shop_name} online`,
      hero_subtitle:
        parsed.data.hero_subtitle ??
        generatedRecord.hero_subtitle ??
        "Order products online with real-time stock visibility.",
      featured_products: featuredProducts,
      sections: sectionKeys,
      site_brief: siteBrief,
      visual_style:
        generatedRecord.visual_style ??
        (siteBrief as Record<string, unknown>).visual_style ??
        null,
      reference_style:
        generatedRecord.reference_style ??
        (siteBrief as Record<string, unknown>).reference_style ??
        null,
      layout_notes:
        generatedRecord.layout_notes ??
        (siteBrief as Record<string, unknown>).layout_notes ??
        null,
      trust_signals:
        generatedRecord.trust_signals ??
        (siteBrief as Record<string, unknown>).trust_signals ??
        [],
      security_notes: securityNotes,
      cta_style:
        generatedRecord.cta_style ??
        (siteBrief as Record<string, unknown>).cta_style ??
        null,
    },
    seo_metadata: {
      title: `${shop.shop_name} | Trace`,
      description:
        parsed.data.seo_description ??
        generatedRecord.seo_description ??
        `Shop ${shop.shop_name} online with M-Pesa checkout.`,
      keywords:
        generatedRecord.seo_keywords ??
        (siteBrief as Record<string, unknown>).seo_keywords ??
        [],
    },
    sharing_metadata: {
      whatsapp_text:
        parsed.data.sharing_message ??
        generatedRecord.sharing_message ??
        `Browse ${shop.shop_name} online: ${publicUrl}`,
      sms_text: `${shop.shop_name} is now online. Visit ${publicUrl}`,
      share_title: `${shop.shop_name} online storefront`,
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
