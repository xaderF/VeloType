import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// Removed velotype-tagger import

// https://vitejs.dev/config/
export default defineConfig(() => ({
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
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
