import { type RepoMeta, SITE_NAME, SITE_URL } from './repoMeta';

const SEO_BLOCK = /<!-- seo:start[\s\S]*?<!-- seo:end -->/;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** JSON inside `<script>`: only `<` can end the element early. */
const toScriptJson = (value: unknown): string =>
  JSON.stringify(value, null, 2).replace(/</g, '\\u003c');

const buildSeoHead = (meta: RepoMeta): string => {
  const pageUrl = `${SITE_URL}/${meta.repo}`;
  const imageUrl = `${SITE_URL}/api/og?repo=${encodeURIComponent(meta.repo)}`;
  const title = `${meta.title} | Intlayer IDE`;
  const imageAlt = `${meta.repo} — ${SITE_NAME}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': pageUrl,
        url: pageUrl,
        name: title,
        description: meta.description,
        image: imageUrl,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/` },
        about: {
          '@type': 'SoftwareSourceCode',
          name: meta.repo,
          codeRepository: `https://github.com/${meta.repo}`,
          ...(meta.docUrl ? { subjectOf: meta.docUrl } : {}),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: SITE_NAME,
            item: `${SITE_URL}/`,
          },
          { '@type': 'ListItem', position: 2, name: meta.repo, item: pageUrl },
        ],
      },
    ],
  };

  const t = escapeHtml(title);
  const d = escapeHtml(meta.description);
  const alt = escapeHtml(imageAlt);
  const url = escapeHtml(pageUrl);
  const image = escapeHtml(imageUrl);

  return `<title>${t}</title>
    <meta name="description" content="${d}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${alt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@Intlayer183096" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:image:alt" content="${alt}" />
    <script type="application/ld+json">${toScriptJson(structuredData)}</script>`;
};

/** Swaps the generic SEO block of `index.html` for one describing `meta`. */
export const renderRepoHtml = (indexHtml: string, meta: RepoMeta): string =>
  indexHtml.replace(SEO_BLOCK, () => buildSeoHead(meta));
