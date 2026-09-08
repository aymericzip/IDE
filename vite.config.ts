import path from "node:path";
import { fileURLToPath } from "node:url";

import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));

const securityHeaders = {
  // Enforce GitHub-only sources and iframe constraints. Kept in step with the
  // production policy in server.ts, with two deliberate relaxations: the inline
  // script hashes are computed from the built index.html and so cannot be known
  // here, and Vite's dev client needs `'unsafe-inline'` and `'unsafe-eval'`
  // that production does not.
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'none'",
    "connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://data.jsdelivr.com https://cdn.jsdelivr.net",
    "frame-ancestors 'self' https://intlayer.org https://*.intlayer.org https://intlayer.cn https://*.intlayer.cn",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: https://raw.githubusercontent.com https://avatars.githubusercontent.com",
    "worker-src 'self' blob:",
  ].join("; "),
  // Caching for static assets (handled by Vite locally, implement similarly in prod)
  "Cache-Control": "public, max-age=31536000, immutable",
};

export default defineConfig({
  plugins: [preact(), tailwindcss()],
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
