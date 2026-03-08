import { defineConfig } from "vite";
import { wasp } from "wasp/client/vite";
import path from "path";

export default defineConfig({
  plugins: [wasp()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    open: false,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
