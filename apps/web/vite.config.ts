import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: "../..",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("recharts") ||
              id.includes("d3-") ||
              id.includes("victory-vendor")
            ) {
              return "vendor-charts";
            }
            if (
              id.includes("@tanstack/react-router") ||
              id.includes("@tanstack/react-query") ||
              id.includes("@tanstack/store")
            ) {
              return "vendor-router";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (
              id.includes("react") ||
              id.includes("react-dom") ||
              id.includes("scheduler")
            ) {
              return "vendor-react";
            }
          }
        },
      },
    },
  },
});
