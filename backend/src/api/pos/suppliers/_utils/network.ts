import type { MedusaContainer } from "@medusajs/framework/types"
import type { MedusaRequest } from "@medusajs/framework/http"
import { randomUUID } from "node:crypto"
import { SHOP_MODULE } from "../../../../modules/shop"
import type ShopModuleService from "../../../../modules/shop/service"
import { SUPPLIER_MODULE } from "../../../../modules/supplier"
import type SupplierModuleService from "../../../../modules/supplier/service"
import { PURCHASE_ORDER_MODULE } from "../../../../modules/purchase-order"
import type PurchaseOrderModuleService from "../../../../modules/purchase-order/service"
import {
  listNormalizedProducts,
  type NormalizedPosProduct,
} from "../../../admin/products/_utils"
import { industrySupplierCategories } from "../../../../utils/catalog-config"

export type DeliveryOptions = {
  methods: string[]
  areas: string[]
  fees: {
    flat: number
    free_above: number | null
  }
  min_order: number
  lead_time_days: number
  schedule: string[]
}

type ScopedRequestLike = Pick<MedusaRequest, "scope">

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeIndustryTypes(shop: Record<string, unknown>) {
  const raw =
    shop.industry_types &&
    typeof shop.industry_types === "object" &&
    Array.isArray((shop.industry_types as Record<string, unknown>).values)
      ? ((shop.industry_types as Record<string, unknown>).values as unknown[])
      : Array.isArray(shop.industry_types)
        ? (shop.industry_types as unknown[])
        : [shop.shop_type]

  return raw
    .map((entry) => entry?.toString().trim())
    .filter((entry): entry is string => Boolean(entry))
}

function deriveSupplierCategories(shop: Record<string, unknown>) {
  const explicit = Array.isArray(shop.supplier_categories)
    ? shop.supplier_categories
        .map((entry) => entry?.toString().trim())
        .filter((entry): entry is string => Boolean(entry))
    : []

  if (explicit.length > 0) {
    return explicit
  }

  const derived = new Set<string>()
  for (const category of industrySupplierCategories(normalizeIndustryTypes(shop))) {
    derived.add(category)
  }

  const customIndustryLabel = shop.custom_industry_label?.toString().trim()
  if (customIndustryLabel) {
    derived.add(customIndustryLabel)
  }

  const category = shop.category?.toString().trim()
  if (category) {
    derived.add(category)
  }

  return Array.from(derived)
}

export function normalizeDeliveryOptions(value: unknown): DeliveryOptions {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const fees =
    candidate["fees"] &&
    typeof candidate["fees"] === "object" &&
    !Array.isArray(candidate["fees"])
      ? (candidate["fees"] as Record<string, unknown>)
      : {}

  return {
    methods: Array.isArray(candidate["methods"])
      ? candidate["methods"].map((item) => String(item)).filter(Boolean)
      : ["delivery"],
    areas: Array.isArray(candidate["areas"])
      ? candidate["areas"].map((item) => String(item)).filter(Boolean)
      : [],
    fees: {
      flat: toNumber(fees["flat"], 0),
      free_above:
        fees["free_above"] == null ? null : toNumber(fees["free_above"], 0),
    },
    min_order: toNumber(candidate["min_order"], 0),
    lead_time_days: Math.max(1, toNumber(candidate["lead_time_days"], 1)),
    schedule: Array.isArray(candidate["schedule"])
      ? candidate["schedule"].map((item) => String(item)).filter(Boolean)
      : [],
  }
}

export async function getSupplierShop(
  container: MedusaContainer | MedusaRequest["scope"],
  supplierShopId: string
) {
  const shopService: ShopModuleService = (container as MedusaContainer).resolve(
    SHOP_MODULE
  )
  const [shops] = await shopService.listAndCountShops(
    { id: supplierShopId, is_supplier: true, is_active: true },
    { take: 1 }
  )
  return (shops[0] as Record<string, unknown> | undefined) ?? null
}

export function shapeSupplierNetworkShop(shop: Record<string, unknown>) {
  const deliveryOptions = normalizeDeliveryOptions(shop.delivery_options)
  const industryTypes = normalizeIndustryTypes(shop)
  return {
    id: String(shop.id),
    shop_name: String(shop.shop_name ?? "Supplier"),
    is_supplier: shop.is_supplier === true,
    supplier_verified: shop.supplier_verified === true,
    shop_type: shop.shop_type?.toString() ?? "retail_duka",
    custom_industry_label:
      typeof shop.custom_industry_label === "string"
        ? shop.custom_industry_label
        : null,
    industry_types: industryTypes,
    supplier_categories: deriveSupplierCategories(shop),
    supplier_description:
      typeof shop.supplier_description === "string"
        ? shop.supplier_description
        : null,
    years_in_business:
      shop.years_in_business == null ? null : toNumber(shop.years_in_business),
    delivery_options: deliveryOptions,
    mpesa_phone:
      typeof shop.mpesa_phone === "string" ? shop.mpesa_phone : null,
    profile_image_url:
      typeof shop.profile_image_url === "string" ? shop.profile_image_url : null,
  }
}

export async function listSupplierCatalog(
  req: ScopedRequestLike,
  supplierShopId: string
) {
  const products = await listNormalizedProducts(req as MedusaRequest, {
    shopId: supplierShopId,
  })

  return products
    .filter((product) => product.is_active)
    .map((product: NormalizedPosProduct) => {
      const firstUnit = product.selling_units[0] ?? {}
      const wholesalePrice = toNumber(
        product.cost_per_purchase ?? firstUnit["price"] ?? 0,
        0
      )
      return {
        id: product.variant_id,
        variant_id: product.variant_id,
        product_name: product.name,
        category: product.category,
        brand: product.brand,
        style_code: product.style_code,
        size: product.size,
        color: product.color,
        gender: product.gender,
        material: product.material,
        model_name: product.model_name,
        storage_capacity: product.storage_capacity,
        device_condition: product.device_condition,
        warranty_enabled: product.warranty_enabled,
        warranty_months: product.warranty_months,
        is_returnable: product.is_returnable,
        return_window_days: product.return_window_days,
        product_flags: {
          is_fashion:
            Boolean(product.size) ||
            Boolean(product.color) ||
            Boolean(product.material),
          is_electronics:
            Boolean(product.model_name) ||
            Boolean(product.storage_capacity) ||
            product.warranty_enabled === true,
        },
        wholesale_price: wholesalePrice,
        min_order_quantity: 1,
        bulk_pricing: null,
        stock_available: product.stock_remaining,
        lead_time_days: 1,
        image_url: product.image_url,
        unit: firstUnit["unit"] ?? null,
      }
    })
}

export function computeDeliveryFee(
  deliveryOptions: DeliveryOptions,
  subtotal: number
) {
  if (
    deliveryOptions.fees.free_above != null &&
    subtotal >= deliveryOptions.fees.free_above
  ) {
    return 0
  }

  return deliveryOptions.fees.flat
}

export async function findSupplierRecord(
  container: MedusaContainer | MedusaRequest["scope"],
  retailerShopId: string,
  supplierShopId: string
) {
  const supplierService: SupplierModuleService = (
    container as MedusaContainer
  ).resolve(SUPPLIER_MODULE)
  const [records] = await supplierService.listAndCountSuppliers(
    {
      shop_id: retailerShopId,
      supplier_shop_id: supplierShopId,
    },
    { take: 1 }
  )

  return (records[0] as Record<string, unknown> | undefined) ?? null
}

export async function createPurchaseOrderRecord(
  container: MedusaContainer | MedusaRequest["scope"],
  input: {
    retailer_shop_id: string
    supplier_shop_id: string
    supplier_id?: string | null
    items: Array<Record<string, unknown>>
    subtotal_amount: number
    total_amount: number
    notes?: string | null
    delivery_method: "pickup" | "delivery" | "third_party"
    delivery_fee: number
    auto_reorder_rule_id?: string | null
    status?: "pending" | "confirmed"
    metadata?: Record<string, unknown> | null
  }
) {
  const purchaseOrderService: PurchaseOrderModuleService = (
    container as MedusaContainer
  ).resolve(PURCHASE_ORDER_MODULE)

  return purchaseOrderService.createPurchaseOrders({
    id: `po_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    retailer_shop_id: input.retailer_shop_id,
    supplier_shop_id: input.supplier_shop_id,
    supplier_id: input.supplier_id ?? null,
    items: input.items,
    subtotal_amount: input.subtotal_amount,
    total_amount: input.total_amount,
    notes: input.notes ?? null,
    delivery_method: input.delivery_method,
    delivery_fee: input.delivery_fee,
    auto_reorder_rule_id: input.auto_reorder_rule_id ?? null,
    status: input.status ?? "pending",
    payment_status: "pending",
    delivery_status:
      input.delivery_method == "pickup" ? "scheduled" : "pending",
    metadata: input.metadata ?? null,
  } as Record<string, unknown>)
}
