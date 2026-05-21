import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // When ~/package-lock.json exists, Next may infer the wrong root.
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    // Allow PDF uploads up to 20 MB (default is 4 MB)
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
