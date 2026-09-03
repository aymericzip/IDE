import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
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
  // The IDE is embedded by intlayer.org and intlayer.cn, which X-Frame-Options
  // cannot express.
  "frame-ancestors 'self' https://intlayer.org https://*.intlayer.org https://intlayer.cn https://*.intlayer.cn",
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
  // The IDE is framed by intlayer.org, so the document itself must stay
  // embeddable; this only stops other origins reading it as a subresource.
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Permissions-Policy':
    'accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Browsers remember this for the whole max-age, so lower it here before
  // deploying if the origin still needs to answer over plain HTTP.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  // Disables the legacy XSS auditor, whose heuristics only ever introduced
  // vulnerabilities of their own; the CSP above is the real defence.
  'X-XSS-Protection': '0',
};

const withSecurityHeaders = (response: Response): Response => {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }
  return response;
};

/** Request methods that may be answered from a file on disk. */
const READABLE_METHODS = new Set(['GET', 'HEAD']);

/**
 * Content encodings this server can serve, ordered best-compression first.
 * Each maps to the filename suffix written by `scripts/compress-static.mts`.
 */
const CONTENT_ENCODINGS = [
  { token: 'br', suffix: '.br' },
  { token: 'gzip', suffix: '.gz' },
] as const;

type ContentEncoding = (typeof CONTENT_ENCODINGS)[number];

/**
 * Media types keyed by file extension. Serving a pre-compressed sibling means
 * the response body is `<name>.br`, whose extension says nothing about the
 * payload — so the type has to come from the original path rather than from
 * `Bun.file`'s own inference.
 */
const MEDIA_TYPES: Readonly<Record<string, string>> = {
  css: 'text/css; charset=utf-8',
  html: 'text/html; charset=utf-8',
  ico: 'image/x-icon',
  jpg: 'image/jpeg',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  wasm: 'application/wasm',
  webmanifest: 'application/manifest+json',
  woff2: 'font/woff2',
  xml: 'application/xml; charset=utf-8',
};

const getMediaType = (path: string): string =>
  MEDIA_TYPES[path.split('.').pop()?.toLowerCase() ?? ''] ??
  'application/octet-stream';

/**
 * Resolves a request path against `dist`, rejecting anything that escapes it.
 *
 * `new URL()` already collapses `..` segments, so no traversal payload reaches
 * this today — but that is a property of the parser, not of this code. One
 * `decodeURIComponent` is exactly what re-opens the hole, so the decode and the
 * containment check live together here.
 */
const resolveWithinDist = (pathname: string): string | null => {
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decodedPath.includes('\0')) return null;

  const absolutePath = resolve(DIST_DIR, `.${decodedPath}`);

  return absolutePath === DIST_DIR ||
    absolutePath.startsWith(`${DIST_DIR}${sep}`)
    ? absolutePath
    : null;
};

/**
 * Picks the best pre-compressed variant the client accepts and that exists on
 * disk, or `null` when the identity encoding should be served.
 */
const negotiateContentEncoding = (
  absolutePath: string,
  acceptEncodingHeader: string | null
): { encoding: ContentEncoding; size: number } | null => {
  if (!acceptEncodingHeader) return null;

  const acceptedTokens = new Set(
    acceptEncodingHeader
      .split(',')
      .map((part) => part.split(';')[0].trim().toLowerCase())
  );

  for (const encoding of CONTENT_ENCODINGS) {
    if (!acceptedTokens.has(encoding.token)) continue;

    try {
      const stats = statSync(`${absolutePath}${encoding.suffix}`);
      if (stats.isFile()) return { encoding, size: stats.size };
    } catch {
      // Variant not generated for this file — try the next encoding.
    }
  }

  return null;
};

/**
 * Cache-Control for a path, by how its name is allocated.
 *
 * Anything not matched here keeps a short lifetime and revalidates against the
 * ETag: names like `/favicon.ico` and `/manifest.json` are stable but their
 * contents are not, so they must never be pinned for a year.
 */
const cacheControlFor = (path: string): string => {
  // Vite content-hashes everything under /assets/. Font file names are not
  // hashed, so replacing a font means giving the file a new name.
  if (path.startsWith('/assets/') || path.startsWith('/fonts/')) {
    return 'public, max-age=31536000, immutable';
  }
  // File-type icons keep stable names, so they can only change when the icon
  // theme is upgraded: cache them, but not forever.
  if (path.startsWith('/icons/')) return 'public, max-age=2592000';

  return 'public, max-age=300, must-revalidate';
};

/**
 * Validator covering size, mtime and encoding — enough for a build whose files
 * are written wholesale. The encoding is part of it because the same URL has a
 * different body under `br` than under `gzip`.
 */
const buildEntityTag = (
  size: number,
  modifiedTimeMs: number,
  encodingToken: string
): string =>
  `"${size.toString(16)}-${Math.floor(modifiedTimeMs).toString(16)}-${encodingToken}"`;

/**
 * Builds the response for a file that exists on disk, negotiating encoding and
 * answering 304 when the client's validator still matches.
 */
const serveFile = (
  req: Request,
  absolutePath: string,
  publicPath: string,
  modifiedTimeMs: number,
  size: number,
  cacheControl: string
): Response => {
  const negotiated = negotiateContentEncoding(
    absolutePath,
    req.headers.get('accept-encoding')
  );

  const entityTag = buildEntityTag(
    negotiated?.size ?? size,
    modifiedTimeMs,
    negotiated?.encoding.token ?? 'identity'
  );

  const headers = new Headers({
    'Cache-Control': cacheControl,
    'Content-Type': getMediaType(publicPath),
    ETag: entityTag,
    Vary: 'Accept-Encoding',
  });

  if (negotiated) headers.set('Content-Encoding', negotiated.encoding.token);

  if (req.headers.get('if-none-match') === entityTag) {
    return withSecurityHeaders(new Response(null, { status: 304, headers }));
  }

  if (req.method === 'HEAD') {
    headers.set('Content-Length', String(negotiated?.size ?? size));
    return withSecurityHeaders(new Response(null, { headers }));
  }

  const body = Bun.file(
    negotiated ? `${absolutePath}${negotiated.encoding.suffix}` : absolutePath
  );

  return withSecurityHeaders(new Response(body, { headers }));
};

const INDEX_PATH = join(DIST_DIR, 'index.html');

serve({
  port: Number(process.env.PORT ?? 3000),
  fetch(req) {
    if (!READABLE_METHODS.has(req.method)) {
      return withSecurityHeaders(
        new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD' },
        })
      );
    }

    const url = new URL(req.url);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const absolutePath = resolveWithinDist(path);

    const isStatics =
      path.startsWith('/assets/') ||
      /\.(js|mjs|wasm|css|png|jpg|svg|ico)$/.test(path);

    let stats: ReturnType<typeof statSync> | null = null;
    if (absolutePath) {
      try {
        const candidate = statSync(absolutePath);
        if (candidate.isFile()) stats = candidate;
      } catch {
        // Absent, or not readable — handled by the branches below.
      }
    }

    if (stats) {
      return serveFile(
        req,
        absolutePath as string,
        path,
        stats.mtimeMs,
        stats.size,
        cacheControlFor(path)
      );
    }

    // A missing asset must not fall through to the SPA shell: the browser would
    // parse an HTML document as the script or stylesheet it asked for.
    if (isStatics) {
      return withSecurityHeaders(
        new Response('/* Not Found */', {
          status: 404,
          headers: { 'Content-Type': getMediaType(path) },
        })
      );
    }

    // SPA Fallback for routes like /github/user/repo
    const indexStats = statSync(INDEX_PATH);

    return serveFile(
      req,
      INDEX_PATH,
      '/index.html',
      indexStats.mtimeMs,
      indexStats.size,
      'no-cache'
    );
  },
});
