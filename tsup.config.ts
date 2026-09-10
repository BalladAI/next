import { defineConfig } from "tsup";

// Three entries, all ESM (react-markdown is ESM-only, and Next.js consumes
// ESM packages natively): the core (no React, no Next runtime), the React
// renderer, and the App Router page factories.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react/index.ts",
    pages: "src/pages/index.tsx",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  platform: "neutral",
  external: ["react", "react/jsx-runtime", "next", "react-markdown", "remark-gfm"],
});
