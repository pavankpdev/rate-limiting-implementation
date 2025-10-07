export const config = {
  rateLimit: {
    guest: {
      maxRequests: 2,
      windowMs: 60000,
    },
    authenticated: {
      maxRequests: 8,
      windowMs: 60000,
    },
  },
  request: {
    timeoutMs: 20000,
  },
  redis: {
    url: process.env.REDIS_URL as string
  },
  server: {
    port: 3000,
  },
};