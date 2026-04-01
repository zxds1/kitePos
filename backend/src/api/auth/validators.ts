import { z } from "zod"
import { normalizeKenyanPhone } from "../../utils/hash"

const KenyanPhone = z.string().transform((value, ctx) => {
  try {
    return normalizeKenyanPhone(value)
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        error instanceof Error
          ? error.message
          : "Phone must be a valid Kenyan number",
    })
    return z.NEVER
  }
})

export const AuthRequestOtp = z.object({
  phone_number: KenyanPhone,
})

export const AuthVerifyOtp = z.object({
  phone_number: KenyanPhone,
  otp: z.string().regex(/^[0-9]{4}$/, "OTP must be exactly 4 digits"),
})

export const AuthRegisterShop = z.object({
  shop_name: z.string().min(1),
  owner_phone: KenyanPhone,
  region_code: z.string().min(1),
  ward_code: z.string().min(1),
  category: z.string().optional(),
  consent_given: z.boolean().optional().default(false),
  consent_timestamp: z.coerce.date().optional(),
  is_active: z.boolean().optional().default(true),
  mpesa_phone: KenyanPhone.optional(),
  mpesa_till: z.string().optional(),
  mpesa_paybill: z.string().optional(),
  accept_mpesa: z.boolean().optional().default(true),
  mpesa_display_name: z.string().max(50).optional(),
})
