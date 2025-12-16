/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output optimizes for production deployment
  output: 'standalone',
  
  reactStrictMode: true,
  
  // Allow uploads from our backend
  images: {
    domains: ['localhost'].concat(
      process.env.RENDER_EXTERNAL_URL 
        ? [new URL(process.env.RENDER_EXTERNAL_URL).hostname]
        : ['party-sync-watch.onrender.com']
    ),
  },

  // Environment variables accessible to the browser
  env: {
    NEXT_PUBLIC_SOCKET_URL: process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001',
  },

  // Allow uploaded videos to be served
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
        ],
      },
    ]
  },

  // Ignore websocket warnings
  webpack: (config) => {
    config.ignoreWarnings = [
      { module: /node_modules\/ws\/lib\// }
    ]
    return config
  }
}

module.exports = nextConfig