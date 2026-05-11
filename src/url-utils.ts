const GITHUB = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/i;
const OWNER_REPO = /^[\w.-]+\/[\w.-]+$/;

/** Second path segment looks like a built asset, not a repo name. */
const STATIC_SEGMENT =
  /\.(js|mjs|cjs|css|map|json|ico|svg|png|jpe?g|gif|webp|woff2?|ttf|eot|html?)$/i;

const RESERVED_PATH_ROOTS = new Set(['assets', '_vite']);

export const repoFromInput = (input: string): string | null => {
  const v = input.trim();
  const m = v.match(GITHUB);
  if (m) return `${m[1]}/${m[2]}`;
  if (OWNER_REPO.test(v)) return v;
  return null;
};

export const repoFromPathname = (pathname: string): string | null => {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length < 2) return null;

  let a: string;
  let b: string;
  const p0 = parts[0].toLowerCase();
  if (parts.length === 3 && (p0 === 'github' || p0 === 'github.com')) {
    a = parts[1];
    b = parts[2];
  } else if (parts.length === 2) {
    a = parts[0];
    b = parts[1];
  } else {
    return null;
  }

  if (RESERVED_PATH_ROOTS.has(a)) return null;
  if (STATIC_SEGMENT.test(b)) return null;
  const candidate = `${a}/${b}`;
  return OWNER_REPO.test(candidate) ? candidate : null;
};

export const repoFromSearch = (search: string): string | null => {
  const q = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const direct = (q.get('repo') ?? '').trim();
  if (OWNER_REPO.test(direct)) return direct;
  const url = (q.get('url') ?? '').trim();
  if (!url) return null;
  const m = url.match(GITHUB);
  if (m) return `${m[1]}/${m[2]}`;
  if (OWNER_REPO.test(url)) return url;
  return null;
};

/** Path `/owner/repo` first; otherwise `?repo=` / `?url=` (legacy). */
export const repoFromLocation = (
  pathname: string,
  search: string
): string | null => {
  const repo = repoFromPathname(pathname) ?? repoFromSearch(search);
  if (!repo) return null;
  // const owner = repo.split('/')[0]?.toLowerCase();
  // if (['aymericzip', 'intlayer_org', 'intlayer', 'intlayer-org'].includes(owner)) {
  return repo;
  // }
  // return null;
};

export const filesFromSearch = (search: string): string[] => {
  const q = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const rawFiles = q.get('files') ?? '';
  const rawFileArgs = q.getAll('file');

  const allFiles: string[] = [];
  if (rawFiles) {
    allFiles.push(
      ...rawFiles
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
    );
  }
  for (const rawFile of rawFileArgs) {
    const trimmed = rawFile.trim();
    if (trimmed) {
      allFiles.push(
        ...trimmed
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean)
      );
    }
  }
  return allFiles;
};
