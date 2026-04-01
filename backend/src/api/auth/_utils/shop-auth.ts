import type ShopModuleService from "../../../modules/shop/service"

export type PosAuthShopState = {
  shop: Record<string, unknown> | null
  isRegistered: boolean
}

export async function resolveShopAuthState(
  shopService: ShopModuleService,
  ownerPhoneHash: string
): Promise<PosAuthShopState> {
  const [shop] = await shopService.listShops(
    { owner_phone_hash: ownerPhoneHash },
    { take: 1 }
  )

  const shopRecord = shop as Record<string, unknown> | undefined

  return {
    shop: shopRecord ?? null,
    isRegistered: Boolean(shopRecord?.consent_given),
  }
}
