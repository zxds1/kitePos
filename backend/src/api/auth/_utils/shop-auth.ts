import type { MedusaContainer } from "@medusajs/framework/types"
import type ShopModuleService from "../../../modules/shop/service"
import { findActiveShopUserByPhoneHash, type ShopUserRecord } from "./shop-users"

export type PosAuthShopState = {
  shop: Record<string, unknown> | null
  user: ShopUserRecord | null
  isRegistered: boolean
}

export async function resolveShopAuthState(
  container: MedusaContainer,
  shopService: ShopModuleService,
  ownerPhoneHash: string
): Promise<PosAuthShopState> {
  const user = await findActiveShopUserByPhoneHash(container, ownerPhoneHash)
  if (user?.shop_id) {
    const [userShop] = await shopService.listShops({ id: user.shop_id }, { take: 1 })
    const shopRecord = userShop as Record<string, unknown> | undefined

    return {
      shop: shopRecord ?? null,
      user,
      isRegistered: Boolean(shopRecord?.consent_given),
    }
  }

  const [shop] = await shopService.listShops(
    { owner_phone_hash: ownerPhoneHash },
    { take: 1 }
  )

  const shopRecord = shop as Record<string, unknown> | undefined

  return {
    shop: shopRecord ?? null,
    user: null,
    isRegistered: Boolean(shopRecord?.consent_given),
  }
}
