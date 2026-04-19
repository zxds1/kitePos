jest.mock("../shop-users", () => ({
  findActiveShopUserByPhoneHash: jest.fn(),
}))

import type { MedusaContainer } from "@medusajs/framework/types"
import { resolveShopAuthState } from "../shop-auth"
import { findActiveShopUserByPhoneHash } from "../shop-users"

const mockedFindActiveShopUserByPhoneHash = jest.mocked(
  findActiveShopUserByPhoneHash
)

function createShopService(shop: Record<string, unknown> | null) {
  return {
    listShops: jest.fn().mockResolvedValue(shop ? [shop] : []),
  }
}

describe("resolveShopAuthState", () => {
  beforeEach(() => {
    mockedFindActiveShopUserByPhoneHash.mockReset()
  })

  it("prefers the active shop user and resolves that user's shop", async () => {
    const shopService = createShopService({
      id: "shop_user",
      consent_given: true,
      shop_name: "User Shop",
    })

    mockedFindActiveShopUserByPhoneHash.mockResolvedValue({
      id: "user_123",
      shop_id: "shop_user",
      phone_hash: "hash_123",
      role: "admin",
    })

    const result = await resolveShopAuthState(
      {} as MedusaContainer,
      shopService as any,
      "hash_123"
    )

    expect(mockedFindActiveShopUserByPhoneHash).toHaveBeenCalledWith(
      {},
      "hash_123"
    )
    expect(shopService.listShops).toHaveBeenCalledWith(
      { id: "shop_user" },
      { take: 1 }
    )
    expect(result).toEqual({
      shop: {
        id: "shop_user",
        consent_given: true,
        shop_name: "User Shop",
      },
      user: {
        id: "user_123",
        shop_id: "shop_user",
        phone_hash: "hash_123",
        role: "admin",
      },
      isRegistered: true,
    })
  })

  it("falls back to the owner phone hash when no active user is found", async () => {
    const shopService = createShopService({
      id: "shop_owner",
      consent_given: false,
      owner_phone_hash: "hash_456",
    })

    mockedFindActiveShopUserByPhoneHash.mockResolvedValue(null)

    const result = await resolveShopAuthState(
      {} as MedusaContainer,
      shopService as any,
      "hash_456"
    )

    expect(shopService.listShops).toHaveBeenCalledWith(
      { owner_phone_hash: "hash_456" },
      { take: 1 }
    )
    expect(result).toEqual({
      shop: {
        id: "shop_owner",
        consent_given: false,
        owner_phone_hash: "hash_456",
      },
      user: null,
      isRegistered: false,
    })
  })
})
