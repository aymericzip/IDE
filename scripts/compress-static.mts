/* eslint-disable no-console */
/**
 * Writes Brotli and gzip siblings next to every compressible file in `dist`,
 * so `server.ts` can serve pre-compressed bytes with zero per-request CPU cost.
 *
 * Vite has no built-in step for this and `Bun.serve` never compresses on its
 * own, so without this pass every visitor downloads the raw bundle — 11.6 MB of
 * JS and CSS where Brotli ships about 1.8 MB.
 *
 * Compressing at build time rather than per request is what makes the top
 * Brotli quality affordable: the output is content-hashed and served with
 * `immutable`, so one compression lasts until the file's contents change.
 *
 * Runs from `bun run build`, after `vite build` has written `dist`.
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);

/** Build output root — the directory `server.ts` serves from. */
const DIST_DIRECTORY = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');

/**
 * Files below this size cost more in request overhead than they save in bytes.
 * The same 1 KiB floor Nitro applies in `compressPublicAssets`.
 */
const MINIMUM_COMPRESSIBLE_BYTES = 1024;

/** Reads a positive integer environment override, or falls back. */
const readIntEnv = (name: string, fallback: number): number => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Brotli quality for the bulk of the output — chiefly the ~1100 icon SVGs.
 *
 * Brotli's step from 9 to 10 turns on a much more expensive context-modelling
 * pass for roughly a point of extra ratio. Quality 9 still beats gzip by ~35 %,
 * which is the right trade for many small files. `BROTLI_QUALITY` overrides it.
 */
const BROTLI_QUALITY = Math.min(11, readIntEnv('BROTLI_QUALITY', 9));

/**
 * Brotli quality for the content-hashed, year-immutable assets (`.js`, `.css`).
 * Every visitor downloads them and a hashed filename means one compression
 * lasts until the contents change, so the top quality earns its one-time cost
 * here. `BROTLI_QUALITY_ASSETS` overrides it.
 */
const BROTLI_QUALITY_ASSETS = Math.min(
  11,
  readIntEnv('BROTLI_QUALITY_ASSETS', 11)
);

/** Extensions billed at {@link BROTLI_QUALITY_ASSETS} rather than the default. */
const IMMUTABLE_ASSET_EXTENSIONS = new Set(['.css', '.js', '.mjs']);

/**
 * Brotli above this size drops to {@link BROTLI_QUALITY_LARGE}. The handful of
 * multi-megabyte Shiki grammar chunks would otherwise dominate the run for a
 * few percent of extra savings.
 */
const HIGH_QUALITY_BROTLI_LIMIT_BYTES = 2 * 1024 * 1024;

/** Brotli quality for files past {@link HIGH_QUALITY_BROTLI_LIMIT_BYTES}. */
const BROTLI_QUALITY_LARGE = readIntEnv('BROTLI_QUALITY_LARGE', 9);

/**
 * Picks the Brotli quality for one file: immutable assets get the top level,
 * oversized files the cheap level, everything else the default.
 */
const brotliQualityForFile = (
  absolutePath: string,
  sizeBytes: number
): number => {
  if (sizeBytes > HIGH_QUALITY_BROTLI_LIMIT_BYTES) return BROTLI_QUALITY_LARGE;

  return IMMUTABLE_ASSET_EXTENSIONS.has(extname(absolutePath).toLowerCase())
    ? BROTLI_QUALITY_ASSETS
    : BROTLI_QUALITY;
};

/**
 * gzip level for the fallback sibling. Level 6 is zlib's own default and lands
 * within ~1 % of level 9 on this content at roughly half the CPU; the Brotli
 * sibling is what modern clients actually receive.
 */
const GZIP_LEVEL = Math.min(9, readIntEnv('GZIP_LEVEL', 6));

/**
 * How many files are compressed at once. Bun runs async Brotli off-thread, so a
 * few lanes already keep several cores busy, and the cap protects a CI
 * container whose real CPU quota is below the host core count.
 * `COMPRESS_CONCURRENCY` overrides it.
 */
const COMPRESSION_CONCURRENCY = Math.max(
  1,
  readIntEnv('COMPRESS_CONCURRENCY', Math.min(4, availableParallelism()))
);

/** Extensions worth compressing — everything else is already compact. */
const COMPRESSIBLE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.svg',
  '.txt',
  '.wasm',
  '.webmanifest',
  '.xml',
]);

/** Suffixes this script produces, skipped when re-scanning the tree. */
const GENERATED_SUFFIXES = ['.br', '.gz'] as const;

type CompressionTotals = {
  fileCount: number;
  originalBytes: number;
  brotliBytes: number;
  gzipBytes: number;
};

/** Recursively lists every file under a directory, returning absolute paths. */
const listFilesRecursively = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) return listFilesRecursively(absolutePath);
      if (entry.isFile()) return [absolutePath];
      return [];
    })
  );

  return nested.flat();
};

/**
 * Decides whether a file should get compressed siblings, based on its
 * extension and the suffixes this script itself emits.
 */
const isCompressibleFile = (absolutePath: string): boolean => {
  if (GENERATED_SUFFIXES.some((suffix) => absolutePath.endsWith(suffix))) {
    return false;
  }
  if (absolutePath.endsWith('.map')) return false;

  return COMPRESSIBLE_EXTENSIONS.has(extname(absolutePath).toLowerCase());
};

/**
 * True when both variants already exist and are at least as new as the source,
 * so an incremental rebuild only pays for the files Vite actually rewrote.
 */
const isAlreadyCompressed = async (
  absolutePath: string,
  sourceModifiedTimeMs: number
): Promise<boolean> => {
  try {
    const variantStats = await Promise.all(
      GENERATED_SUFFIXES.map((suffix) => stat(`${absolutePath}${suffix}`))
    );

    return variantStats.every(
      (variant) => variant.mtimeMs >= sourceModifiedTimeMs
    );
  } catch {
    return false;
  }
};

/**
 * Writes `.br` and `.gz` siblings for a single file and reports the byte
 * counts, or `null` when the file was too small or is already covered.
 */
const compressFile = async (
  absolutePath: string
): Promise<Omit<CompressionTotals, 'fileCount'> | null> => {
  try {
    const fileStats = await stat(absolutePath);
    if (fileStats.size < MINIMUM_COMPRESSIBLE_BYTES) return null;
    if (await isAlreadyCompressed(absolutePath, fileStats.mtimeMs)) return null;

    const contents = await readFile(absolutePath);

    const brotliQuality = brotliQualityForFile(absolutePath, contents.length);

    const [brotliContents, gzipContents] = await Promise.all([
      compressBrotli(contents, {
        params: {
          [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
          [constants.BROTLI_PARAM_QUALITY]: brotliQuality,
          [constants.BROTLI_PARAM_SIZE_HINT]: contents.length,
        },
      }),
      compressGzip(contents, { level: GZIP_LEVEL }),
    ]);

    // A variant that came out larger than the source would only waste bytes on
    // the wire; leaving it unwritten makes the server fall back to identity.
    await Promise.all([
      brotliContents.length < contents.length
        ? writeFile(`${absolutePath}.br`, brotliContents)
        : Promise.resolve(),
      gzipContents.length < contents.length
        ? writeFile(`${absolutePath}.gz`, gzipContents)
        : Promise.resolve(),
    ]);

    return {
      originalBytes: contents.length,
      brotliBytes: Math.min(brotliContents.length, contents.length),
      gzipBytes: Math.min(gzipContents.length, contents.length),
    };
  } catch {
    return null;
  }
};

/**
 * Runs `worker` over `items` with a bounded number of concurrent tasks, so a
 * 1400-file output does not open 1400 file handles or 1400 Brotli buffers.
 */
const mapWithConcurrency = async <TItem, TResult>(
  items: readonly TItem[],
  concurrency: number,
  worker: (item: TItem) => Promise<TResult>
): Promise<TResult[]> => {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const runLane = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runLane)
  );

  return results;
};

/** Formats a byte count as mebibytes with one decimal place. */
const formatMebibytes = (bytes: number): string =>
  `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Compresses every eligible file under `directory`, logging a one-line summary.
 *
 * A missing directory is reported rather than thrown: it means `vite build`
 * already failed, and failing again here would only obscure the real error.
 *
 * @param directory - Absolute path to walk.
 * @param label - Name shown in the log line, e.g. `dist`.
 */
export const compressDirectory = async (
  directory: string,
  label: string
): Promise<void> => {
  console.log(`🗜️  Pre-compressing ${label}...`);

  const startedAt = Date.now();

  let allFiles: string[];
  try {
    allFiles = await listFilesRecursively(directory);
  } catch {
    console.error(
      `   ✗ ${relative(process.cwd(), directory)} not found — nothing compressed.`
    );
    return;
  }

  const compressibleFiles = allFiles.filter(isCompressibleFile);

  const outcomes = await mapWithConcurrency(
    compressibleFiles,
    COMPRESSION_CONCURRENCY,
    compressFile
  );

  const totals = outcomes.reduce<CompressionTotals>(
    (accumulator, outcome) =>
      outcome === null
        ? accumulator
        : {
            fileCount: accumulator.fileCount + 1,
            originalBytes: accumulator.originalBytes + outcome.originalBytes,
            brotliBytes: accumulator.brotliBytes + outcome.brotliBytes,
            gzipBytes: accumulator.gzipBytes + outcome.gzipBytes,
          },
    { fileCount: 0, originalBytes: 0, brotliBytes: 0, gzipBytes: 0 }
  );

  const brotliRatio = totals.originalBytes
    ? (100 * totals.brotliBytes) / totals.originalBytes
    : 0;
  const gzipRatio = totals.originalBytes
    ? (100 * totals.gzipBytes) / totals.originalBytes
    : 0;

  console.log(
    `   ✓ ${totals.fileCount} files in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`
  );
  console.log(`     raw    ${formatMebibytes(totals.originalBytes)}`);
  console.log(
    `     brotli ${formatMebibytes(totals.brotliBytes)} (${brotliRatio.toFixed(1)}% of raw)`
  );
  console.log(
    `     gzip   ${formatMebibytes(totals.gzipBytes)} (${gzipRatio.toFixed(1)}% of raw)`
  );
};

if (import.meta.main) {
  if (process.env.DISABLE_OPTIMIZATION !== 'true') {
    await compressDirectory(DIST_DIRECTORY, 'dist');
  }
}
