import { randomInt, randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { OTP_CHALLENGE_MODULE } from "../../../modules/otp-challenge"
import type OtpChallengeModuleService from "../../../modules/otp-challenge/service"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { resolveShopAuthState } from "../_utils/shop-auth"
import { hashOtp, hashPhone } from "../../../utils/hash"
import { maskPhone } from "../../../utils/encryption"
import { AuthRequestOtp } from "../validators"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const otpChallengeService: OtpChallengeModuleService = req.scope.resolve(
    OTP_CHALLENGE_MODULE
  )
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const body = AuthRequestOtp.parse(req.validatedBody)

  const phoneNumber = body.phone_number
  const phoneHash = hashPhone(phoneNumber)
  const otp = process.env.DEV_OTP_CODE ?? randomInt(1000, 10000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  const shopState = await resolveShopAuthState(shopService, phoneHash)

  await otpChallengeService.createOtpChallenges({
    id: `otp_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    phone_hash: phoneHash,
    otp_hash: hashOtp(phoneNumber, otp),
    channel: "sms",
    expires_at: expiresAt,
    consumed_at: null,
    last_sent_at: new Date(),
    attempt_count: 0,
    resend_count: 0,
  })

  res.status(200).json({
    success: true,
    message: "OTP generated successfully",
    phone_masked: maskPhone(phoneNumber),
    expires_in_seconds: 300,
    is_registered: shopState.isRegistered,
    ...(process.env.NODE_ENV !== "production" ? { otp_debug_code: otp } : {}),
  })
}
