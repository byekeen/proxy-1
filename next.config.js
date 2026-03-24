/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build configuration
  productionBrowserSourceMaps: false,
  reactStrictMode: false,
  poweredByHeader: false,
  compress: true,
  
  // API Routes - use serverless, NOT edge runtime (edge doesnt support state/intervals)
  experimental: {
    cacheMaxMemorySize: 52 * 1024 * 1024, // 52MB for ISR cache
  },
  
  // Environment variables
  env: {
    BINANCE_KEY: process.env.BINANCE_KEY,
    BINANCE_SECRET: process.env.BINANCE_SECRET,
  },

  // Webpack optimization
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('crypto');
    }
    return config;
  },
};

module.exports = nextConfig;
