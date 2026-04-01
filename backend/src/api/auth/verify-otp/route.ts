import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { OTP_CHALLENGE_MODULE } from "../../../modules/otp-challenge"
import type OtpChallengeModuleService from "../../../modules/otp-challenge/service"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { issuePosAuthTokens } from "../_utils/jwt"
import { resolveShopAuthState } from "../_utils/shop-auth"
import { hashOtp, hashPhone } from "../../../utils/hash"
import { AuthVerifyOtp } from "../validators"

function shapeShop(shop: Record<string, unknown>) {
  return {
    id: shop.id,
    shop_name: shop.shop_name,
    region_code: shop.region_code,
    ward_code: shop.ward_code,
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

  const shopState = await resolveShopAuthState(shopService, phoneHash)
  const shopRecord = shopState.shop ?? undefined
  const consentGiven = shopState.isRegistered
  const tokens = issuePosAuthTokens({
    phone_number: body.phone_number,
    shop_id: typeof shopRecord?.id === "string" ? shopRecord.id : null,
    is_registered: consentGiven,
  })

  res.status(200).json({
    success: true,
    is_registered: consentGiven,
    ...tokens,
    next_step: consentGiven ? "home" : "register_shop",
    shop: shopRecord ? shapeShop(shopRecord) : null,
  })
}
