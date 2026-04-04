import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } },
  outputFileTracingIncludes: { "/middleware": ["./middleware.ts"] },
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] },
}

export default config
