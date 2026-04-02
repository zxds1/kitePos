import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { SHOP_LOCATION_MODULE } from "../../src/modules/shop-location"
import type ShopLocationModuleService from "../../src/modules/shop-location/service"
import { SHOP_MODULE } from "../../src/modules/shop"
import type ShopModuleService from "../../src/modules/shop/service"
import { SHOP_USER_MODULE } from "../../src/modules/shop-user"
import type ShopUserModuleService from "../../src/modules/shop-user/service"
import { SHOP_TERMINAL_MODULE } from "../../src/modules/shop-terminal"
import type ShopTerminalModuleService from "../../src/modules/shop-terminal/service"
import { hashPhone, hashPin } from "../../src/utils/hash"
import { issuePosAuthTokens } from "../../src/api/auth/_utils/jwt"

jest.setTimeout(90 * 1000)

function buildAuthHeaders(
  shopId: string,
  phoneNumber: string,
  userId: string,
  role: "owner" | "admin" | "branch_manager" | "cashier",
  assignedLocationIds: string[] = [],
  assignedTerminalIds: string[] = []
) {
  const tokens = issuePosAuthTokens({
    phone_number: phoneNumber,
    shop_id: shopId,
    is_registered: true,
    user_id: userId,
    role,
    assigned_location_ids: assignedLocationIds,
    assigned_terminal_ids: assignedTerminalIds,
  })

  return {
    Authorization: `Bearer ${tokens.access_token}`,
  }
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let shopId: string
    let ownerPhone: string
    let branchPhone: string
    let ownerUserId: string
    let branchUserId: string
    let mainLocationId: string
    let branchLocationId: string
    let branchTerminalId: string

    beforeEach(async () => {
      shopId = `shop_${randomUUID().replace(/-/g, "").slice(0, 24)}`
      ownerPhone = `2547${Date.now().toString().slice(-8)}`
      branchPhone = `2547${(Date.now() + 17).toString().slice(-8)}`

      const shopService = getContainer().resolve(
        SHOP_MODULE
      ) as ShopModuleService
      const locationService = getContainer().resolve(
        SHOP_LOCATION_MODULE
      ) as ShopLocationModuleService
      const shopUserService = getContainer().resolve(
        SHOP_USER_MODULE
      ) as ShopUserModuleService
      const terminalService = getContainer().resolve(
        SHOP_TERMINAL_MODULE
      ) as ShopTerminalModuleService

      await shopService.createShops({
        id: shopId,
        shop_name: "Branch Test Shop",
        owner_phone_hash: hashPhone(ownerPhone),
        region_code: "47",
        ward_code: "001",
        consent_given: true,
        consent_timestamp: new Date(),
        is_active: true,
      } as unknown as Record<string, unknown>)

      const mainLocation = await locationService.createShopLocations({
        id: `loc_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        shop_id: shopId,
        name: "Main Shop",
        code: "main",
        location_type: "physical",
        is_default: true,
        is_active: true,
      } as unknown as Record<string, unknown>)
      const branchLocation = await locationService.createShopLocations({
        id: `loc_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        shop_id: shopId,
        name: "Westlands Branch",
        code: "westlands",
        location_type: "physical",
        is_default: false,
        is_active: true,
      } as unknown as Record<string, unknown>)

      mainLocationId = String((mainLocation as Record<string, unknown>).id)
      branchLocationId = String((branchLocation as Record<string, unknown>).id)
      const branchTerminal = await terminalService.createShopTerminals({
        id: `term_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        shop_id: shopId,
        location_id: branchLocationId,
        name: "Checkout 1",
        code: "checkout-1",
        is_active: true,
      } as unknown as Record<string, unknown>)
      branchTerminalId = String((branchTerminal as Record<string, unknown>).id)

      const ownerUser = await shopUserService.createShopUsers({
        id: `user_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        shop_id: shopId,
        phone_hash: hashPhone(ownerPhone),
        full_name: "Owner",
        role: "owner",
        assigned_location_ids: [],
        assigned_terminal_ids: [],
        is_active: true,
      } as unknown as Record<string, unknown>)
      const branchUser = await shopUserService.createShopUsers({
        id: `user_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        shop_id: shopId,
        phone_hash: hashPhone(branchPhone),
        pin_hash: hashPin("2468"),
        full_name: "Branch Manager",
        role: "branch_manager",
        assigned_location_ids: [branchLocationId],
        assigned_terminal_ids: [branchTerminalId],
        is_active: true,
      } as unknown as Record<string, unknown>)

      ownerUserId = String((ownerUser as Record<string, unknown>).id)
      branchUserId = String((branchUser as Record<string, unknown>).id)
    })

    it("logs a branch phone into the same shop with only its assigned branch", async () => {
      const requestOtpResponse = await api.post("/auth/request-otp", {
        phone_number: branchPhone,
      })

      expect(requestOtpResponse.status).toBe(200)
      expect(requestOtpResponse.data.is_registered).toBe(true)

      const verifyResponse = await api.post("/auth/verify-otp", {
        phone_number: branchPhone,
        otp: requestOtpResponse.data.otp_debug_code,
      })

      expect(verifyResponse.status).toBe(200)
      expect(verifyResponse.data.shop).toEqual(
        expect.objectContaining({
          id: shopId,
          current_user: expect.objectContaining({
            role: "branch_manager",
            assigned_terminal_ids: [branchTerminalId],
          }),
          locations: [
            expect.objectContaining({
              id: branchLocationId,
              name: "Westlands Branch",
            }),
          ],
        })
      )
    })

    it("supports direct staff PIN login without OTP setup on the branch phone", async () => {
      const shopUserService = getContainer().resolve(
        SHOP_USER_MODULE
      ) as ShopUserModuleService
      const branchDeviceId = "device-branch-001"
      const secondDeviceId = "device-branch-002"

      await shopUserService.updateShopUsers({
        id: branchUserId,
        pin_hash: hashPin("1357"),
        must_change_pin: true,
      } as unknown as Record<string, unknown>)

      const validPinResponse = await api.post("/auth/login-pin", {
        phone_number: branchPhone,
        pin: "1357",
        device_id: branchDeviceId,
      })
      expect(validPinResponse.status).toBe(200)
      expect(validPinResponse.data.next_step).toBe("change_pin")
      expect(validPinResponse.data.assigned_terminal_ids).toEqual([branchTerminalId])
      expect(validPinResponse.data.shop).toEqual(
        expect.objectContaining({
          id: shopId,
          current_user: expect.objectContaining({
            role: "branch_manager",
            assigned_terminal_ids: [branchTerminalId],
          }),
          locations: [
            expect.objectContaining({
              id: branchLocationId,
            }),
          ],
        })
      )

      const changePinResponse = await api.post(
        "/auth/change-pin",
        {
          pin: "8642",
          device_id: branchDeviceId,
        },
        {
          headers: {
            Authorization: `Bearer ${validPinResponse.data.access_token}`,
          },
        }
      )
      expect(changePinResponse.status).toBe(200)
      expect(changePinResponse.data.next_step).toBe("home")

      const invalidPinResponse = await api.post(
        "/auth/login-pin",
        {
          phone_number: branchPhone,
          pin: "1111",
          device_id: branchDeviceId,
        },
        { validateStatus: () => true }
      )
      expect(invalidPinResponse.status).toBe(401)

      const deviceMismatchResponse = await api.post(
        "/auth/login-pin",
        {
          phone_number: branchPhone,
          pin: "8642",
          device_id: secondDeviceId,
        },
        { validateStatus: () => true }
      )
      expect(deviceMismatchResponse.status).toBe(423)

      const ownerHeaders = buildAuthHeaders(
        shopId,
        ownerPhone,
        ownerUserId,
        "owner"
      )
      const resetResponse = await api.patch(
        `/pos/staff/${branchUserId}`,
        {
          regenerate_recovery_code: true,
          reset_device_binding: true,
        },
        { headers: ownerHeaders }
      )
      expect(resetResponse.status).toBe(200)
      expect(typeof resetResponse.data.recovery_code).toBe("string")

      const recoverResponse = await api.post("/auth/recover-staff-access", {
        phone_number: branchPhone,
        recovery_code: resetResponse.data.recovery_code,
        new_pin: "9753",
        device_id: secondDeviceId,
      })
      expect(recoverResponse.status).toBe(200)
      expect(recoverResponse.data.next_step).toBe("home")
    })

    it("lets owners manage branches and staff while blocking branch managers from branch admin actions", async () => {
      const ownerHeaders = buildAuthHeaders(
        shopId,
        ownerPhone,
        ownerUserId,
        "owner"
      )
      const branchHeaders = buildAuthHeaders(
        shopId,
        branchPhone,
        branchUserId,
        "branch_manager",
        [branchLocationId],
        [branchTerminalId]
      )

      const createLocationResponse = await api.post(
        "/pos/locations",
        {
          name: "CBD Branch",
          code: "cbd",
          location_type: "physical",
        },
        { headers: ownerHeaders }
      )

      expect(createLocationResponse.status).toBe(201)

      const createStaffResponse = await api.post(
        "/pos/staff",
        {
          full_name: "Cashier Jane",
          phone_number: "0712345678",
          pin: "4321",
          role: "cashier",
          assigned_location_ids: [branchLocationId],
          assigned_terminal_ids: [branchTerminalId],
        },
        { headers: ownerHeaders }
      )

      expect(createStaffResponse.status).toBe(201)
      expect(createStaffResponse.data.staff_user).toEqual(
        expect.objectContaining({
          role: "cashier",
          assigned_location_ids: [branchLocationId],
          assigned_terminal_ids: [branchTerminalId],
        })
      )

      const branchLocationsResponse = await api.get("/pos/locations", {
        headers: branchHeaders,
      })
      expect(branchLocationsResponse.status).toBe(200)
      expect(branchLocationsResponse.data.locations).toHaveLength(1)
      expect(branchLocationsResponse.data.locations[0].id).toBe(branchLocationId)

      const branchTerminalsResponse = await api.get("/pos/terminals", {
        headers: branchHeaders,
      })
      expect(branchTerminalsResponse.status).toBe(200)
      expect(branchTerminalsResponse.data.terminals).toHaveLength(1)
      expect(branchTerminalsResponse.data.terminals[0].id).toBe(branchTerminalId)

      const createTerminalResponse = await api.post(
        "/pos/terminals",
        {
          name: "Checkout 2",
          code: "checkout-2",
          location_id: branchLocationId,
        },
        { headers: ownerHeaders }
      )
      expect(createTerminalResponse.status).toBe(201)

      const auditLogResponse = await api.get("/pos/audit-logs", {
        headers: ownerHeaders,
      })
      expect(auditLogResponse.status).toBe(200)
      expect(auditLogResponse.data.logs.length).toBeGreaterThan(0)

      const auditExportResponse = await api.get("/pos/audit-logs/export", {
        headers: ownerHeaders,
      })
      expect(auditExportResponse.status).toBe(200)
      expect(auditExportResponse.data.export).toEqual(
        expect.objectContaining({
          shop_id: shopId,
          chain_valid: true,
          total_entries: expect.any(Number),
          entries: expect.arrayContaining([
            expect.objectContaining({
              entry_hash: expect.any(String),
            }),
          ]),
        })
      )

      const forbiddenCreateLocation = await api.post(
        "/pos/locations",
        {
          name: "Not Allowed",
          code: "nope",
          location_type: "physical",
        },
        { headers: branchHeaders, validateStatus: () => true }
      )

      expect(forbiddenCreateLocation.status).toBe(403)

      const forbiddenAuditView = await api.get("/pos/audit-logs", {
        headers: branchHeaders,
        validateStatus: () => true,
      })
      expect(forbiddenAuditView.status).toBe(403)

      const forbiddenAuditExport = await api.get("/pos/audit-logs/export", {
        headers: branchHeaders,
        validateStatus: () => true,
      })
      expect(forbiddenAuditExport.status).toBe(403)

      const forbiddenStaffView = await api.get("/pos/staff", {
        headers: branchHeaders,
        validateStatus: () => true,
      })

      expect(forbiddenStaffView.status).toBe(403)
    })
  },
})
