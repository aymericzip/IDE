import type { EditorProps } from "@monaco-editor/react";

export const ICON_CLASS =
  "size-4 shrink-0 [&_svg]:size-4 transition-all duration-300";
export const ICON_CLASS_HOVER = `${ICON_CLASS} group-hover:scale-125`;
export const ICON_CLASS_TAB_HOVER = `${ICON_CLASS} group-hover/tab:scale-125`;
export const ITEM_CLASS =
  "group flex w-full items-center gap-[7px] py-[1px] pr-2 text-left text-xs leading-5 cursor-pointer whitespace-nowrap hover:bg-accent";
export const CENTER = "flex h-full items-center justify-center";

export const EDITOR_OPTIONS: NonNullable<EditorProps["options"]> = {
  bracketPairColorization: { enabled: true },
  cursorSmoothCaretAnimation: "on",
  cursorWidth: 5,
  fontLigatures: true,
  fontSize: 12,
  letterSpacing: -0.8,
  lineHeight: 1.5,
  minimap: {
    maxColumn: 69,
    renderCharacters: false,
    scale: 2,
    showSlider: "always",
  },
  readOnly: true,
  scrollBeyondLastLine: false,
  scrollbar: {
    horizontal: "hidden",
    horizontalScrollbarSize: 1,
    verticalScrollbarSize: 0,
  },
  smoothScrolling: true,
  stickyScroll: { enabled: true },
};

export const TAB_TYPE = Symbol("idecn-tab");

export const EXT_TO_LANG: Record<string, string> = {
  astro: "astro",
  cjs: "javascript",
  css: "css",
  go: "go",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "javascriptreact",
  less: "less",
  md: "markdown",
  mjs: "javascript",
  py: "python",
  rs: "rust",
  sass: "sass",
  scss: "scss",
  sh: "shellscript",
  sql: "sql",
  styl: "stylus",
  svelte: "svelte",
  toml: "toml",
  ts: "typescript",
  tsx: "typescriptreact",
  vue: "vue",
  yaml: "yaml",
  yml: "yaml",
};

export const LANG: Record<string, string> = {
  astro: "astro",
  css: "css",
  go: "go",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  less: "less",
  md: "markdown",
  mjs: "javascript",
  py: "python",
  rs: "rust",
  sass: "sass",
  scss: "scss",
  sh: "shell",
  sql: "sql",
  styl: "stylus",
  toml: "toml",
  ts: "typescript",
  tsx: "typescript",
  yaml: "yaml",
  yml: "yaml",
};

export const IMAGE_EXTS = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

export const BINARY_EXTS = new Set([
  "7z",
  "bin",
  "bz2",
  "dat",
  "db",
  "dll",
  "dylib",
  "eot",
  "exe",
  "gz",
  "otf",
  "pdf",
  "rar",
  "so",
  "sqlite",
  "tar",
  "ttf",
  "wasm",
  "woff",
  "woff2",
  "xz",
  "zip",
]);

export const FILE_SIZE_WARN = 500_000;
export const VIRTUAL_PREFIX = "__virtual:";


export const CORE_LANGS = [
  "javascript",
  "json",
  "markdown",
  "tsx",
  "typescript",
] as const;
export const ALL_LANGS = [
  "astro",
  "css",
  "go",
  "html",
  "javascript",
  "json",
  "jsx",
  "less",
  "markdown",
  "python",
  "rust",
  "sass",
  "scss",
  "shell",
  "sql",
  "stylus",
  "toml",
  "tsx",
  "typescript",
  "yaml",
] as const;
