import { Module } from "@medusajs/framework/utils"
import OtpChallengeModuleService from "./service"

export const OTP_CHALLENGE_MODULE = "otp_challenge"

export default Module(OTP_CHALLENGE_MODULE, {
  service: OtpChallengeModuleService,
})
