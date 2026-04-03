import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } },
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] },
}

export default config
