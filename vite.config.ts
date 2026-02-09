import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const plugins = [react()];

  if (process.env.ANALYZE === "true") {
    const { visualizer } = await import("rollup-plugin-visualizer");
    plugins.push(visualizer({ open: true, filename: "dist/bundle-stats.html", gzipSize: true }));
  }

  return {
    server: {
      // Default to localhost to avoid exposing the dev server on shared networks.
      host: process.env.VITE_DEV_HOST ?? "127.0.0.1",
      port: 8080,
      strictPort: true,
      hmr: {
        overlay: false,
      },
      watch: {
        ignored: ["**/server/**", "**/dist/**", "**/coverage/**"],
      },
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: "es2020",
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React runtime
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            // Heavy UI libs loaded on demand via lazy routes
            "vendor-charts": ["recharts"],
            "vendor-motion": ["framer-motion"],
            // Radix UI primitives
            "vendor-radix": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-toast",
              "@radix-ui/react-tooltip",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
            ],
            // Data layer
            "vendor-query": ["@tanstack/react-query"],
          },
        },
      },
    },
  };
});
