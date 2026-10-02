/* eslint-disable no-console */
/**
 * Scans documentation for all `https://ide.intlayer.org/...` links
 * and generates `public/sitemap.xml`.
 *
 * Runs via `bun ./scripts/generate-sitemap.mts` or `bun run generate:sitemap`.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = join(root, 'public');
const sitemapPath = join(publicDir, 'sitemap.xml');

// Path to docs directory if cloned side-by-side
const possibleDocsPaths = [
  join(root, '..', 'intlayer_', 'docs'),
  join(root, '..', 'intlayer', 'docs'),
  '/Users/aymericpineau/Documents/intlayer_/docs',
];

const DEFAULT_TEMPLATES = [
  'aymericzip/intlayer-adonis-template?file=intlayer.config.ts',
  'aymericzip/intlayer-adonisjs-template?file=intlayer.config.ts',
  'aymericzip/intlayer-analog-template?file=intlayer.config.ts',
  'aymericzip/intlayer-angular-19-template?file=intlayer.config.ts',
  'aymericzip/intlayer-angular-22-template?file=intlayer.config.ts',
  'aymericzip/intlayer-astro-template?file=intlayer.config.ts',
  'aymericzip/intlayer-elysia-template?file=intlayer.config.ts',
  'aymericzip/intlayer-express-template?file=intlayer.config.ts',
  'aymericzip/intlayer-fastify-template?file=intlayer.config.ts',
  'aymericzip/intlayer-hono-template?file=intlayer.config.ts',
  'aymericzip/intlayer-htmx-template?file=intlayer.config.ts',
  'aymericzip/intlayer-lynx-template?file=intlayer.config.ts',
  'aymericzip/intlayer-next-14-template?file=intlayer.config.ts',
  'aymericzip/intlayer-next-15-template?file=intlayer.config.ts',
  'aymericzip/intlayer-next-16-no-locale-path-template?file=intlayer.config.ts',
  'aymericzip/intlayer-next-16-template?file=intlayer.config.ts',
  'aymericzip/intlayer-nuxt-4-template?file=intlayer.config.ts',
  'aymericzip/intlayer-react-cra-template?file=intlayer.config.ts',
  'aymericzip/intlayer-react-native-template?file=intlayer.config.ts',
  'aymericzip/intlayer-react-router-v7-fs-routes-template?file=intlayer.config.ts',
  'aymericzip/intlayer-react-router-v7-template?file=intlayer.config.ts',
  'aymericzip/intlayer-remix-3-template?file=intlayer.config.ts',
  'aymericzip/intlayer-solid-start-template?file=intlayer.config.ts',
  'aymericzip/intlayer-sveltekit-template?file=intlayer.config.ts',
  'aymericzip/intlayer-tanstack-start-solid-template?file=intlayer.config.ts',
  'aymericzip/intlayer-tanstack-start-template?file=intlayer.config.ts',
  'aymericzip/intlayer-vanilla-template?file=intlayer.config.ts',
  'aymericzip/intlayer-vite-lit-template?file=intlayer.config.ts',
  'aymericzip/intlayer-vite-preact-template?file=intlayer.config.ts',
  'aymericzip/intlayer-vite-react-template?file=intlayer.config.ts',
  'aymericzip/intlayer-vite-solid-template?file=intlayer.config.ts',
  'aymericzip/intlayer-vite-svelte-template?file=intlayer.config.ts',
  'aymericzip/intlayer-vite-vanilla-template?file=intlayer.config.ts',
  'aymericzip/intlayer-vite-vue-template?file=intlayer.config.ts',
  'aymericzip/next-i18next-template?file=src/app/i18n.ts',
  'aymericzip/next-intl-template?file=src/i18n.ts',
];

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (e) => {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') return [];
        return walk(p);
      }
      return [p];
    })
  );
  return files.flat();
};

const main = async () => {
  const urls = new Set<string>();

  const docsDir = possibleDocsPaths.find((p) => existsSync(p));

  if (docsDir) {
    console.log(`🔍 Scanning documentation in ${docsDir}...`);
    const files = await walk(docsDir);
    const regex = /https:\/\/ide\.intlayer\.org\/([^\s"'`<>)]+)/g;

    for (const file of files) {
      if (!/\.(md|mdx|json|tsx|jsx|ts|js|html)$/.test(file)) continue;
      const content = await readFile(file, 'utf8');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const cleaned = match[1].replace(/[.,;:!?]+$/, '');
        urls.add(cleaned);
      }
    }
  }

  // Fallback / merge defaults if docs not found or to ensure coverage
  for (const t of DEFAULT_TEMPLATES) {
    urls.add(t);
  }

  const sortedUrls = [...urls].sort();

  const xmlEntries: string[] = [
    '  <!-- Core -->',
    '  <url>',
    '    <loc>https://ide.intlayer.org/</loc>',
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '',
    '  <!-- Documentation Templates -->',
  ];

  for (const rel of sortedUrls) {
    const cleanPath = rel.split('?')[0];
    const fullLoc = `https://ide.intlayer.org/${rel}`.replace(/&/g, '&amp;');
    const cleanLoc = `https://ide.intlayer.org/${cleanPath}`.replace(/&/g, '&amp;');

    if (cleanLoc !== fullLoc) {
      xmlEntries.push(
        '  <url>',
        `    <loc>${cleanLoc}</loc>`,
        '    <changefreq>monthly</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>'
      );
    }

    xmlEntries.push(
      '  <url>',
      `    <loc>${fullLoc}</loc>`,
      '    <changefreq>monthly</changefreq>',
      '    <priority>0.8</priority>',
      '  </url>',
      ''
    );
  }

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries.join('\n')}
</urlset>
`;

  await writeFile(sitemapPath, sitemapXml, 'utf8');
  console.log(`✅ Generated ${sitemapPath} with ${sortedUrls.length} unique template URLs.`);
};

main();
