import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["172.20.224.1"],
  serverExternalPackages: [
    "@laihoe/demoparser2",
    "bullmq",
    "ioredis",
    "steam-user",
    "globaloffensive",
    "@doctormckay/steam-crypto",
  ],
  outputFileTracingIncludes: {
    "/api/upload-demo": [
      "./node_modules/@laihoe/demoparser2/**/*",
      "./node_modules/@laihoe/demoparser2-linux-x64-musl/**/*",
      "./node_modules/@laihoe/demoparser2-linux-x64-gnu/**/*",
      "./node_modules/@laihoe/demoparser2-linux-arm64-musl/**/*",
      "./node_modules/@laihoe/demoparser2-linux-arm64-gnu/**/*",
    ],
  },
  experimental: {
    // CS2 demos are often 50–300 MB; default proxy buffer is 10 MB.
    proxyClientMaxBodySize: "500mb",
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
