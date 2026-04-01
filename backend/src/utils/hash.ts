import crypto from "crypto"

const SALT = process.env.HASH_SALT || "change_this_secret_in_production"

export function hashPhone(phone: string): string {
  return crypto.createHmac("sha256", SALT).update(phone).digest("hex")
}
