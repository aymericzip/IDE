/* eslint-disable no-console */
/**
 * Scans the Intlayer documentation for `https://ide.intlayer.org/...` links and
 * writes two artifacts:
 *
 * - `public/sitemap.xml`: one canonical URL per repository. `?file=` variants
 *   are left out because each page canonicalizes to the bare repository URL.
 * - `server/seo/repoMeta.generated.ts`: title, description and source doc per
 *   repository, read by the server to fill the meta tags and the OG card.
 *
 * The docs live in a sibling checkout that the Docker build does not have, so
 * when they are missing the script keeps the committed artifacts untouched.
 *
 * Runs via `bun run generate:sitemap`. Point `INTLAYER_DOCS_DIR` at the docs
 * package when it is not cloned next to this repository.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://ide.intlayer.org';
const DOCS_SITE_URL = 'https://intlayer.org';

const root = fileURLToPath(new URL('..', import.meta.url));
const sitemapPath = join(root, 'public', 'sitemap.xml');
const repoMetaPath = join(root, 'server', 'seo', 'repoMeta.generated.ts');

const docsDir = [
  process.env.INTLAYER_DOCS_DIR,
  join(root, '..', 'intlayer_', 'docs'),
  join(root, '..', 'intlayer', 'docs'),
].find((path): path is string => Boolean(path && existsSync(path)));

/** English sources only: the other locales link the same repositories. */
const SOURCE_DIRS = ['docs/en', 'blog/en'];

const IDE_URL = /https:\/\/ide\.intlayer\.org\/([\w.-]+\/[\w.-]+)/g;

type Frontmatter = {
  title?: string;
  description?: string;
  updatedAt?: string;
  priority?: number;
  slugs: string[];
  applicationTemplate?: string;
};

type RepoMeta = {
  title: string;
  description: string;
  docTitle: string;
  docDescription?: string;
  docUrl: string;
  updatedAt?: string;
};

type Candidate = { file: string; frontmatter: Frontmatter };

const unquote = (value: string): string =>
  value.trim().replace(/^(['"])([\s\S]*)\1$/, '$2');

/**
 * Reads the handful of frontmatter keys this script needs. The docs use a
 * small, regular subset of YAML, which is not worth a parser dependency.
 */
const parseFrontmatter = (source: string): Frontmatter | null => {
  const block = source.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!block) return null;

  const scalar = (key: string): string | undefined => {
    const line = block.match(new RegExp(`^${key}:[ \\t]*(.+)$`, 'm'))?.[1];
    return line ? unquote(line) : undefined;
  };

  const slugBlock = block.match(/^slugs:\n((?:[ \t]+-.*\n?)+)/m)?.[1] ?? '';
  const slugs = [...slugBlock.matchAll(/-\s*(.+)/g)].map((m) => unquote(m[1]));
  const priority = Number(scalar('priority'));

  return {
    title: scalar('title'),
    description: scalar('description'),
    updatedAt: scalar('updatedAt'),
    priority: Number.isFinite(priority) ? priority : undefined,
    slugs,
    applicationTemplate: scalar('applicationTemplate'),
  };
};

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith('.md') ? [path] : [];
    })
  );
  return nested.flat();
};

/**
 * Several docs can embed the same repository (every Astro flavour links the
 * Astro template). The doc that declares it as `applicationTemplate` wins,
 * then the highest priority, then the shortest — most generic — file name.
 */
const pickCandidate = (repo: string, candidates: Candidate[]): Candidate =>
  [...candidates].sort((a, b) => {
    const declares = (c: Candidate) =>
      c.frontmatter.applicationTemplate?.endsWith(`/${repo}`) ? 0 : 1;
    return (
      declares(a) - declares(b) ||
      (b.frontmatter.priority ?? 0) - (a.frontmatter.priority ?? 0) ||
      a.file.length - b.file.length
    );
  })[0];

/** "Vite + React i18n - Complete guide…" → "Vite + React i18n". */
const shortTitle = (title: string): string =>
  title.split(/\s+[-–—|]\s+|:\s+/)[0].trim();

const truncate = (text: string, max: number): string => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,.;:]+$/, '')}…`;
};

const buildRepoMeta = (repo: string, { frontmatter }: Candidate): RepoMeta => {
  const docTitle = frontmatter.title ?? repo;
  const topic = shortTitle(docTitle);
  const repoName = repo.split('/')[1];

  return {
    title: [
      `${topic} example: ${repoName} source code`,
      `${topic} example: ${repoName}`,
    ].find((candidate) => candidate.length <= 70) ?? truncate(topic, 70),
    description: truncate(
      `${topic} example app, browsable online. ${frontmatter.description ?? ''}`.trim(),
      160
    ),
    docTitle,
    docDescription: frontmatter.description,
    docUrl: `${DOCS_SITE_URL}/${frontmatter.slugs.join('/')}`,
    updatedAt: frontmatter.updatedAt,
  };
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const buildSitemap = (metaByRepo: Record<string, RepoMeta>): string => {
  const latest = Object.values(metaByRepo)
    .map((meta) => meta.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  const entry = (loc: string, lastmod: string | undefined, priority: string) =>
    [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n');

  const entries = [
    entry(`${SITE_URL}/`, latest, '1.0'),
    ...Object.entries(metaByRepo).map(([repo, meta]) =>
      entry(`${SITE_URL}/${repo}`, meta.updatedAt, '0.8')
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
};

const buildRepoMetaModule = (metaByRepo: Record<string, RepoMeta>): string =>
  `// Generated by \`scripts/generate-sitemap.mts\` from the Intlayer docs — do not edit.

import type { DocRepoMeta } from './repoMeta';

export const DOC_REPO_META: Readonly<Record<string, DocRepoMeta>> = ${JSON.stringify(metaByRepo, null, 2)};
`;

const main = async () => {
  if (!docsDir) {
    console.log(
      'ℹ️  Intlayer docs not found, keeping the committed sitemap and repo metadata.'
    );
    return;
  }

  console.log(`🔍 Scanning documentation in ${docsDir}...`);

  const candidatesByRepo = new Map<string, Candidate[]>();

  for (const sourceDir of SOURCE_DIRS) {
    const dir = join(docsDir, sourceDir);
    if (!existsSync(dir)) continue;

    for (const file of await walk(dir)) {
      const source = await readFile(file, 'utf8');
      const repos = new Set([...source.matchAll(IDE_URL)].map((m) => m[1]));
      if (repos.size === 0) continue;

      const frontmatter = parseFrontmatter(source);
      if (!frontmatter) continue;

      for (const repo of repos) {
        const candidates = candidatesByRepo.get(repo) ?? [];
        candidates.push({ file: relative(docsDir, file), frontmatter });
        candidatesByRepo.set(repo, candidates);
      }
    }
  }

  const metaByRepo = Object.fromEntries(
    [...candidatesByRepo.keys()]
      .sort()
      .map((repo) => [
        repo,
        buildRepoMeta(repo, pickCandidate(repo, candidatesByRepo.get(repo)!)),
      ])
  );

  await writeFile(sitemapPath, buildSitemap(metaByRepo), 'utf8');
  await writeFile(repoMetaPath, buildRepoMetaModule(metaByRepo), 'utf8');

  console.log(
    `✅ Wrote ${Object.keys(metaByRepo).length} repositories to the sitemap and repo metadata.`
  );
};

main().catch((error) => {
  console.error('Failed to generate the sitemap:', error);
  process.exit(1);
});
