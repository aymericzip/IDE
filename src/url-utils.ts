const GITHUB = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/i;
const OWNER_REPO = /^[\w.-]+\/[\w.-]+$/;

export const repoFromInput = (input: string): string | null => {
  const v = input.trim();
  const m = v.match(GITHUB);
  if (m) return `${m[1]}/${m[2]}`;
  if (OWNER_REPO.test(v)) return v;
  return null;
};

export const repoFromSearch = (search: string): string | null => {
  const q = new URLSearchParams(
    search.startsWith('?') ? search : `?${search}`
  );
  const direct = (q.get('repo') ?? '').trim();
  if (OWNER_REPO.test(direct)) return direct;
  const url = (q.get('url') ?? '').trim();
  if (!url) return null;
  const m = url.match(GITHUB);
  if (m) return `${m[1]}/${m[2]}`;
  if (OWNER_REPO.test(url)) return url;
  return null;
};

export const filesFromSearch = (search: string): string[] => {
  const q = new URLSearchParams(
    search.startsWith('?') ? search : `?${search}`
  );
  const raw = q.get('files') ?? '';
  return raw
    ? raw
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
    : [];
};
