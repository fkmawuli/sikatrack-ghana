import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This machine has very little free RAM; cap parallel build workers so
  // `next build` doesn't spawn enough Node processes to exhaust memory.
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
