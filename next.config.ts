import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } },
  skipMiddlewareUrlNormalize: true,
  
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] },
}

export default config
