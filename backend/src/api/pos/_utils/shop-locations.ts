import type { MedusaContainer } from "@medusajs/framework/types"
import { SHOP_LOCATION_MODULE } from "../../../modules/shop-location"
import type ShopLocationModuleService from "../../../modules/shop-location/service"

export type ShopLocationRecord = {
  id: string
  shop_id: string
  name: string
  code: string
  address?: string | null
  location_type?: string | null
  is_default?: boolean | null
  is_active?: boolean | null
  stock_location_id?: string | null
  sales_channel_id?: string | null
  metadata?: Record<string, unknown> | null
}

export function shapeShopLocation(location: ShopLocationRecord) {
  return {
    id: location.id,
    shop_id: location.shop_id,
    name: location.name,
    code: location.code,
    address: location.address ?? null,
    location_type: location.location_type ?? "physical",
    is_default: location.is_default ?? false,
    is_active: location.is_active ?? true,
    stock_location_id: location.stock_location_id ?? null,
    sales_channel_id: location.sales_channel_id ?? null,
    metadata: location.metadata ?? null,
  }
}

export async function listShopLocations(
  container: MedusaContainer,
  shopId: string
): Promise<ShopLocationRecord[]> {
  const service: ShopLocationModuleService = container.resolve(SHOP_LOCATION_MODULE)
  const [locations] = await service.listAndCountShopLocations(
    { shop_id: shopId, is_active: true },
    { take: 100, order: { is_default: "DESC", created_at: "ASC" } }
  )

  return locations as unknown as ShopLocationRecord[]
}

export async function getDefaultShopLocation(
  container: MedusaContainer,
  shopId: string,
  preferredLocationId?: string | null
): Promise<ShopLocationRecord | null> {
  const locations = await listShopLocations(container, shopId)

  if (preferredLocationId) {
    const preferred = locations.find(
      (location) => location.id === preferredLocationId && location.is_active !== false
    )
    if (preferred) {
      return preferred
    }
  }

  return (
    locations.find((location) => location.is_default === true) ??
    locations.find((location) => location.is_active !== false) ??
    null
  )
}
