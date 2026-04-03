import { z } from "zod"
import { normalizeKenyanPhone } from "../../utils/hash"

const IndustryType = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/,
    "Industry type must be a lowercase slug"
  )

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

export const AuthLoginPin = z.object({
  phone_number: KenyanPhone,
  pin: z.string().regex(/^[0-9]{4,8}$/, "PIN must be 4 to 8 digits"),
  device_id: z.string().min(8, "Device id is required"),
})

export const AuthChangePin = z.object({
  pin: z.string().regex(/^[0-9]{4,8}$/, "PIN must be 4 to 8 digits"),
  device_id: z.string().min(8, "Device id is required"),
})

export const AuthRecoverStaffAccess = z.object({
  phone_number: KenyanPhone,
  recovery_code: z.string().regex(/^[0-9]{6}$/, "Recovery code must be 6 digits"),
  new_pin: z.string().regex(/^[0-9]{4,8}$/, "PIN must be 4 to 8 digits"),
  device_id: z.string().min(8, "Device id is required"),
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
  industry_type: IndustryType.optional().default("retail_duka"),
  industry_types: z.array(IndustryType).min(1).optional(),
  industry_features: z.record(z.string(), z.unknown()).optional(),
})
