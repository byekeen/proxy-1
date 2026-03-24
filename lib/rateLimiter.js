/**
 * Token Bucket Rate Limiter
 * - Binance limits to 1200 weight per minute for orders and positions
 * - 10 weight for most endpoints, 40 for position queries
 * - This queue-based limiter prevents burst-induced 429s
 */

class RateLimiter {
  constructor(options = {}) {
    // Weight capacity per minute (1200 for signed, 6000 for public)
    this.capacity = options.capacity || 1200;
    this.windowMs = options.windowMs || 60_000; // 1 minute
    
    this.tokens = this.capacity;
    this.lastRefillTime = Date.now();
    
    // Queue for when we hit limits
    this.queue = [];
    this.processing = false;
    
    // Tracking
    this.totalRequests = 0;
    this.totalRejected = 0;
    this.totalQueued = 0;
  }

  /**
   * Refill tokens based on elapsed time
   */
  _refillTokens() {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const tokensToAdd = (elapsed / this.windowMs) * this.capacity;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Try to acquire tokens immediately. If not enough, queue the request.
   * Returns a promise that resolves when request can proceed.
   */
  async acquire(weight = 10) {
    return new Promise((resolve) => {
      this._refillTokens();
      
      if (this.tokens >= weight) {
        this.tokens -= weight;
        this.totalRequests++;
        resolve();
      } else {
        // Queue it
        this.totalQueued++;
        this.queue.push({ weight, resolve });
        this._processQueue();
      }
    });
  }

  /**
   * Process queued requests when tokens are available
   */
  _processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const interval = setInterval(() => {
      this._refillTokens();

      while (this.queue.length > 0) {
        const { weight, resolve } = this.queue[0];
        
        if (this.tokens >= weight) {
          this.tokens -= weight;
          this.queue.shift();
          this.totalRequests++;
          resolve();
        } else {
          break; // Wait for next refill
        }
      }

      if (this.queue.length === 0) {
        clearInterval(interval);
        this.processing = false;
      }
    }, 100); // Check every 100ms
  }

  getStats() {
    return {
      tokensAvailable: Math.floor(this.tokens),
      tokensCapacity: this.capacity,
      queued: this.queue.length,
      totalRequests: this.totalRequests,
      totalQueued: this.totalQueued,
    };
  }
}

// Global limiter for signed requests (critical path)
export const signedLimiter = new RateLimiter({ capacity: 1200 });

// Global limiter for public requests (more generous)
export const publicLimiter = new RateLimiter({ capacity: 6000 });
