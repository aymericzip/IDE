/**
 * Binds `@monaco-editor/react` to the bundled copy of Monaco instead of its
 * default, which pulls `monaco-editor@0.52.2` off cdn.jsdelivr.net at runtime
 * through an AMD loader.
 *
 * That default is the reason the CSP had to grant `cdn.jsdelivr.net` script
 * execution and allow `'unsafe-eval'` — meaning a third party could run code in
 * an origin whose `localStorage` holds the visitor's GitHub token. Bundling the
 * same version removes both grants and puts the editor behind this origin's own
 * immutable, pre-compressed caching.
 *
 * `loader.config` has to run before anything calls `loader.init()`, so this
 * module is imported for its side effect at the top of `utils.ts`, which owns
 * the only `init` call.
 */

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

/**
 * Monaco asks for a worker by language label. Vite compiles each `?worker`
 * import to its own chunk, so a worker's bytes are only fetched when a file of
 * that language is actually opened — the same lazy shape the AMD loader had.
 */
const WORKER_BY_LABEL: Record<string, () => Worker> = {
  css: () => new cssWorker(),
  handlebars: () => new htmlWorker(),
  html: () => new htmlWorker(),
  javascript: () => new tsWorker(),
  json: () => new jsonWorker(),
  less: () => new cssWorker(),
  razor: () => new htmlWorker(),
  scss: () => new cssWorker(),
  typescript: () => new tsWorker(),
};

/** Monaco reads its configuration off the global rather than from an import. */
type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: monaco.Environment;
};

(globalThis as MonacoGlobal).MonacoEnvironment = {
  getWorker: (_workerId: string, label: string) =>
    (WORKER_BY_LABEL[label] ?? (() => new editorWorker()))(),
};

loader.config({ monaco });
