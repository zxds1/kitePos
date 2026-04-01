import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { hashPhone } from "../../../utils/hash"
import { AdminCreateShop, AdminListShops } from "./validators"
import {
  buildCursorPage,
  decodeCursor,
  parseLimit,
} from "../_utils/pagination"

function shapeShop(shop: Record<string, unknown>) {
  return {
    id: shop.id,
    shop_name: shop.shop_name,
    region_code: shop.region_code,
    ward_code: shop.ward_code,
    category: shop.category,
    consent_given: shop.consent_given,
    consent_timestamp: shop.consent_timestamp,
    is_active: shop.is_active,
    mpesa_phone: shop.mpesa_phone,
    mpesa_till: shop.mpesa_till,
    mpesa_paybill: shop.mpesa_paybill,
    accept_mpesa: shop.accept_mpesa,
    mpesa_display_name: shop.mpesa_display_name,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const query = AdminListShops.parse(req.query)

  const limit = parseLimit(query.limit)
  const skip = decodeCursor(query.cursor)
  const filters: Record<string, unknown> = {}

  if (query.region_code) {
    filters.region_code = query.region_code
  }

  if (query.ward_code) {
    filters.ward_code = query.ward_code
  }

  if (typeof query.is_active === "boolean") {
    filters.is_active = query.is_active
  }

  if (typeof query.accept_mpesa === "boolean") {
    filters.accept_mpesa = query.accept_mpesa
  }

  const [shops, count] = await service.listAndCountShops(filters, {
    take: limit,
    skip,
    order: {
      created_at: "DESC",
    },
  })

  res.json({
    shops: shops.map((shop) => shapeShop(shop as unknown as Record<string, unknown>)),
    ...buildCursorPage(count, limit, skip),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const service: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const body = AdminCreateShop.parse(req.validatedBody)

  const shop = await service.createShops({
    id: body.id ?? `shop_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_name: body.shop_name,
    owner_phone_hash: hashPhone(body.owner_phone),
    region_code: body.region_code,
    ward_code: body.ward_code,
    category: body.category ?? null,
    consent_given: body.consent_given,
    consent_timestamp: body.consent_timestamp ?? null,
    is_active: body.is_active,
    mpesa_phone: body.mpesa_phone ?? null,
    mpesa_till: body.mpesa_till ?? null,
    mpesa_paybill: body.mpesa_paybill ?? null,
    accept_mpesa: body.accept_mpesa,
    mpesa_display_name: body.mpesa_display_name ?? null,
  })

  res.status(200).json({
    shop: shapeShop(shop as unknown as Record<string, unknown>),
  })
}
