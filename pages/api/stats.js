/**
 * /api/stats
 *
 * Monitor proxy health and rate limiter state
 * Serverless-compatible stats endpoint
 */

import { getStats } from "@/lib/rateLimiter.js";
import { deduplicator } from "@/lib/deduplicator.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.status(200).json({
    proxy: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      runtime: process.env.VERCEL ? "vercel-serverless" : "node",
    },
    limiters: {
      signed: getStats(),
    },
    deduplicator: deduplicator.getStats(),
  });
}

export const runtime = "edge";
