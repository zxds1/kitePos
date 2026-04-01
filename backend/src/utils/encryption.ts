import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"

function getKey() {
  const source =
    process.env.PAYMENT_ENCRYPTION_KEY || "change_this_in_production"

  return crypto.createHash("sha256").update(source).digest()
}

export function encryptPhone(phone: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)

  let encrypted = cipher.update(phone, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

export function decryptPhone(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":")

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted phone format")
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivHex, "hex")
  )
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"))

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) {
    return "****"
  }

  return `${phone.slice(0, 3)}****${phone.slice(-3)}`
}
