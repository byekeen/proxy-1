/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build configuration
  productionBrowserSourceMaps: false,
  reactStrictMode: false,
  poweredByHeader: false,
  compress: true,

  // Note: Do NOT expose secrets to browser via env object
  // API routes access process.env.BINANCE_KEY directly (serverless/edge only)
  
  // Webpack optimization - ensures proper handling of Web Crypto API in edge runtime
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark 'crypto' as external to prevent bundling Node.js crypto module
      // Edge runtime will use Web Crypto API (globalThis.crypto) instead
      config.externals.push('crypto');
    }
    return config;
  },
};

module.exports = nextConfig;
