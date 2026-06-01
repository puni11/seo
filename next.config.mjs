/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Tells Next.js not to bundle these dependencies
    serverComponentsExternalPackages: [
      'playwright-core',
      '@sparticuz/chromium-min'
    ],
    // Explicitly include the playwright-core files in the Vercel function output
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/playwright-core/**/*'],
    },
  },
};

export default nextConfig;