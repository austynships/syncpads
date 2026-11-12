import Redis from "ioredis";

// One shared Redis connection, reused across hot reloads in development.
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    lazyConnect: true, // don't connect during `next build`
    maxRetriesPerRequest: 2,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

