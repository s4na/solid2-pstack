import solid from "@solidjs/vite-plugin";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    stylex.vite({ runtimeInjection: false }),
    solid(),
  ],
  optimizeDeps: { exclude: ["@ui-sdk/core"] },
});
