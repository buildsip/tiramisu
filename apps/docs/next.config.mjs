import { createMDX } from "fumadocs-mdx/next";
import { fileURLToPath } from "node:url";

const withMDX = createMDX();

export default withMDX({
  reactStrictMode: true,
  // Only load the brand icons used on the page from LobeHub's large export list.
  experimental: {
    optimizePackageImports: ["@lobehub/icons"],
  },
  // Include shared dependencies and ../../docs. OpenNext uses the same root lockfile
  // to locate this app within the standalone build.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
});
