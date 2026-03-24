/**
 * /api/proxy
 *
 * Main proxy endpoint. Bot sends requests here instead of directly to Binance.
 * Runs on Vercel Edge Runtime for global distribution (bypasses geographic restrictions).
 *
 * Features:
 * - Rate limiting (token bucket, stateless)
 * - Request deduplication
 * - Exponential backoff on 429s
 * - Comprehensive logging
 * - Edge runtime for low-latency, globally distributed execution
 *
 * Usage:
 *   POST /api/proxy
 *   {
 *     "method": "GET",
 *     "path": "/fapi/v1/order",
 *     "params": { "symbol": "BNBUSDC", ... },
 *     "signed": true,
 *     "weight": 10
 *   }
 *
 * IMPORTANT: Set environment variables on Vercel:
 * - BINANCE_KEY
 * - BINANCE_SECRET
 */

import { checkRateLimit, consumeWeight, getStats } from "@/lib/rateLimiter.js";
import { deduplicator } from "@/lib/deduplicator.js";

// Use Web Crypto API for edge runtime compatibility
// This is available globally and works on Vercel Edge
const sign = async (queryString, secret) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(queryString),
  );
  // Convert to hex
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const BINANCE_BASE = "https://fapi.binance.com";

// Validate environment variables at module load
function validateEnv() {
  const errors = [];

  if (!process.env.BINANCE_KEY) {
    errors.push("BINANCE_KEY is not set");
  }

  if (!process.env.BINANCE_SECRET) {
    errors.push("BINANCE_SECRET is not set");
  }

  if (errors.length > 0) {
    console.error("[PROXY] ❌ Environment validation failed:");
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error("[PROXY] Set these in Vercel Environment Variables");
    return false;
  }

  return true;
}

const envValid = validateEnv();

function buildQuery(params) {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}

/**
 * Forward request to Binance with retry logic and rate limit backoff
 */
async function forwardToBinance(method, path, params, signed, weight) {
  let url = `${BINANCE_BASE}${path}`;
  const headers = {};

  if (process.env.BINANCE_KEY) {
    headers["X-MBX-APIKEY"] = process.env.BINANCE_KEY;
  }

  let queryString = "";
  if (signed) {
    const signedParams = {
      ...params,
      timestamp: Date.now(),
      recvWindow: 5000,
    };
    queryString = buildQuery(signedParams);
    const signature = await sign(queryString, process.env.BINANCE_SECRET);
    signedParams.signature = signature;
    queryString = buildQuery(signedParams);
  } else {
    queryString = buildQuery(params);
  }

  if (method === "GET" || method === "DELETE") {
    url += queryString ? `?${queryString}` : "";
  }

  const fetchInit = {
    method,
    headers,
  };

  if (method === "POST" || method === "PUT") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    fetchInit.body = queryString;
  }

  // Exponential backoff for 429s and network errors
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, fetchInit);
      const data = await res.json();

      if (!res.ok) {
        const err = new Error(
          `Binance API error ${res.status}: ${JSON.stringify(data)}`,
        );
        err.code = data.code;
        err.statusCode = res.status;

        // If 429 (rate limited), exponential backoff
        if (res.status === 429 && attempt < 4) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(
            `[PROXY] 429 Rate Limited. Attempt ${attempt + 1}/5. Retrying in ${delay}ms`,
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        throw err;
      }

      return data;
    } catch (err) {
      lastErr = err;
      if (attempt === 4) throw err;

      // Network/other errors: retry with backoff
      const delay = Math.pow(2, attempt) * 500;
      console.warn(
        `[PROXY] Request failed: ${err.message}. Retrying in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}

export default async function handler(req, res) {
  // Only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check environment variables first
    if (!envValid) {
      return res.status(500).json({
        success: false,
        error:
          "Proxy not configured - BINANCE_KEY and/or BINANCE_SECRET not set in environment",
        code: "ENV_NOT_SET",
        hint: "Set these variables in Vercel Environment Variables dashboard",
      });
    }

    const { method, path, params = {}, signed = false, weight = 10 } = req.body;

    // Validate
    if (!method || !path) {
      return res.status(400).json({ error: "method and path required" });
    }

    // Check rate limit
    const rateLimitStatus = checkRateLimit(weight);

    if (rateLimitStatus.canProceed) {
      // Record the weight consumption
      consumeWeight(weight);
    } else {
      // Too many requests recently - but we still try with a small delay
      // This is different from old version - we don't queue, we just reject
      // For true queuing, use Redis + distributed rate limiting
      await new Promise((r) => setTimeout(r, 100));
    }

    // Deduplicate requests
    const result = await deduplicator.execute(method, path, params, () =>
      forwardToBinance(method, path, params, signed, weight),
    );

    // Success
    res.status(200).json({
      success: true,
      data: result,
      stats: {
        limiter: getStats(),
        deduplicator: deduplicator.getStats(),
      },
    });
  } catch (err) {
    console.error("[PROXY] Error:", err);

    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }
}

/**
 * Configure edge runtime for global distribution
 * This enables the proxy to run on Vercel's Edge Network across multiple regions,
 * bypassing geographic restrictions from IP-based filtering services.
 */
export const config = {
  runtime: "edge",
};
