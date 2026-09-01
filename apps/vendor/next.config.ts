import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/types", "@repo/mock", "@repo/data", "@repo/ui"],
  typedRoutes: false,
};

export default nextConfig;
