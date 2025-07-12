import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/vi/**',
      },
    ],
  },
  // Ensure environment variables are available
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  },
};

export default nextConfig;