import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The workspace packages export TypeScript source with no build step, so they
  // must go through Vite's transform rather than be pre-bundled as dependencies.
  optimizeDeps: {
    exclude: ["@alt-hist/engine", "@alt-hist/data"],
  },
});
