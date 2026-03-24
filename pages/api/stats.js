/**
 * /api/stats
 *
 * Monitor proxy health and rate limiter state
 * Also runs on edge runtime for consistent latency
 */

import { NextResponse } from "next/server";
import { getStats } from "@/lib/rateLimiter.js";
import { deduplicator } from "@/lib/deduplicator.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  return NextResponse.json({
    proxy: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      runtime: "vercel-edge",
      note: "Edge runtime enables global distribution and bypasses geographic restrictions",
    },
    limiters: {
      signed: getStats(),
    },
    deduplicator: deduplicator.getStats(),
  });
}

/**
 * Configure edge runtime for consistent latency
 */
export const config = {
  runtime: "edge",
};
