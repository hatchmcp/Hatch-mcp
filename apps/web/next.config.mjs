/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hatchmcp/shared'],
  devIndicators: {
    position: 'bottom-right',
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000'}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
