import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const shouldUseRedis =
  process.env.ENABLE_REDIS === 'true' || process.env.NODE_ENV === 'production'

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: shouldUseRedis ? process.env.REDIS_URL : undefined,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    {
      resolve: "./src/modules/shop",
    },
    {
      resolve: "./src/modules/ai-config",
    },
    {
      resolve: "./src/modules/ai-operation-log",
    },
    {
      resolve: "./src/modules/online-store",
    },
    {
      resolve: "./src/modules/shop-user",
    },
    {
      resolve: "./src/modules/shop-location",
    },
    {
      resolve: "./src/modules/shop-terminal",
    },
    {
      resolve: "./src/modules/inventory-config",
    },
    {
      resolve: "./src/modules/restock",
    },
    {
      resolve: "./src/modules/sale-snapshot",
    },
    {
      resolve: "./src/modules/adjustment",
    },
    {
      resolve: "./src/modules/analytics-snapshot",
    },
    {
      resolve: "./src/modules/audit-log",
    },
    {
      resolve: "./src/modules/partner",
    },
    {
      resolve: "./src/modules/data-export-log",
    },
    {
      resolve: "./src/modules/otp-challenge",
    },
    {
      resolve: "./src/modules/supplier",
    },
    {
      resolve: "./src/modules/purchase-order",
    },
    {
      resolve: "./src/modules/auto-reorder-rule",
    },
    {
      resolve: "./src/modules/notification",
    },
    {
      resolve: "./src/modules/loyalty-member",
    },
    {
      resolve: "./src/modules/loyalty-ledger",
    },
    {
      resolve: "./src/modules/loyalty-program",
    },
    {
      resolve: "./src/modules/loyalty-reward",
    },
    {
      resolve: "./src/modules/loyalty-redemption",
    },
    {
      resolve: "./src/modules/return-request",
    },
    {
      resolve: "./src/modules/return-reason",
    },
    {
      resolve: "./src/modules/refund-transaction",
    },
    {
      resolve: "./src/modules/shift-session",
    },
    {
      resolve: "./src/modules/tax-invoice",
    },
    {
      resolve: "./src/modules/vat-return",
    },
    {
      resolve: "./src/modules/tax-report",
    },
    {
      resolve: "./src/modules/input-vat-record",
    },
    {
      resolve: "./src/modules/tax-report-run",
    },
  ],
})
