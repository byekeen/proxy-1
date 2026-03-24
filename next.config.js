/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Avoid double-mounting in dev
  poweredByHeader: false,
  compress: true,
};

module.exports = nextConfig;
