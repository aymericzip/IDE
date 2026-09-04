import type { Monaco } from "@monaco-editor/loader";
import { loader } from "@monaco-editor/react";
// Side-effect import: points the loader at the bundled Monaco. Must be
// evaluated before `initMonaco` runs, which is why it sits with the imports.
import "./monaco-env";
import { shikiToMonaco, textmateThemeToMonacoTheme } from "@shikijs/monaco";
import {
  Children,
  isValidElement,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { createHighlighter } from "shiki";
import {
  CORE_LANGS,
  EXT_TO_LANG,
  LANG,
  TAB_TYPE,
  VIRTUAL_PREFIX,
} from "./constants";
import type { IconManifest, TabProps, TreeDataItem } from "./types";

let iconManifest: IconManifest | null = null;
let cachedMonoFont: string | undefined;

export const iconsReady =
  "location" in globalThis
    ? import("../_generated/icon-manifest").then(
        (mod: { iconManifest: IconManifest }) => {
          iconManifest = mod.iconManifest;
        },
      )
    : Promise.resolve();

export const getIconManifest = () => iconManifest;

const iconSvgCache = new Map<string, string>();
const pendingIconSvgs = new Map<string, Promise<string>>();

/** Icon names come from the manifest and are interpolated into a request path. */
const SAFE_ICON_NAME = /^[a-zA-Z0-9._-]+$/;

/**
 * Icons live in `public/icons` and are fetched one by one so a repository only
 * pays for the handful of icons its tree actually shows.
 */
export const loadIconSvg = async (name: string): Promise<string> => {
  if (!SAFE_ICON_NAME.test(name)) {
    return "";
  }

  const cached = iconSvgCache.get(name);
  if (cached !== undefined) {
    return cached;
  }

  const pending = pendingIconSvgs.get(name);
  if (pending) {
    return pending;
  }

  const request = fetch(`${import.meta.env.BASE_URL}icons/${name}.svg`)
    .then((response) => (response.ok ? response.text() : ""))
    .catch(() => "")
    .then((svg) => {
      iconSvgCache.set(name, svg);
      pendingIconSvgs.delete(name);
      return svg;
    });

  pendingIconSvgs.set(name, request);

  return request;
};

export const initMonaco = async (): Promise<Monaco> => loader.init();

/** Resolving the token costs a style recalc, so each palette is read once. */
const editorBackgrounds = new Map<string, string>();

/**
 * Monaco themes only take hex, so the app's `--editor-background` — a
 * `color-mix()` over `oklch()` tokens — has to be resolved to a concrete
 * colour. A probe carrying the target `data-theme` reads either palette no
 * matter which one is currently mounted, and a 1x1 canvas converts whatever
 * colour space the browser reports back the way the compositor would.
 */
const resolveEditorBackground = (
  theme: "dark" | "light",
): string | undefined => {
  const cached = editorBackgrounds.get(theme);
  if (cached) return cached;

  const host = globalThis.document?.body;
  if (!host) return undefined;

  const probe = document.createElement("div");
  probe.dataset.theme = theme;
  probe.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;background-color:var(--editor-background)";
  host.append(probe);
  const computed = getComputedStyle(probe).backgroundColor;
  probe.remove();

  if (
    !computed ||
    computed === "transparent" ||
    computed === "rgba(0, 0, 0, 0)"
  ) {
    return undefined;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return undefined;

  context.fillStyle = computed;
  context.fillRect(0, 0, 1, 1);

  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  const hex = `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;

  editorBackgrounds.set(theme, hex);

  return hex;
};

/**
 * Every Monaco surface that has to read as "the editor background": the code
 * area, the left gutter, the sticky-scroll header and its own gutter, and the
 * minimap and overview ruler on the right.
 */
const EDITOR_SURFACE_COLORS = [
  "editor.background",
  "editorGutter.background",
  "editorStickyScroll.background",
  "editorStickyScrollGutter.background",
  "minimap.background",
  "editorOverviewRuler.background",
] as const;

export const defineThemes = (
  highlighter: Awaited<ReturnType<typeof createHighlighter>>,
  monaco: { editor: { defineTheme: (name: string, data: unknown) => void } },
) => {
  for (const name of highlighter.getLoadedThemes()) {
    const resolved = highlighter.getTheme(name);
    const converted = textmateThemeToMonacoTheme(resolved) as {
      colors: Record<string, string>;
    };

    const isDark = resolved.type === "dark";
    // Falls back to Monaco's own shades if the stylesheet has not landed yet.
    const background =
      resolveEditorBackground(isDark ? "dark" : "light") ??
      (isDark ? "#1e1e1e" : "#ffffff");

    if (isDark) {
      converted.colors["editor.lineHighlightBackground"] = "#2c2c2c";
      converted.colors["editorLineNumber.foreground"] = "#858585";
      converted.colors["minimapSlider.background"] = "#ffffff15";
      converted.colors["minimapSlider.hoverBackground"] = "#ffffff25";
      converted.colors["minimapSlider.activeBackground"] = "#ffffff35";
    }

    // Monaco resolves unset colors from its own registry defaults, which leaves
    // the gutter, the sticky-scroll header and the overview ruler on the right
    // painting their own shade. Pinning every surface to `background` keeps the
    // editor a single flat colour edge to edge.
    for (const surface of EDITOR_SURFACE_COLORS) {
      converted.colors[surface] = background;
    }

    converted.colors["editorOverviewRuler.border"] = "#00000000";
    converted.colors["editorStickyScroll.border"] = "#00000000";
    converted.colors["editorStickyScroll.shadow"] = "#00000000";
    converted.colors["scrollbar.shadow"] = "#00000000";
    converted.colors["scrollbarSlider.background"] = isDark
      ? "#ffffff15"
      : "#00000015";
    converted.colors["scrollbarSlider.hoverBackground"] = isDark
      ? "#ffffff30"
      : "#00000030";
    converted.colors["scrollbarSlider.activeBackground"] = isDark
      ? "#ffffff50"
      : "#00000050";

    monaco.editor.defineTheme(name, converted);
  }
};

let highlighterPromise: Promise<Awaited<ReturnType<typeof createHighlighter>>> | null =
  null;

export const getHighlighter = () => {
  if (highlighterPromise) return highlighterPromise;

  highlighterPromise = createHighlighter({
    // Oniguruma costs ~230 KiB of transfer but tokenizes 1.5-3x faster than
    // the pure-JS engine, which matters more here: the first paint of a file
    // is bound by main-thread time, not bandwidth.
    langs: [...CORE_LANGS],
    themes: ["dark-plus", "light-plus"],
  });

  return highlighterPromise;
};

export const shikiSetup =
  "location" in globalThis
    ? (async () => {
        const highlighter = await getHighlighter();
        const monaco = await initMonaco();

        const restoreTheme = () => {
          const dark =
            document.documentElement.getAttribute("data-theme") !== "light";
          (monaco as any).editor.setTheme(dark ? "dark-plus" : "light-plus");
        };

        const applyThemes = () =>
          defineThemes(
            highlighter,
            monaco as {
              editor: { defineTheme: (name: string, data: unknown) => void };
            },
          );

        shikiToMonaco(highlighter, monaco);
        applyThemes();
        restoreTheme();

        // Nothing resolved means the stylesheet landed after Monaco did, so the
        // themes are still on the fallback shades; one frame later it is there.
        if (editorBackgrounds.size === 0) {
          requestAnimationFrame(() => {
            applyThemes();
            restoreTheme();
          });
        }

        return highlighter;
      })()
    : null;

export const ensureLanguage = async (lang: string) => {
  if (!shikiSetup) return;
  const highlighter = await shikiSetup;
  const monaco = await initMonaco();

  if (!highlighter.getLoadedLanguages().includes(lang)) {
    try {
      await highlighter.loadLanguage(lang as any);
      // `shikiToMonaco` re-defines the themes straight from the TextMate data,
      // so the surface overrides have to be re-applied or the gutter and the
      // minimap snap back to their registry defaults.
      shikiToMonaco(highlighter, monaco);
      defineThemes(
        highlighter,
        monaco as {
          editor: { defineTheme: (name: string, data: unknown) => void };
        },
      );
      const dark =
        document.documentElement.getAttribute("data-theme") !== "light";
      (monaco as any).editor.setTheme(dark ? "dark-plus" : "light-plus");
    } catch (e) {
      console.error(`Failed to load Shiki language: ${lang}`, e);
    }
  }
};

/** Already-fetched markup for `name`, or an empty string while it loads. */
export const getSvg = (name: string): string => iconSvgCache.get(name) ?? "";

export const resolveFileIcon = (filename: string): string => {
  if (!iconManifest) {
    return "";
  }

  const lowerFilename = filename.toLowerCase();
  if (iconManifest.fileNames[lowerFilename]) {
    return iconManifest.fileNames[lowerFilename];
  }

  const extensionWithDot = lowerFilename.includes(".")
    ? lowerFilename.slice(lowerFilename.indexOf(".") + 1)
    : "";

  if (extensionWithDot && iconManifest.fileExtensions[extensionWithDot]) {
    return iconManifest.fileExtensions[extensionWithDot];
  }

  const lastExtension = lowerFilename.split(".").at(-1) ?? "";
  if (lastExtension && iconManifest.fileExtensions[lastExtension]) {
    return iconManifest.fileExtensions[lastExtension];
  }

  const languageId = EXT_TO_LANG[lastExtension];
  if (languageId && iconManifest.languageIds[languageId]) {
    return iconManifest.languageIds[languageId];
  }

  return iconManifest.file;
};

export const resolveFolderIcon = (
  folderName: string,
  open: boolean,
): string => {
  if (!iconManifest) {
    return "";
  }

  const lowerFolderName = folderName.toLowerCase();

  if (open) {
    return (
      iconManifest.folderNamesExpanded[lowerFolderName] ??
      iconManifest.folderExpanded
    );
  }

  return (
    iconManifest.folderNames[lowerFolderName] ?? iconManifest.folder
  );
};

/** Empty until the icon for `filename` has been fetched — see `loadIconSvg`. */
export const getIconSvg = (filename: string): string =>
  getSvg(resolveFileIcon(filename));

export const langOf = (path: string): string =>
  LANG[path.split(".").at(-1) ?? ""] ?? "plaintext";

export const extOf = (path: string) =>
  path.split(".").at(-1)?.toLowerCase() ?? "";

export const monoFont = (): string => {
  if (cachedMonoFont !== undefined) return cachedMonoFont;
  if (typeof document === "undefined") return "";
  cachedMonoFont = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-mono")
    .trim();
  return cachedMonoFont;
};

export const compactFolder = (
  item: TreeDataItem,
): { children: TreeDataItem[]; name: string } => {
  let current = item;
  let merged = item.name;

  for (;;) {
    const firstChild = current.children?.[0];

    if (!firstChild?.children || current.children?.length !== 1) {
      break;
    }

    current = firstChild;
    merged += `/${current.name}`;
  }

  return { children: current.children ?? [], name: merged };
};

export const extractTabs = (children: ReactNode): TabProps[] => {
  const tabs: TabProps[] = [];

  Children.forEach(children, (child) => {
    if (
      isValidElement(child) &&
      (child.type as { _type?: symbol })._type === TAB_TYPE
    ) {
      tabs.push(child.props as TabProps);
    }
  });

  return tabs;
};

export const getTabId = (tab: TabProps) => tab.id ?? tab.title;

export const useAltKeys = (
  bindings: Record<string, () => void>,
  enabled: boolean,
) => {
  const ref = useRef(bindings);
  useEffect(() => {
    ref.current = bindings;
  });
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }

      const fn = ref.current[event.code];

      if (fn) {
        event.preventDefault();
        fn();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [enabled]);
};

export const deduplicateTitle = (
  name: string,
  path: string,
  existingPanels: { id: string; title: string | undefined }[],
): string => {
  const hasDuplicate = existingPanels.some(
    (panel) => panel.title === name && panel.id !== path,
  );

  if (!hasDuplicate) {
    return name;
  }

  const parts = path.split("/");
  return parts.length >= 2 ? `${parts.at(-2)}/${name}` : name;
};

export const virtualFileId = (name: string) => `${VIRTUAL_PREFIX}${name}`;

export const flattenTree = (items: TreeDataItem[]): TreeDataItem[] => {
  const result: TreeDataItem[] = [];

  for (const item of items) {
    if (item.children) {
      for (const child of flattenTree(item.children)) {
        result.push(child);
      }
    } else {
      result.push(item);
    }
  }

  return result;
};

export const findSiblings = (
  tree: TreeDataItem[],
  pathParts: string[],
  depth: number,
): TreeDataItem[] => {
  let nodes = tree;

  for (let i = 0; i < depth; i += 1) {
    const match = nodes.find((node) => node.name === pathParts[i]);

    if (!match?.children) {
      return [];
    }

    nodes = match.children;
  }

  return nodes;
};

export const resolveLanguageIcon = (language: string): string => {
  if (!iconManifest) {
    return "";
  }

  if (iconManifest.languageIds[language]) {
    return iconManifest.languageIds[language];
  }

  for (const [extension, languageId] of Object.entries(EXT_TO_LANG)) {
    if (languageId === language && iconManifest.fileExtensions[extension]) {
      return iconManifest.fileExtensions[extension];
    }
  }

  return iconManifest.file;
};
