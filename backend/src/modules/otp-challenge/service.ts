import { MedusaService } from "@medusajs/framework/utils"
import OtpChallenge from "./models/otp-challenge"

class OtpChallengeModuleService extends MedusaService({
  OtpChallenge,
}) {}

export default OtpChallengeModuleService
