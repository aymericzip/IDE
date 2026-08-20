import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from 'bun';

const DIST_DIR = join(import.meta.dir, 'dist');

/**
 * index.html carries one inline script, the pre-paint theme switch. Hashing the
 * built file lets the CSP allow exactly that script rather than every inline
 * one, and keeps working when the script is edited.
 */
const inlineScriptHashes = (): string => {
  const html = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');
  const matches = html.matchAll(
    /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g
  );

  return [...matches]
    .map(
      (match) =>
        `'sha256-${createHash('sha256').update(match[1], 'utf8').digest('base64')}'`
    )
    .join(' ');
};

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'none'",
  "connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://data.jsdelivr.com https://cdn.jsdelivr.net",
  // The IDE is embedded by intlayer.org, which X-Frame-Options cannot express.
  "frame-ancestors 'self' https://intlayer.org https://*.intlayer.org",
  // Monaco's AMD loader needs eval; its workers are created from blob URLs.
  `script-src 'self' 'unsafe-eval' ${inlineScriptHashes()} https://cdn.jsdelivr.net`,
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "img-src 'self' data: https://raw.githubusercontent.com https://avatars.githubusercontent.com",
  "worker-src 'self' blob:",
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Browsers remember this for the whole max-age, so lower it here before
  // deploying if the origin still needs to answer over plain HTTP.
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
};

const withSecurityHeaders = (response: Response): Response => {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }
  return response;
};

serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = Bun.file(join(DIST_DIR, path));

    const isStatics =
      path.startsWith('/assets/') ||
      path.match(/\.(js|mjs|wasm|css|png|jpg|svg|ico)$/);

    if (isStatics && !existsSync(join(DIST_DIR, path))) {
      return withSecurityHeaders(
        new Response('/* Not Found */', {
          status: 404,
          headers: {
            'Content-Type': path.endsWith('.wasm')
              ? 'application/wasm'
              : 'application/javascript',
          },
        })
      );
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
      // Add strong caching for assets. Font file names are not hashed, so
      // replacing a font means giving the file a new name.
      if (path.startsWith('/assets/') || path.startsWith('/fonts/')) {
        response.headers.set(
          'Cache-Control',
          'public, max-age=31536000, immutable'
        );
      } else if (path.startsWith('/icons/')) {
        // File-type icons keep stable names, so they can only change when the
        // icon theme is upgraded: cache them, but not forever.
        response.headers.set('Cache-Control', 'public, max-age=2592000');
      }
      return withSecurityHeaders(response);
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
    return withSecurityHeaders(indexRes);
  },
});
