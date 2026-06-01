/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Tells Next.js not to bundle these specifically
    serverComponentsExternalPackages: [
      'playwright-core', 
      '@sparticuz/chromium-min'
    ],
    // Explicitly include the playwright-core files in the serverless function output
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/playwright-core/**/*'],
    },
  },
};

module.exports = nextConfig;