import { createMDX } from "fumadocs-mdx/next";
import { fileURLToPath } from "node:url";

const withMDX = createMDX();

export default withMDX({
  reactStrictMode: true,
  // Include shared dependencies and ../../docs. OpenNext uses the same root lockfile
  // to locate this app within the standalone build.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  // Keep existing page, markdown, and preview URLs working after the rename.
  redirects() {
    return [
      {
        source: "/docs/introduction/quick-start",
        destination: "/docs/introduction/installation",
        permanent: true,
      },
    ];
  },
});
