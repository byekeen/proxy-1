/**
 * Token Bucket Rate Limiter (Serverless-compatible)
 * - Binance limits to 1200 weight per minute for orders and positions
 * - 10 weight for most endpoints, 40 for position queries
 * - This queue-based limiter prevents burst-induced 429s
 * 
 * NOTE: Designed for serverless (stateless per-request calculation)
 * Use Redis for distributed rate limiting across multiple instances
 */

// In-memory state (WARNING: Lost on function cold start in serverless)
// For production, use Redis: https://upstash.com or similar
let requestLog = [];
const LOG_WINDOW = 60_000; // 1 minute
const CAPACITY = 1200; // weight per minute

/**
 * Returns stats and decides if request should proceed
 */
export function checkRateLimit(weight = 10) {
  const now = Date.now();
  
  // Clean old entries outside window
  requestLog = requestLog.filter(
    (entry) => now - entry.timestamp < LOG_WINDOW
  );

  // Calculate used weight in current window
  const usedWeight = requestLog.reduce((sum, entry) => sum + entry.weight, 0);
  const availableWeight = CAPACITY - usedWeight;
  
  const canProceed = availableWeight >= weight;

  return {
    canProceed,
    availableWeight: Math.max(0, availableWeight),
    availableCapacity: CAPACITY,
    queuedRequests: requestLog.length,
    usedWeight,
    totalRequests: requestLog.length,
  };
}

/**
 * Record a request as consumed
 */
export function consumeWeight(weight = 10) {
  requestLog.push({
    timestamp: Date.now(),
    weight,
  });
}

/**
 * Get current stats
 */
export function getStats() {
  const now = Date.now();
  requestLog = requestLog.filter(
    (entry) => now - entry.timestamp < LOG_WINDOW
  );
  
  const usedWeight = requestLog.reduce((sum, entry) => sum + entry.weight, 0);
  
  return {
    tokensAvailable: Math.max(0, CAPACITY - usedWeight),
    tokensCapacity: CAPACITY,
    requestsInWindow: requestLog.length,
    usedWeight,
  };
}

/**
 * Reset all state (for testing)
 */
export function reset() {
  requestLog = [];
}

