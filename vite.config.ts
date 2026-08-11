import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Simple, self-contained config. The Express server serves the built output
// in production and mounts Vite in middleware mode during development, so we
// only need the base build settings here.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  // Vite runs in middleware mode inside the Express dev server. On hosts like
  // Replit the page is served from a proxied domain, so allow any host (else
  // Vite answers "Blocked request. This host is not allowed.") and point the
  // HMR websocket at the public HTTPS port.
  server: {
    allowedHosts: true,
    // On Replit the page is served over HTTPS (443); locally keep HMR default.
    hmr: process.env.REPL_ID ? { clientPort: 443 } : undefined,
  },
});
