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

export const RESET_CSS = [
  ".dv-reset{",
  "--dv-activegroup-visiblepanel-tab-background-color:transparent;",
  "--dv-activegroup-visiblepanel-tab-color:inherit;",
  "--dv-activegroup-hiddenpanel-tab-background-color:transparent;",
  "--dv-activegroup-hiddenpanel-tab-color:inherit;",
  "--dv-inactivegroup-visiblepanel-tab-background-color:transparent;",
  "--dv-inactivegroup-visiblepanel-tab-color:inherit;",
  "--dv-inactivegroup-hiddenpanel-tab-background-color:transparent;",
  "--dv-inactivegroup-hiddenpanel-tab-color:inherit;",
  "--dv-tabs-and-actions-container-background-color:transparent;",
  "--dv-tabs-and-actions-container-height:auto;",
  "--dv-group-view-background-color:transparent;",
  "--dv-separator-border:transparent;",
  "--dv-tab-divider-color:transparent;",
  "--dv-drag-over-background-color:color-mix(in oklch,var(--color-accent,var(--accent)) 50%,transparent);",
  "--dv-drag-over-border-color:color-mix(in oklch,var(--color-ring,var(--ring)) 30%,transparent);",
  "--dv-tab-margin:0;",
  "--dv-border-radius:0;",
  "--dv-active-sash-color:transparent;",
  "--dv-sash-color:transparent;",
  "--dv-scrollbar-background-color:transparent;",
  "}",
  ".dv-reset .dv-tab{padding:0;background:transparent}",
  ".dv-reset .dv-tabs-container{gap:0}",
  ".dv-reset .dv-tabs-and-actions-container{font-size:inherit}",
  ".dv-reset .dv-tabs-container>.dv-tab.dv-active-tab{background:var(--color-card,var(--card))!important}",
  ".dv-reset .dv-tabs-container>.dv-tab.dv-active-tab{border-bottom:1px solid var(--color-text)}",
  ".dv-reset .dv-tabs-container>.dv-tab:not(.dv-active-tab){border-bottom:1px solid transparent}",
  ".dv-reset .dv-tabs-container>.dv-tab+.dv-tab{border-left:1px solid color-mix(in oklch,var(--color-border,var(--border)) 50%,transparent)}",
  ".dv-reset .dv-tab:has([data-fill]){flex:1}",
  ".dv-reset .dv-tabs-container{overflow-x:auto;scrollbar-width:thin;scrollbar-color:color-mix(in oklch,var(--color-foreground,var(--foreground)) 15%,transparent) transparent}",
  ".dv-reset .monaco-editor .current-line,.dv-reset .monaco-editor .current-line-margin{border:none!important}",
  ".dv-reset .dv-watermark{background:transparent}",
  String.raw`.dv-reset .dv-tab:has([data-preview]) .group\/tab{font-style:italic}`,
  "@media(prefers-reduced-motion:reduce){.dv-reset *{transition-duration:0s!important;animation-duration:0s!important}}",
  "[data-slot=dialog-overlay]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
].join("");

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
