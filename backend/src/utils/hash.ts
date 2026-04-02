import crypto from "crypto"

const SALT = process.env.HASH_SALT || "change_this_secret_in_production"

export function hashPhone(phone: string): string {
  return crypto.createHmac("sha256", SALT).update(phone).digest("hex")
}

export function hashOtp(phone: string, otp: string): string {
  return crypto
    .createHmac("sha256", SALT)
    .update(`${phone}:${otp}`)
    .digest("hex")
}

export function hashPin(pin: string): string {
  return crypto
    .createHmac("sha256", SALT)
    .update(`pin:${pin}`)
    .digest("hex")
}

export function hashSecret(value: string, namespace = "secret"): string {
  return crypto
    .createHmac("sha256", SALT)
    .update(`${namespace}:${value}`)
    .digest("hex")
}

export function generateNumericCode(length = 6): string {
  const digits = "0123456789"
  let result = ""
  for (let index = 0; index < length; index += 1) {
    result += digits[crypto.randomInt(0, digits.length)]
  }
  return result
}

export function normalizeKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")

  if (digits.startsWith("254") && digits.length === 12) {
    return digits
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`
  }

  if (/^[712][0-9]{8}$/.test(digits)) {
    return `254${digits}`
  }

  throw new Error("Phone must be a valid Kenyan number")
}
