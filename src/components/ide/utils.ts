import type { Monaco } from "@monaco-editor/loader";
import { loader } from "@monaco-editor/react";
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
  ALL_LANGS,
  CORE_LANGS,
  EXT_TO_LANG,
  LANG,
  TAB_TYPE,
  VIRTUAL_PREFIX,
} from "./constants";
import type { IconManifest, TabProps, TreeDataItem } from "./types";

let iconManifest: IconManifest | null = null;
let iconSvgs: Record<string, string> = {};
let cachedMonoFont: string | undefined;

export const iconsReady =
  "location" in globalThis
    ? import("../_generated/icons").then(
        (mod: {
          icons: { manifest: IconManifest; svgs: Record<string, string> };
        }) => {
          iconManifest = mod.icons.manifest;
          iconSvgs = mod.icons.svgs;
        },
      )
    : Promise.resolve();

export const getIconManifest = () => iconManifest;

export const initMonaco = async (): Promise<Monaco> => loader.init();

export const defineThemes = (
  highlighter: Awaited<ReturnType<typeof createHighlighter>>,
  m: { editor: { defineTheme: (name: string, data: unknown) => void } },
) => {
  for (const name of highlighter.getLoadedThemes()) {
    const resolved = highlighter.getTheme(name);
    const converted = textmateThemeToMonacoTheme(resolved) as {
      colors: Record<string, string>;
    };

    const isDark = resolved.type === "dark";
    if (isDark) {
      converted.colors["editor.background"] = "#1e1e1e";
      converted.colors["editor.lineHighlightBackground"] = "#2c2c2c";
      converted.colors["editorLineNumber.foreground"] = "#858585";
      converted.colors["minimap.background"] = "#1e1e1e";
      converted.colors["minimapSlider.background"] = "#ffffff15";
      converted.colors["minimapSlider.hoverBackground"] = "#ffffff25";
      converted.colors["minimapSlider.activeBackground"] = "#ffffff35";
    } else {
      converted.colors["editor.background"] = "#ffffff";
      converted.colors["minimap.background"] = "#ffffff";
    }
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
    m.editor.defineTheme(name, converted);
  }
};

export const shikiSetup =
  "location" in globalThis
    ? (async () => {
        const highlighter = await createHighlighter({
          langs: [...CORE_LANGS],
          themes: ["dark-plus", "light-plus"],
        });

        const monaco = await initMonaco();
        shikiToMonaco(highlighter, monaco);
        defineThemes(
          highlighter,
          monaco as {
            editor: { defineTheme: (name: string, data: unknown) => void };
          },
        );

        const remaining = ALL_LANGS.filter(
          (l) => !CORE_LANGS.includes(l as (typeof CORE_LANGS)[number]),
        );
        if (remaining.length > 0)
          highlighter
            .loadLanguage(...remaining)
            .then(() => {
              shikiToMonaco(highlighter, monaco);
              defineThemes(
                highlighter,
                monaco as {
                  editor: {
                    defineTheme: (name: string, data: unknown) => void;
                  };
                },
              );
            })
            .catch(() => undefined);
      })()
    : null;

export const getSvg = (name: string): string =>
  iconSvgs[name] ?? (iconManifest ? (iconSvgs[iconManifest.file] ?? "") : "");

export const resolveFileIcon = (filename: string): string => {
  if (!iconManifest) return "";

  const lower = filename.toLowerCase();
  if (iconManifest.fileNames[lower]) return iconManifest.fileNames[lower];

  const ext = lower.includes(".") ? lower.slice(lower.indexOf(".") + 1) : "";
  if (ext && iconManifest.fileExtensions[ext])
    return iconManifest.fileExtensions[ext];

  const lastExt = lower.split(".").at(-1) ?? "";
  if (lastExt && iconManifest.fileExtensions[lastExt])
    return iconManifest.fileExtensions[lastExt];

  const lang = EXT_TO_LANG[lastExt];
  if (lang && iconManifest.languageIds[lang])
    return iconManifest.languageIds[lang];
  return iconManifest.file;
};

export const resolveFolderIcon = (
  folderName: string,
  open: boolean,
): string => {
  if (!iconManifest) return "";

  const lower = folderName.toLowerCase();
  if (open)
    return (
      iconManifest.folderNamesExpanded[lower] ?? iconManifest.folderExpanded
    );
  return iconManifest.folderNames[lower] ?? iconManifest.folder;
};

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
    const only = current.children?.[0];
    if (!only?.children || current.children?.length !== 1) break;
    current = only;
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
    )
      tabs.push(child.props as TabProps);
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

    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;

      const fn = ref.current[e.code];
      if (fn) {
        e.preventDefault();
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
  const hasDupe = existingPanels.some((p) => p.title === name && p.id !== path);
  if (!hasDupe) return name;

  const parts = path.split("/");
  return parts.length >= 2 ? `${parts.at(-2)}/${name}` : name;
};

export const virtualFileId = (name: string) => `${VIRTUAL_PREFIX}${name}`;

export const flattenTree = (items: TreeDataItem[]): TreeDataItem[] => {
  const result: TreeDataItem[] = [];
  for (const item of items)
    if (item.children)
      for (const child of flattenTree(item.children)) result.push(child);
    else result.push(item);
  return result;
};

export const findSiblings = (
  tree: TreeDataItem[],
  pathParts: string[],
  depth: number,
): TreeDataItem[] => {
  let nodes = tree;
  for (let i = 0; i < depth; i += 1) {
    const match = nodes.find((n) => n.name === pathParts[i]);
    if (!match?.children) return [];
    nodes = match.children;
  }
  return nodes;
};

export const resolveLanguageIcon = (language: string): string => {
  if (!iconManifest) return "";
  if (iconManifest.languageIds[language])
    return iconManifest.languageIds[language];
  for (const [ext, lang] of Object.entries(EXT_TO_LANG))
    if (lang === language && iconManifest.fileExtensions[ext])
      return iconManifest.fileExtensions[ext];
  return iconManifest.file;
};
