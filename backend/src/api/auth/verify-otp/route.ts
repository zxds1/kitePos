import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { OTP_CHALLENGE_MODULE } from "../../../modules/otp-challenge"
import type OtpChallengeModuleService from "../../../modules/otp-challenge/service"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { SHOP_USER_MODULE } from "../../../modules/shop-user"
import type ShopUserModuleService from "../../../modules/shop-user/service"
import { issuePosAuthTokens } from "../_utils/jwt"
import { resolveShopAuthState } from "../_utils/shop-auth"
import { hashOtp, hashPhone } from "../../../utils/hash"
import { AuthVerifyOtp } from "../validators"
import { listShopLocations } from "../../pos/_utils/shop-locations"
import { shapeShopUser } from "../_utils/shop-users"
import { randomUUID } from "node:crypto"
import { shapeShop } from "../_utils/shape-shop"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const otpChallengeService: OtpChallengeModuleService = req.scope.resolve(
    OTP_CHALLENGE_MODULE
  )
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const body = AuthVerifyOtp.parse(req.validatedBody)

  const phoneHash = hashPhone(body.phone_number)
  const expectedOtpHash = hashOtp(body.phone_number, body.otp)

  const [challenges] = await otpChallengeService.listAndCountOtpChallenges(
    { phone_hash: phoneHash },
    {
      take: 10,
      order: { created_at: "DESC" },
    }
  )

  const activeChallenge = challenges.find((challenge) => {
    const candidate = challenge as Record<string, unknown>
    return (
      candidate.deleted_at == null &&
      candidate.consumed_at == null &&
      candidate.otp_hash === expectedOtpHash &&
      new Date(String(candidate.expires_at)).getTime() > Date.now()
    )
  })

  if (!activeChallenge) {
    res.status(400).json({
      success: false,
      message: "Invalid or expired OTP",
    })
    return
  }

  const challengeRecord = activeChallenge as unknown as { id: string; attempt_count?: number }

  await otpChallengeService.updateOtpChallenges([
    {
      id: challengeRecord.id,
      consumed_at: new Date(),
      attempt_count: (challengeRecord.attempt_count ?? 0) + 1,
    },
  ])

  const shopState = await resolveShopAuthState(req.scope, shopService, phoneHash)
  const shopRecord = shopState.shop ?? undefined
  const consentGiven = shopState.isRegistered
  let currentUser = shopState.user
  if (!currentUser && shopRecord && typeof shopRecord.id === "string") {
    currentUser = (await req.scope
      .resolve<ShopUserModuleService>(SHOP_USER_MODULE)
      .createShopUsers({
        id: `user_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        shop_id: shopRecord.id,
        phone_hash: phoneHash,
        full_name: shopRecord.owner_name ?? null,
        role: "owner",
        assigned_location_ids: [],
        assigned_terminal_ids: [],
        is_active: true,
        last_login_at: new Date(),
      } as unknown as Record<string, unknown>)) as never
  }
  const allLocations =
    shopRecord && typeof shopRecord.id === "string"
      ? await listShopLocations(req.scope, shopRecord.id)
      : []
  const assignedLocationIds =
    currentUser?.assigned_location_ids &&
    Array.isArray(currentUser.assigned_location_ids)
      ? currentUser.assigned_location_ids
          .filter((entry): entry is string => typeof entry === "string")
      : []
  const assignedTerminalIds =
    currentUser?.assigned_terminal_ids &&
    Array.isArray(currentUser.assigned_terminal_ids)
      ? currentUser.assigned_terminal_ids
          .filter((entry): entry is string => typeof entry === "string")
      : []
  const locations =
    !currentUser || currentUser.role === "owner" || currentUser.role === "admin"
      ? allLocations
      : allLocations.filter((location) => assignedLocationIds.includes(location.id))

  const tokens = issuePosAuthTokens({
    phone_number: body.phone_number,
    shop_id: typeof shopRecord?.id === "string" ? shopRecord.id : null,
    is_registered: consentGiven,
    user_id: currentUser?.id ?? null,
    role: currentUser?.role ?? null,
    assigned_location_ids: assignedLocationIds,
    assigned_terminal_ids: assignedTerminalIds,
  })

  if (currentUser?.id) {
    await req.scope
      .resolve<ShopUserModuleService>(SHOP_USER_MODULE)
      .updateShopUsers({
        id: currentUser.id,
        last_login_at: new Date(),
      } as unknown as Record<string, unknown>)
  }

  res.status(200).json({
    success: true,
    is_registered: consentGiven,
    ...tokens,
    user_id: currentUser?.id ?? null,
    role: currentUser?.role ?? null,
    assigned_location_ids: assignedLocationIds,
    assigned_terminal_ids: assignedTerminalIds,
    next_step: consentGiven ? "home" : "register_shop",
    shop: shopRecord
      ? {
          ...shapeShop(shopRecord),
          locations,
          current_user: currentUser ? shapeShopUser(currentUser) : null,
        }
      : null,
  })
}
