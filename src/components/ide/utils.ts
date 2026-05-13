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
  monaco: { editor: { defineTheme: (name: string, data: unknown) => void } },
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

    monaco.editor.defineTheme(name, converted);
  }
};

let highlighterPromise: Promise<Awaited<ReturnType<typeof createHighlighter>>> | null =
  null;

export const getHighlighter = () => {
  if (highlighterPromise) return highlighterPromise;

  highlighterPromise = createHighlighter({
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

        shikiToMonaco(highlighter, monaco);
        defineThemes(
          highlighter,
          monaco as {
            editor: { defineTheme: (name: string, data: unknown) => void };
          },
        );
        restoreTheme();

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
      shikiToMonaco(highlighter, monaco);
      const dark =
        document.documentElement.getAttribute("data-theme") !== "light";
      (monaco as any).editor.setTheme(dark ? "dark-plus" : "light-plus");
    } catch (e) {
      console.error(`Failed to load Shiki language: ${lang}`, e);
    }
  }
};

export const getSvg = (name: string): string =>
  iconSvgs[name] ?? (iconManifest ? (iconSvgs[iconManifest.file] ?? "") : "");

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
