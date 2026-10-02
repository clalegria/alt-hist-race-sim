import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // The router plugin goes first: it writes `src/routeTree.gen.ts` from the
  // files in `src/routes/`, which React's transform then compiles like any other.
  plugins: [tanstackRouter({ target: "react" }), react(), tailwindcss()],
  // The workspace packages export TypeScript source with no build step, so they
  // must go through Vite's transform rather than be pre-bundled as dependencies.
  optimizeDeps: {
    exclude: ["@alt-hist/engine", "@alt-hist/data"],
  },
});
