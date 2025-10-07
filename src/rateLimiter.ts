import { createClient } from 'redis';
import { config } from './config';

export type RedisClientType = ReturnType<typeof createClient>;

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
}

/**
 * Check if a request is allowed based on rate limiting rules using sliding window pattern
 * @param redisClient - Redis client instance
 * @param userId - Unique identifier for the user
 * @param isAuthenticated - Whether the user is authenticated
 * @returns Promise with rate limit result
 */
export async function checkRateLimit(
  redisClient: RedisClientType,
  userId: string,
  isAuthenticated: boolean
): Promise<RateLimitResult> {
  const key = `rate_limit:${userId}`;
  const now = Date.now();
  
  // Get rate limit config based on authentication status
  const limitConfig = isAuthenticated 
    ? config.rateLimit.authenticated 
    : config.rateLimit.guest;
  
  const { maxRequests, windowMs } = limitConfig;
  const windowStart = now - windowMs;

  try {
    // Remove expired entries (older than the window)
    await redisClient.zRemRangeByScore(key, 0, windowStart);

    // Count current requests in the window
    const currentCount = await redisClient.zCard(key);

    // Check if request is allowed
    const allowed = currentCount < maxRequests;

    if (allowed) {
      // Add current request timestamp to the sorted set
      await redisClient.zAdd(key, {
        score: now,
        value: `${now}`,
      });

      // Set expiration on the key to auto-cleanup (window duration + buffer)
      await redisClient.expire(key, Math.ceil(windowMs / 1000) + 10);
    }

    // Calculate remaining requests
    const remainingRequests = Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0));

    // Calculate reset time (when the oldest request in window expires)
    let resetTime = now + windowMs;
    
    if (currentCount > 0) {
      // Get the oldest request timestamp in the current window
      const oldestRequests = await redisClient.zRange(key, 0, 0, {
        REV: false,
      });
      
      if (oldestRequests.length > 0) {
        const oldestTimestamp = parseInt(oldestRequests[0], 10);
        resetTime = oldestTimestamp + windowMs;
      }
    }

    return {
      allowed,
      remainingRequests,
      resetTime,
    };
  } catch (error) {
    console.error('Rate limiter error:', error);
    // On Redis errors, fail open (allow the request) to prevent service disruption
    return {
      allowed: true,
      remainingRequests: maxRequests,
      resetTime: now + windowMs,
    };
  }
}