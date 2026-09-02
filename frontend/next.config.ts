import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Proxy all /api/* requests to the backend.
    // BACKEND_URL is a server-only env var (no NEXT_PUBLIC_ prefix).
    // In development it defaults to http://localhost:5001.
    // In production set BACKEND_URL in your hosting environment.
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5001";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
