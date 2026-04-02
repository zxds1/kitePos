import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
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
      resolve: "./src/modules/otp-challenge",
    },
  ],
})
