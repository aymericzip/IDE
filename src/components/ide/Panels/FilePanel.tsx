import { Editor } from "@monaco-editor/react";
import type { IDockviewPanelProps } from "dockview-react";
import { useSetAtom } from "jotai";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../breadcrumb";
import { cn } from "../../lib/utils";
import { Skeleton } from "../../skeleton";
import { activeFileInfoAtom, cursorAtom } from "../atoms";
import { BreadcrumbSegment } from "../Breadcrumbs";
import { CENTER, EDITOR_OPTIONS, VIRTUAL_PREFIX } from "../constants";
import { monoFont, shikiSetup, ensureLanguage } from "../utils";

export const FilePanel = ({
  api,
  params,
}: IDockviewPanelProps<{
  content: string;
  editorOptions?: Record<string, unknown>;
  language: string;
  loading?: ReactNode;
  theme?: string | { dark: string; light: string };
}>) => {
  const editorRef = useRef<null | any>(null);
  const isVirtual = api.id.startsWith(VIRTUAL_PREFIX);
  const [content, setContent] = useState(params.content);
  const [language, setLanguage] = useState(params.language);
  const [loadingState, setLoadingState] = useState(params.loading);
  const [editorOpts, setEditorOpts] = useState(params.editorOptions);
  const [ready, setReady] = useState(!shikiSetup);
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme !== "light";

  useEffect(() => {
    if (shikiSetup) {
      shikiSetup
        .then(() => ensureLanguage(language))
        .then(() => setReady(true))
        .catch(() => setReady(true));
    }
  }, [language]);

  useEffect(() => {
    const disposable = api.onDidParametersChange((event) => {
      const parameters = event;

      if (parameters.content !== undefined) {
        setContent(parameters.content);
        setLoadingState(undefined);

        if (isVirtual) {
          requestAnimationFrame(() => {
            const lineCount = (parameters.content ?? "").split("\n").length;
            editorRef.current?.revealLine(lineCount);
          });
        }
      }

      if (parameters.language !== undefined) {
        setLanguage(parameters.language);
      }

      if (parameters.loading !== undefined) {
        setLoadingState(parameters.loading);
      }

      if (parameters.editorOptions !== undefined) {
        setEditorOpts(parameters.editorOptions);
      }
    });

    return () => disposable.dispose();
  }, [api, isVirtual]);

  const setCursor = useSetAtom(cursorAtom);
  const setFileInfo = useSetAtom(activeFileInfoAtom);

  useEffect(() => {
    if (api.isActive) {
      setFileInfo({ language, path: api.id });
    }

    const disposable = api.onDidActiveChange((event) => {
      if (event.isActive) {
        setFileInfo({ language, path: api.id });
      }
    });

    return () => disposable.dispose();
  }, [api, language, setFileInfo]);

  if (loadingState || !ready) {
    return (
      <div className="flex h-full flex-col gap-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className={cn(CENTER, "text-muted-foreground text-xs")}>
        Empty file
      </div>
    );
  }

  const pathParts = api.id.split("/");

  return (
    <div className="flex h-full flex-col">
      <Breadcrumb className="border-border border-b px-3 py-1">
        <BreadcrumbList className="flex-nowrap gap-1 text-xs sm:gap-1">
          {pathParts.flatMap((part, index) => {
            const items: ReactNode[] = [];

            if (index > 0) {
              items.push(<BreadcrumbSeparator key={`sep-${part}`} />);
            }

            items.push(
              <BreadcrumbSegment
                depth={index}
                isLast={index === pathParts.length - 1}
                key={part}
                name={part}
                pathParts={pathParts}
              />,
            );

            return items;
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <Editor
        className="flex-1"
        language={language}
        onMount={(editor) => {
          editorRef.current = editor;

          const updateCursor = () => {
            const position = editor.getPosition();

            if (position) {
              setCursor({ col: position.column, line: position.lineNumber });
            }
          };

          updateCursor();

          editor.onDidChangeCursorPosition(updateCursor);
          api.onDidDimensionsChange(() => editor.layout());
        }}
        options={{
          ...EDITOR_OPTIONS,
          fontFamily: monoFont() || undefined,
          ...editorOpts,
        }}
        path={api.id}
        theme={
          typeof params.theme === "string"
            ? params.theme
            : isDarkMode
              ? (params.theme?.dark ?? "dark-plus")
              : (params.theme?.light ?? "light-plus")
        }
        value={content}
      />
    </div>
  );
};
