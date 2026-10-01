import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/buyme/extension": ["./extensions/buyme-connect/**/*"],
  },
};

export default nextConfig;
