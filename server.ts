import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from 'bun';

const DIST_DIR = join(import.meta.dir, 'dist');

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = Bun.file(join(DIST_DIR, path));

    const isStatics =
      path.startsWith('/assets/') ||
      path.match(/\.(js|mjs|wasm|css|png|jpg|svg|ico)$/);

    if (isStatics && !existsSync(join(DIST_DIR, path))) {
      return new Response('/* Not Found */', {
        status: 404,
        headers: {
          'Content-Type': path.endsWith('.wasm')
            ? 'application/wasm'
            : 'application/javascript',
        },
      });
    }

    if (await file.exists()) {
      const response = new Response(file);
      if (path.endsWith('.js') || path.endsWith('.mjs')) {
        response.headers.set(
          'Content-Type',
          'application/javascript; charset=utf-8'
        );
      } else if (path.endsWith('.wasm')) {
        response.headers.set('Content-Type', 'application/wasm');
      } else if (path.endsWith('.css')) {
        response.headers.set('Content-Type', 'text/css; charset=utf-8');
      }
      // Add strong caching for assets
      if (path.startsWith('/assets/')) {
        response.headers.set(
          'Cache-Control',
          'public, max-age=31536000, immutable'
        );
      }
      return response;
    }

    // SPA Fallback for routes like /github/user/repo
    const index = Bun.file(join(DIST_DIR, 'index.html'));
    const indexRes = new Response(index, {
      headers: { 'Content-Type': 'text/html' },
    });
    indexRes.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate'
    );
    return indexRes;
  },
});
