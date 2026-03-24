/**
 * /api/stats
 * 
 * Monitor proxy health and rate limiter state
 */

import { signedLimiter, publicLimiter } from '@/lib/rateLimiter';
import { deduplicator } from '@/lib/deduplicator';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.status(200).json({
    proxy: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
    limiters: {
      signed: signedLimiter.getStats(),
      public: publicLimiter.getStats(),
    },
    deduplicator: deduplicator.getStats(),
  });
}
