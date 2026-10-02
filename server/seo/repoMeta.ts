import { DOC_REPO_META } from './repoMeta.generated';

export const SITE_URL = 'https://ide.intlayer.org';
export const SITE_NAME = 'Intlayer online IDE';

export const DEFAULT_DESCRIPTION =
  "Intlayer's online IDE opens any GitHub repository in your browser: browse the file tree and read code with syntax highlighting, no clone or install.";

/** Per-repository metadata extracted from the Intlayer docs at build time. */
export type DocRepoMeta = {
  title: string;
  description: string;
  docTitle: string;
  docDescription?: string;
  docUrl: string;
  updatedAt?: string;
};

export type RepoMeta = {
  repo: string;
  /** Document `<title>`, without the site suffix. */
  title: string;
  description: string;
  /** Short description for the OG card, which has room for two lines. */
  cardDescription: string;
  /** Intlayer doc page that embeds this repository, when there is one. */
  docUrl?: string;
};

const GITHUB_TIMEOUT_MS = 1500;
const GITHUB_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_GITHUB_CACHE_ENTRIES = 500;

type GithubRepo = { description?: string; stars?: number } | null;

/**
 * Failures are cached too: without a token the GitHub API allows 60 requests
 * an hour, and a crawler walking repo pages would exhaust that in seconds.
 */
const githubCache = new Map<
  string,
  { expiresAt: number; value: Promise<GithubRepo> }
>();

const fetchGithubRepo = async (repo: string): Promise<GithubRepo> => {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Intlayer-IDE',
  };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      description?: string | null;
      stargazers_count?: number;
    };
    return {
      description: data.description?.trim() || undefined,
      stars: data.stargazers_count,
    };
  } catch {
    return null;
  }
};

const getGithubRepo = (repo: string): Promise<GithubRepo> => {
  const key = repo.toLowerCase();
  const cached = githubCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (githubCache.size >= MAX_GITHUB_CACHE_ENTRIES) {
    const oldestKey = githubCache.keys().next().value;
    if (oldestKey) githubCache.delete(oldestKey);
  }

  const value = fetchGithubRepo(repo);
  githubCache.set(key, { expiresAt: Date.now() + GITHUB_CACHE_TTL_MS, value });
  return value;
};

const truncate = (text: string, max: number): string => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,.;:—-]+$/, '')}…`;
};

const findDocMeta = (repo: string): DocRepoMeta | undefined => {
  const exact = DOC_REPO_META[repo];
  if (exact) return exact;

  const lower = repo.toLowerCase();
  const key = Object.keys(DOC_REPO_META).find((k) => k.toLowerCase() === lower);
  return key ? DOC_REPO_META[key] : undefined;
};

/**
 * Title and description for a repository page: the Intlayer doc that embeds
 * it when there is one, else the GitHub description, else a generic line.
 */
export const getRepoMeta = async (repo: string): Promise<RepoMeta> => {
  const docMeta = findDocMeta(repo);

  if (docMeta) {
    return {
      repo,
      title: docMeta.title,
      description: docMeta.description,
      cardDescription: truncate(
        docMeta.docDescription ?? `${docMeta.docTitle}.`,
        200
      ),
      docUrl: docMeta.docUrl,
    };
  }

  const github = await getGithubRepo(repo);
  const summary = github?.description;

  return {
    repo,
    title: `${repo}: browse the source code online`,
    description: truncate(
      summary
        ? `${summary.replace(/[.\s]+$/, '')} — Browse ${repo} in your browser with syntax highlighting, no clone or install.`
        : `Browse the ${repo} GitHub repository in your browser: file tree and code with syntax highlighting, no clone or install.`,
      160
    ),
    cardDescription: truncate(
      summary ??
        'Browse the file tree and read code with syntax highlighting, no clone or install.',
      200
    ),
  };
};
