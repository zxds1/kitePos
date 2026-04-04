import {
  authenticate,
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import {
  AdminCreateInventoryConfig,
} from "./admin/inventory-configs/validators"
import { AdminCreateRestock } from "./admin/restocks/validators"
import {
  AdminCreateSaleSnapshot,
} from "./admin/sale-snapshots/validators"
import { AdminCreateAdjustment } from "./admin/inventory/adjustments/validator"
import { AdminBatchSalesRequest } from "./admin/inventory/batch-sales/validator"
import { AdminCreateShop } from "./admin/shops/validators"
import { createRedisBackedRateLimiter } from "./admin/_utils/rate-limit"
import { AdminValidateSaleRequest } from "./admin/inventory/validate-sale/validator"
import {
  AuthRegisterShop,
  AuthRequestOtp,
  AuthVerifyOtp,
} from "./auth/validators"

function normalizeAccessTokenHeader(
  req: MedusaRequest,
  _: MedusaResponse,
  next: MedusaNextFunction
) {
  const accessToken = req.headers["x-medusa-access-token"]

  if (!req.headers.authorization && typeof accessToken === "string") {
    req.headers.authorization = `Bearer ${accessToken}`
  }

  next()
}

const adminAuthMiddlewares = [
  normalizeAccessTokenHeader,
  authenticate("user", ["bearer", "session"]),
]

const batchSalesRateLimiter = createRedisBackedRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many sync requests, please try again later",
})

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/auth/request-otp",
      middlewares: [validateAndTransformBody(AuthRequestOtp)],
    },
    {
      method: ["POST"],
      matcher: "/auth/verify-otp",
      middlewares: [validateAndTransformBody(AuthVerifyOtp)],
    },
    {
      method: ["POST"],
      matcher: "/auth/register-shop",
      middlewares: [validateAndTransformBody(AuthRegisterShop)],
    },
    {
      method: ["GET"],
      matcher: "/admin/shops",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["POST"],
      matcher: "/admin/shops",
      middlewares: [
        ...adminAuthMiddlewares,
        validateAndTransformBody(AdminCreateShop),
      ],
    },
    {
      method: ["GET"],
      matcher: "/admin/dashboard/overview",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["GET"],
      matcher: "/admin/inventory-configs",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["GET", "POST"],
      matcher: "/admin/ai-config",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["POST"],
      matcher: "/admin/inventory-configs",
      middlewares: [
        ...adminAuthMiddlewares,
        validateAndTransformBody(AdminCreateInventoryConfig),
      ],
    },
    {
      method: ["GET"],
      matcher: "/admin/inventory-configs/*",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["GET"],
      matcher: "/admin/restocks",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["POST"],
      matcher: "/admin/restocks",
      middlewares: [
        ...adminAuthMiddlewares,
        validateAndTransformBody(AdminCreateRestock),
      ],
    },
    {
      method: ["GET"],
      matcher: "/admin/sale-snapshots",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["POST"],
      matcher: "/admin/sale-snapshots",
      middlewares: [
        ...adminAuthMiddlewares,
        validateAndTransformBody(AdminCreateSaleSnapshot),
      ],
    },
    {
      method: ["POST"],
      matcher: "/admin/inventory/validate-sale",
      middlewares: [
        ...adminAuthMiddlewares,
        validateAndTransformBody(AdminValidateSaleRequest),
      ],
    },
    {
      method: ["GET"],
      matcher: "/admin/inventory/adjustments",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["POST"],
      matcher: "/admin/inventory/adjustments",
      middlewares: [
        ...adminAuthMiddlewares,
        validateAndTransformBody(AdminCreateAdjustment),
      ],
    },
    {
      method: ["POST"],
      matcher: "/admin/inventory/batch-sales",
      middlewares: [
        batchSalesRateLimiter,
        ...adminAuthMiddlewares,
        validateAndTransformBody(AdminBatchSalesRequest),
      ],
    },
    {
      method: ["GET"],
      matcher: "/admin/inventory/sync-log",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["GET"],
      matcher: "/admin/shops/*/payment-settings",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["PATCH"],
      matcher: "/admin/shops/*/payment-settings",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["PATCH"],
      matcher: "/admin/shops/*/status",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["GET"],
      matcher: "/admin/analytics/payments",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["GET"],
      matcher: "/admin/analytics/revenue",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["GET"],
      matcher: "/admin/analytics/products",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["POST"],
      matcher: "/admin/data-export",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["GET", "POST"],
      matcher: "/partners/admin/partners",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["POST"],
      matcher: "/partners/admin/create",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["GET"],
      matcher: "/partners/admin/logs",
      middlewares: [...adminAuthMiddlewares],
    },
    {
      method: ["GET"],
      matcher: "/partners/admin/compliance-report",
      middlewares: [...adminAuthMiddlewares],
    },
  ],
})
