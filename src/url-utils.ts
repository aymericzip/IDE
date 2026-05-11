const GITHUB = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/i;
const OWNER_REPO = /^[\w.-]+\/[\w.-]+$/;

/** Second path segment looks like a built asset, not a repo name. */
const STATIC_SEGMENT =
  /\.(js|mjs|cjs|css|map|json|ico|svg|png|jpe?g|gif|webp|woff2?|ttf|eot|html?)$/i;

const RESERVED_PATH_ROOTS = new Set(['assets', '_vite']);

export const repoFromInput = (input: string): string | null => {
  const value = input.trim();
  const match = value.match(GITHUB);

  if (match) {
    return `${match[1]}/${match[2]}`;
  }

  if (OWNER_REPO.test(value)) {
    return value;
  }

  return null;
};

export const repoFromPathname = (pathname: string): string | null => {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  const parts = trimmed.split("/").filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  let owner: string;
  let repo: string;
  const firstPart = parts[0].toLowerCase();

  if (parts.length === 3 && (firstPart === "github" || firstPart === "github.com")) {
    owner = parts[1];
    repo = parts[2];
  } else if (parts.length === 2) {
    owner = parts[0];
    repo = parts[1];
  } else {
    return null;
  }

  if (RESERVED_PATH_ROOTS.has(owner)) {
    return null;
  }

  if (STATIC_SEGMENT.test(repo)) {
    return null;
  }

  const candidate = `${owner}/${repo}`;
  return OWNER_REPO.test(candidate) ? candidate : null;
};

export const repoFromSearch = (search: string): string | null => {
  const params = new URLSearchParams(
    search.startsWith("?") ? search : `?${search}`,
  );
  const direct = (params.get("repo") ?? "").trim();

  if (OWNER_REPO.test(direct)) {
    return direct;
  }

  const url = (params.get("url") ?? "").trim();
  if (!url) {
    return null;
  }

  const match = url.match(GITHUB);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }

  if (OWNER_REPO.test(url)) {
    return url;
  }

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
  const params = new URLSearchParams(
    search.startsWith("?") ? search : `?${search}`,
  );
  const rawFiles = params.get("files") ?? "";
  const rawFileArgs = params.getAll("file");

  const allFiles: string[] = [];

  if (rawFiles) {
    allFiles.push(
      ...rawFiles
        .split(",")
        .map((file) => file.trim())
        .filter(Boolean),
    );
  }

  for (const rawFile of rawFileArgs) {
    const trimmed = rawFile.trim();
    if (trimmed) {
      allFiles.push(
        ...trimmed
          .split(",")
          .map((file) => file.trim())
          .filter(Boolean),
      );
    }
  }

  return allFiles;
};
