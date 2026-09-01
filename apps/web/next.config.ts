import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Workspace packages ship TypeScript source, so Next compiles them itself. */
  transpilePackages: ["@repo/types", "@repo/mock", "@repo/data", "@repo/ui"],
  typedRoutes: false,
};

export default nextConfig;
