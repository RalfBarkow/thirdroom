import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import postcssPresetEnv from "postcss-preset-env";
import crossOriginIsolation from "vite-plugin-cross-origin-isolation";
import pluginRewriteAll from "@thirdroom/vite-plugin-rewrite-all";
import { serviceWorkerPlugin } from "@gautemo/vite-plugin-service-worker";
import path from "path";

import testnetServerPlugin from "./src/testnet";

// https://vitejs.dev/config/
export default defineConfig({
  appType: "mpa",
  server: {
    port: 3000,
  },
  plugins: [
    pluginRewriteAll({
      rewrites: [{ from: /\/logviewer$/, to: "/logviewer.html" }],
    }),
    react(),
    crossOriginIsolation(),
    testnetServerPlugin(),
    serviceWorkerPlugin({
      filename: "sw.ts",
    }),
  ],
  resolve: {
    dedupe: ["three", "bitecs"],
  },
  css: {
    postcss: {
      plugins: [
        postcssPresetEnv({
          stage: 1,
          browsers: "last 2 versions",
          autoprefixer: true,
        }) as any, // postcss-preset-env type definitions are out of date
      ],
    },
  },
  define: {
    "import.meta.vitest": "undefined",
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        logviewer: path.resolve(__dirname, "logviewer.html"),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./test/setup.ts",
    includeSource: ["src/**/*.{ts,tsx}"],
    coverage: {
      all: true,
      include: ["src/**/*.{ts,tsx}"],
    },
  },
});
