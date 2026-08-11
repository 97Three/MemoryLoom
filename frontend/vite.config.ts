import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

/**
 * The console is a single-page application served by the Python frontend process
 * together with a runtime-generated `runtime-config.js`. Four build settings matter:
 *
 * - `outDir` points at the packaged static directory, so `pnpm build` is the only
 *   step between source and the artifact the Python server actually serves.
 * - `emptyOutDir` keeps that directory authoritative, so stale hashed assets never
 *   linger after a reskin.
 * - `modulePreload.polyfill: false` removes the inline bootstrap script Vite would
 *   otherwise inject, because the static server ships `script-src 'self'` and an
 *   inline script would be blocked.
 * - Element Plus is resolved per component and per style, so the bundle only pays
 *   for the ~15 components the console actually renders.
 */
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: "src/auto-imports.d.ts",
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: "src/components.d.ts",
    }),
  ],
  base: "./",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "../src/memoryloom/api/static",
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 700,
  },
  server: { port: 5174, strictPort: true },
});
