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
  // Shorten timeout for demo so timeouts appear quickly
  request: {
    timeoutMs: 5000,
  },
  // In-process worker pool config for demo
  workerPool: {
    // Number of concurrent workers (simulate limited server capacity)
    concurrency: 4,
    // Maximum queued requests allowed before rejecting (for demo)
    maxQueueSize: 200,
  },
  redis: {
    url: process.env.REDIS_URL as string
  },
  server: {
    port: 3000,
  },
};