import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));

const securityHeaders = {
  // Enforce GitHub-only sources, Monaco editor requirements (blob, unsafe-eval), and iframe constraints
  "Content-Security-Policy": [
    "default-src 'self'",
    "connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://data.jsdelivr.com https://cdn.jsdelivr.net",
    "frame-ancestors 'self' https://intlayer.org https://*.intlayer.org",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https://raw.githubusercontent.com https://avatars.githubusercontent.com",
    "worker-src 'self' blob:",
  ].join("; "),
  // Caching for static assets (handled by Vite locally, implement similarly in prod)
  "Cache-Control": "public, max-age=31536000, immutable",
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.join(here, "src"),
      idecn: path.join(here, "src", "components", "IDE.tsx"),
    },
  },
  optimizeDeps: {
    include: ["@monaco-editor/react", "jotai", "shiki", "dockview-react"],
  },
  server: {
    headers: securityHeaders,
  },
  preview: {
    allowedHosts: true,
    headers: securityHeaders,
  },
});
