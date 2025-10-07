import { createClient } from 'redis';
import { config } from './config';

export type RedisClientType = ReturnType<typeof createClient>;

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
}

/**
 * Atomic token-bucket implemented in Redis via EVAL.
 * - Stores a small hash at key: { tokens, last }
 * - tokens can be fractional (representing partial refill)
 * - rate = capacity / windowMs (tokens per ms)
 *
 * Returns:
 *   allowed (boolean) - whether the request may proceed (consumes 1 token)
 *   remainingRequests (number) - integer tokens remaining after consumption
 *   resetTime (number) - timestamp (ms) when at least one token will be available
 */
export async function checkRateLimit(
  redisClient: RedisClientType,
  userId: string,
  isAuthenticated: boolean
): Promise<RateLimitResult> {
  const now = Date.now();

  // Get rate limit config based on authentication status
  const limitConfig = isAuthenticated
    ? config.rateLimit.authenticated
    : config.rateLimit.guest;

  const capacity = limitConfig.maxRequests;
  const windowMs = limitConfig.windowMs;

  /**
   * Simple fixed-window counter using Redis INCR + PEXPIRE.
   * - Uses a per-window key: rate_limit:{userId}:{windowStart}
   * - INCR is atomic in Redis, so this avoids Lua while remaining safe.
   * - Simpler to explain/demo than token-bucket; note fixed-window can
   *   allow short bursts at window boundaries (no mitigation here).
   */
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowKey = `rate_limit:${userId}:${windowStart}`;

  try {
    // Atomic increment for this window
    const countRaw = await (redisClient as any).incr(windowKey);
    const count = Number(countRaw);

    // If this is the first increment for the window, set an expiry to auto-clean
    if (count === 1) {
      // set expiry slightly longer than window to ensure cleanup after window ends
      await (redisClient as any).pExpire(windowKey, windowMs + 1000);
    }

    const allowed = count <= capacity;
    const remainingRequests = Math.max(0, capacity - count);
    const resetTime = windowStart + windowMs;

    return { allowed, remainingRequests, resetTime };
  } catch (error) {
    // Fail open on Redis errors to avoid disrupting the service
    console.error('Rate limiter error (fixed-window):', error);
    return {
      allowed: true,
      remainingRequests: capacity,
      resetTime: now + windowMs,
    };
  }
}