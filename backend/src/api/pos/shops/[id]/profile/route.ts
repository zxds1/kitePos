import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { SHOP_MODULE } from "../../../../../modules/shop"
import type ShopModuleService from "../../../../../modules/shop/service"
import { SHOP_USER_MODULE } from "../../../../../modules/shop-user"
import type ShopUserModuleService from "../../../../../modules/shop-user/service"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../../auth/_utils/jwt"
import { canManageBranches } from "../../../../auth/_utils/shop-users"
import { hashPhone, normalizeKenyanPhone } from "../../../../../utils/hash"
import {
  getAuthorizedShop,
  shapeShopProfile,
  shapeViewerProfile,
} from "../../../settings/_utils"

const UpdateProfileSchema = z.object({
  shop_name: z.string().min(1).max(100).optional(),
  owner_name: z.string().min(1).max(100).optional(),
  owner_phone: z.string().optional(),
  address: z.string().max(255).optional().nullable(),
  business_license: z.string().max(100).optional().nullable(),
  full_name: z.string().min(1).max(100).optional(),
  profile_image_url: z.string().max(4_000_000).optional().nullable(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const { id } = req.params
  if (auth.shop_id !== id) {
    res.status(403).json({
      success: false,
      message: "You can only access your own shop profile",
    })
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const shopUserService: ShopUserModuleService = req.scope.resolve(SHOP_USER_MODULE)
  const shop = await getAuthorizedShop(shopService, id)
  const [users] = auth.user_id
    ? await shopUserService.listAndCountShopUsers(
        { id: auth.user_id, shop_id: id },
        { take: 1 }
      )
    : [[], 0]
  const viewer = users[0] as Record<string, unknown> | undefined

  if (!shop) {
    res.status(404).json({
      success: false,
      message: "Shop not found",
    })
    return
  }

  res.status(200).json({
    success: true,
    profile: shapeShopProfile(shop, auth),
    viewer_profile: shapeViewerProfile(viewer as never, auth),
  })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const { id } = req.params
  if (auth.shop_id !== id) {
    res.status(403).json({
      success: false,
      message: "You can only update your own shop profile",
    })
    return
  }

  const validated = UpdateProfileSchema.safeParse(req.body)
  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validated.error.flatten(),
    })
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const shopUserService: ShopUserModuleService = req.scope.resolve(SHOP_USER_MODULE)
  const shop = await getAuthorizedShop(shopService, id)
  const [users] = auth.user_id
    ? await shopUserService.listAndCountShopUsers(
        { id: auth.user_id, shop_id: id },
        { take: 1 }
      )
    : [[], 0]
  const viewer = users[0] as Record<string, unknown> | undefined

  if (!shop) {
    res.status(404).json({
      success: false,
      message: "Shop not found",
    })
    return
  }

  const includesShopFields =
    validated.data.shop_name != null ||
    validated.data.owner_name != null ||
    validated.data.owner_phone != null ||
    validated.data.address !== undefined ||
    validated.data.business_license !== undefined

  if (includesShopFields && !canManageBranches(auth.role)) {
    res.status(403).json({
      success: false,
      message: "Only owner or admin can update shop information",
    })
    return
  }

  const updateInput: Record<string, unknown> = {
    id,
  }

  if (validated.data.shop_name != null) {
    updateInput.shop_name = validated.data.shop_name
  }
  if (validated.data.owner_name != null) {
    updateInput.owner_name = validated.data.owner_name
  }
  if (validated.data.address != null) {
    updateInput.address = validated.data.address
  }
  if (validated.data.business_license != null) {
    updateInput.business_license = validated.data.business_license
  }
  if (validated.data.profile_image_url !== undefined && canManageBranches(auth.role)) {
    updateInput.profile_image_url = validated.data.profile_image_url
  }
  if (validated.data.owner_phone != null) {
    const normalizedPhone = normalizeKenyanPhone(validated.data.owner_phone)
    updateInput.owner_phone_hash = hashPhone(normalizedPhone)
  }

  const updatedShop =
    Object.keys(updateInput).length > 1
      ? (await shopService.updateShops([updateInput]))[0]
      : shop

  let updatedViewer = viewer

  if (
    auth.user_id &&
    viewer &&
    (validated.data.full_name != null ||
      (validated.data.profile_image_url !== undefined &&
        !canManageBranches(auth.role)))
  ) {
    const [nextViewer] = await shopUserService.updateShopUsers([
      {
        id: auth.user_id,
        ...(validated.data.full_name != null
          ? { full_name: validated.data.full_name }
          : {}),
        ...(validated.data.profile_image_url !== undefined &&
                !canManageBranches(auth.role)
            ? { profile_image_url: validated.data.profile_image_url }
            : {}),
      },
    ])
    updatedViewer = nextViewer as Record<string, unknown>
  }

  res.status(200).json({
    success: true,
    profile: shapeShopProfile(
      updatedShop as Record<string, unknown>,
      {
        ...auth,
        phone_number: validated.data.owner_phone != null
            ? normalizeKenyanPhone(validated.data.owner_phone)
            : auth.phone_number,
      }
    ),
    viewer_profile: shapeViewerProfile(updatedViewer as never, auth),
  })
}
