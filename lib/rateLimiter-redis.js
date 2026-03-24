/**
 * Token Bucket Rate Limiter (Redis-backed)
 * 
 * Use this for production with persistent rate limiting
 * across multiple Vercel function instances.
 * 
 * Install: npm install @upstash/redis
 * 
 * Replace this file:
 * 1. Rename current: lib/rateLimiter.js → lib/rateLimiter-memory.js
 * 2. Rename this: lib/rateLimiter-redis.js → lib/rateLimiter.js
 * 3. Update pages/api/proxy.js to import the new version
 * 
 * Set Vercel env:
 * - REDIS_URL=redis://default:...@...
 * - REDIS_TOKEN=your_token
 */

import { createClient } from '@upstash/redis';

const client = createClient({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

const CAPACITY = 1200; // weight per minute
const WINDOW_MS = 60_000; // 1 minute

/**
 * Check if request can proceed based on Redis rate limit state
 */
export async function checkRateLimit(weight = 10) {
  try {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const key = 'rate:limit:signed';

    // Remove entries older than window
    await client.zremrangebyscore(key, '-inf', `(${windowStart}`);

    // Get all entries in window (with scores = timestamps)
    const entries = await client.zrange(key, 0, -1, { withScores: true });

    // Calculate total weight used
    let usedWeight = 0;
    for (let i = 0; i < entries.length; i += 2) {
      const weightValue = parseInt(entries[i + 1], 10);
      usedWeight += weightValue;
    }

    const availableWeight = CAPACITY - usedWeight;
    const canProceed = availableWeight >= weight;

    return {
      canProceed,
      availableWeight: Math.max(0, availableWeight),
      availableCapacity: CAPACITY,
      requestsInWindow: Math.floor(entries.length / 2),
      usedWeight,
    };
  } catch (err) {
    console.error('[Redis Rate Limiter] Check failed:', err);
    // Fail open: allow request if Redis is down
    return {
      canProceed: true,
      error: err.message,
    };
  }
}

/**
 * Record weight consumption in Redis
 */
export async function consumeWeight(weight = 10) {
  try {
    const now = Date.now();
    const key = 'rate:limit:signed';
    const member = `${now}.${Math.random()}`;

    // Add entry with score = now and stored weight
    // Store weight as a companion entry for retrieval
    await client.zadd(key, {
      score: now,
      member: `${member}:${weight}`,
    });

    // Set expiry on key (24 hours)
    await client.expire(key, 86400);
  } catch (err) {
    console.error('[Redis Rate Limiter] Consume failed:', err);
    // Fail open: continue on Redis error
  }
}

/**
 * Get current stats from Redis
 */
export async function getStats() {
  try {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const key = 'rate:limit:signed';

    // Remove old entries
    await client.zremrangebyscore(key, '-inf', `(${windowStart}`);

    // Get all entries in window
    const entries = await client.zrange(key, 0, -1);

    // Parse weight from members (format: "id:weight")
    let usedWeight = 0;
    for (const entry of entries) {
      const [, weight] = entry.split(':');
      usedWeight += parseInt(weight, 10);
    }

    return {
      tokensAvailable: Math.max(0, CAPACITY - usedWeight),
      tokensCapacity: CAPACITY,
      requestsInWindow: entries.length,
      usedWeight,
    };
  } catch (err) {
    console.error('[Redis Rate Limiter] Stats failed:', err);
    return {
      tokensAvailable: CAPACITY,
      tokensCapacity: CAPACITY,
      error: err.message,
      redis_down: true,
    };
  }
}

/**
 * Reset rate limit (for testing)
 */
export async function reset() {
  try {
    await client.del('rate:limit:signed');
  } catch (err) {
    console.error('[Redis Rate Limiter] Reset failed:', err);
  }
}
