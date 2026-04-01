import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import Redis, { type RedisOptions } from "ioredis"

type RateLimitOptions = {
  windowMs: number
  max: number
  message: string
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimitStoreResult = {
  allowed: boolean
  retryAfterSeconds?: number
}

export function createInMemoryRateLimiter(options: RateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>()

  return function rateLimit(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) {
    const forwardedFor = req.headers["x-forwarded-for"]
    const ipHeader = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor
    const key = String(ipHeader ?? req.ip ?? "unknown")
    const now = Date.now()
    const current = entries.get(key)

    if (!current || current.resetAt <= now) {
      entries.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      })
      next()
      return
    }

    if (current.count >= options.max) {
      res.status(429).json({
        message: options.message,
        retry_after_seconds: Math.ceil((current.resetAt - now) / 1000),
      })
      return
    }

    current.count += 1
    entries.set(key, current)
    next()
  }
}

function getRequestKey(req: MedusaRequest) {
  const forwardedFor = req.headers["x-forwarded-for"]
  const ipHeader = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor

  return String(ipHeader ?? req.ip ?? "unknown")
}

function createRedisClient(redisUrl: string) {
  const parsed = new URL(redisUrl)

  const options: RedisOptions = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.replace("/", "")) || 0 : 0,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: undefined,
  }

  return new Redis(options)
}

export function createRedisBackedRateLimiter(options: RateLimitOptions) {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    return createInMemoryRateLimiter(options)
  }

  const fallbackLimiter = createInMemoryRateLimiter(options)
  const redis = createRedisClient(redisUrl)
  let redisReady = false
  let redisDisabled = false

  redis.on("ready", () => {
    redisReady = true
    redisDisabled = false
  })

  redis.on("error", () => {
    redisReady = false
    if (!redisDisabled) {
      redisDisabled = true
      redis.disconnect()
    }
  })

  async function incrementInRedis(key: string): Promise<RateLimitStoreResult> {
    if (!redisReady) {
      try {
        await redis.connect()
      } catch {
        redisDisabled = true
        redis.disconnect()
        throw new Error("redis_unavailable")
      }
    }

    const namespacedKey = `rate-limit:${key}`
    const current = await redis.incr(namespacedKey)

    if (current === 1) {
      await redis.pexpire(namespacedKey, options.windowMs)
    }

    if (current <= options.max) {
      return { allowed: true }
    }

    const ttl = await redis.pttl(namespacedKey)

    return {
      allowed: false,
      retryAfterSeconds:
        ttl > 0 ? Math.ceil(ttl / 1000) : Math.ceil(options.windowMs / 1000),
    }
  }

  return async function redisRateLimit(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) {
    if (redisDisabled) {
      fallbackLimiter(req, res, next)
      return
    }

    try {
      const key = getRequestKey(req)
      const result = await incrementInRedis(key)

      if (result.allowed) {
        next()
        return
      }

      res.status(429).json({
        message: options.message,
        retry_after_seconds: result.retryAfterSeconds ?? null,
      })
    } catch {
      redisDisabled = true
      redis.disconnect()
      fallbackLimiter(req, res, next)
    }
  }
}
