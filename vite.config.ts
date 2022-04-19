import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import postcssPresetEnv from "postcss-preset-env";
import crossOriginIsolation from "vite-plugin-cross-origin-isolation";
import pluginRewriteAll from "vite-plugin-rewrite-all";
import { Plugin } from "vite";

function hmrFullReloadPlugin(): Plugin {
  return {
    name: "vite-plugin-full-reload",
    apply: "serve",
    handleHotUpdate({ server }) {
      server.ws.send({
        type: "full-reload",
      });
      return [];
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [pluginRewriteAll(), react(), crossOriginIsolation(), hmrFullReloadPlugin()],
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
