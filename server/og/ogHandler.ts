import { getRepoMeta } from '../seo/repoMeta';
import { generateOgImage } from './generateOgImage';
import { THUMBNAIL_JPEG_BASE64 } from './ogAssets';

const MAX_TITLE_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_LOCALE_LENGTH = 35;
const MAX_CACHE_ENTRIES = 100;

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

const ogImageCache = new Map<string, Promise<ArrayBuffer>>();
let fallbackBuffer: ArrayBuffer | null = null;

const getFallbackBuffer = (): ArrayBuffer => {
  if (!fallbackBuffer) {
    const buffer = Buffer.from(THUMBNAIL_JPEG_BASE64, 'base64');
    fallbackBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
  }
  return fallbackBuffer;
};

const OWNER_REPO = /^[\w.-]+\/[\w.-]+$/;

export const handleOgRequest = async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const withBody = request.method !== 'HEAD';
  const url = new URL(request.url);

  const rawRepo = url.searchParams.get('repo')?.trim();
  const rawTitle = url.searchParams.get('title')?.trim();
  const rawDescription = url.searchParams.get('description')?.trim();
  const rawLocale = url.searchParams.get('locale')?.trim();

  let title = rawTitle ? rawTitle.slice(0, MAX_TITLE_LENGTH) : undefined;
  let description = rawDescription
    ? rawDescription.slice(0, MAX_DESCRIPTION_LENGTH)
    : undefined;
  const locale = rawLocale ? rawLocale.slice(0, MAX_LOCALE_LENGTH) : undefined;

  // Only an `owner/name` pair reaches the GitHub API: the value is part of
  // the request path there.
  let eyebrow: string | undefined;
  const repo = rawRepo?.replace(/^(https?:\/\/)?github\.com\//i, '');
  if (repo && OWNER_REPO.test(repo)) {
    const meta = await getRepoMeta(repo);
    [eyebrow, title] = repo.split('/');
    description ??= meta.cardDescription;
  }

  const cacheKey = [eyebrow, title, description, locale]
    .map((v) => v ?? '')
    .join('::');
  let bufferPromise = ogImageCache.get(cacheKey);

  if (!bufferPromise) {
    bufferPromise = generateOgImage({
      eyebrow,
      title,
      description,
      locale,
    }).catch((err) => {
      ogImageCache.delete(cacheKey);
      throw err;
    });

    if (ogImageCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = ogImageCache.keys().next().value;
      if (oldestKey) ogImageCache.delete(oldestKey);
    }
    ogImageCache.set(cacheKey, bufferPromise);
  }

  try {
    const buffer = await bufferPromise;
    return new Response(withBody ? buffer : null, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': title
          ? 'public, max-age=86400, stale-while-revalidate=604800'
          : 'public, max-age=31536000, immutable',
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    console.error(
      '[API /api/og] Error rendering image, using fallback:',
      error
    );
    const buffer = getFallbackBuffer();
    return new Response(withBody ? buffer : null, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600',
        ...CORS_HEADERS,
      },
    });
  }
};
