import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // When ~/package-lock.json exists, Next may infer the wrong root.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
