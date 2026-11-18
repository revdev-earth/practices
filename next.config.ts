import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The browser tests run their own server next to the one used for development, each with its own build folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
}

export default nextConfig
