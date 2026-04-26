import { DEFAULT_REPO } from './constants';

const GITHUB = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/i;

export const repoFromSearch = (search: string): string => {
  const q = new URLSearchParams(
    search.startsWith('?') ? search : `?${search}`
  );
  const direct = (q.get('repo') ?? '').trim();
  if (/^[\w.-]+\/[\w.-]+$/.test(direct)) return direct;
  const url = (q.get('url') ?? '').trim();
  if (!url) return DEFAULT_REPO;
  const m = url.match(GITHUB);
  if (m) return `${m[1]}/${m[2]}`;
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) return url;
  return DEFAULT_REPO;
};
