import { model } from "@medusajs/framework/utils"

const OtpChallenge = model.define("otp_challenge", {
  id: model.id().primaryKey(),
  phone_hash: model.text(),
  otp_hash: model.text(),
  channel: model.enum(["sms"]).default("sms"),
  expires_at: model.dateTime(),
  consumed_at: model.dateTime().nullable(),
  last_sent_at: model.dateTime(),
  attempt_count: model.number().default(0),
  resend_count: model.number().default(0),
})

export default OtpChallenge
