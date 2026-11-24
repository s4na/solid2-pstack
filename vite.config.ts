import solid from "@solidjs/vite-plugin";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    stylex.vite({ runtimeInjection: false }),
    solid(),
  ],
  server: { proxy: { "/api": `http://127.0.0.1:${process.env.MARKET_PORT ?? "8088"}` } },
  optimizeDeps: { exclude: ["@ui-sdk/core"] },
});
