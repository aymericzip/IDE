import path from 'node:path';
import { fileURLToPath } from 'node:url';

import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const here = fileURLToPath(new URL('.', import.meta.url));

const ogDevPlugin = (): Plugin => ({
  name: 'og-image-dev-server',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/og')) {
        return next();
      }

      try {
        const { handleOgRequest } = await import('./server/og/ogHandler');
        const host = req.headers.host ?? 'localhost:5173';
        const protocol = req.headers['x-forwarded-proto'] ?? 'http';
        const requestUrl = new URL(req.url, `${protocol}://${host}`);

        const webReq = new Request(requestUrl.toString(), {
          method: req.method,
          headers: req.headers as Record<string, string>,
        });

        const webRes = await handleOgRequest(webReq);

        res.statusCode = webRes.status;
        webRes.headers.forEach((val, key) => {
          res.setHeader(key, val);
        });

        if (req.method === 'HEAD' || !webRes.body) {
          res.end();
          return;
        }

        const buf = await webRes.arrayBuffer();
        res.end(Buffer.from(buf));
      } catch (e) {
        console.error('Error handling /api/og in dev:', e);
        next();
      }
    });
  },
});

const securityHeaders = {
  // Enforce GitHub-only sources and iframe constraints. Kept in step with the
  // production policy in server.ts, with two deliberate relaxations: the inline
  // script hashes are computed from the built index.html and so cannot be known
  // here, and Vite's dev client needs `'unsafe-inline'` and `'unsafe-eval'`
  // that production does not.
  'Content-Security-Policy': [
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
  ].join('; '),
};

export default defineConfig(({ command }) => ({
  plugins: [
    preact(),
    tailwindcss(),
    ogDevPlugin(),
    ...(command === 'build'
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            manifest: false, // Uses public/manifest.json
            workbox: {
              globPatterns: ['**/*.{js,css,html,woff2,ico,png}'],
              // Social cards and store screenshots are never shown in the app.
              globIgnores: [
                '**/icons/**',
                '**/*worker*',
                'og-image.png',
                'cover.png',
                'screenshot.png',
                'github-social-preview.png',
              ],
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
              runtimeCaching: [
                {
                  // Cache on-demand file/folder icon SVGs
                  urlPattern: ({ url }) => url.pathname.startsWith('/icons/'),
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'ide-icons-cache',
                    expiration: {
                      maxEntries: 600,
                      maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                    },
                  },
                },
                {
                  // Cache Monaco language workers on demand
                  urlPattern: ({ url }) => url.pathname.includes('.worker'),
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'monaco-workers-cache',
                    expiration: {
                      maxEntries: 10,
                      maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                    },
                  },
                },
                {
                  // jsdelivr repo trees and file contents
                  urlPattern: /^https:\/\/(cdn|data)\.jsdelivr\.net\/.*/i,
                  handler: 'StaleWhileRevalidate',
                  options: {
                    cacheName: 'jsdelivr-cdn-cache',
                    expiration: {
                      maxEntries: 500,
                      maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                    },
                    cacheableResponse: {
                      statuses: [0, 200],
                    },
                  },
                },
                {
                  // Raw GitHub contents and user avatars
                  urlPattern:
                    /^https:\/\/(raw|avatars)\.githubusercontent\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'github-content-cache',
                    expiration: {
                      maxEntries: 250,
                      maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                    },
                    cacheableResponse: {
                      statuses: [0, 200],
                    },
                  },
                },
              ],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.join(here, 'src'),
      idecn: path.join(here, 'src', 'components', 'IDE.tsx'),
    },
  },
  optimizeDeps: {
    include: ['@monaco-editor/react', 'jotai', 'shiki', 'dockview-react'],
  },
  build: {
    target: 'es2022',
    modulePreload: { polyfill: false },
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Keep dynamic language grammars as separate chunks loaded on demand
            if (id.includes('@shikijs/langs') || id.includes('/langs/')) {
              return;
            }
            if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
              return 'vendor-monaco';
            }
            if (id.includes('shiki') || id.includes('@shikijs')) {
              return 'vendor-shiki';
            }
            if (
              id.includes('dockview') ||
              id.includes('@base-ui') ||
              id.includes('cmdk') ||
              id.includes('lucide-react') ||
              id.includes('react-resizable-panels') ||
              id.includes('sonner')
            ) {
              return 'vendor-ui';
            }
            if (
              id.includes('preact') ||
              id.includes('jotai') ||
              id.includes('@tanstack/react-hotkeys')
            ) {
              return 'vendor-core';
            }
          }
        },
      },
    },
  },
  server: {
    headers: {
      ...securityHeaders,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Clear-Site-Data': '"cache"',
    },
  },
  preview: {
    allowedHosts: true,
    headers: securityHeaders,
  },
}));
