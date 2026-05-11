import { Editor } from "@monaco-editor/react";
import type { IDockviewPanelProps } from "dockview-react";
import { useSetAtom } from "jotai";
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
import { monoFont, shikiSetup } from "../utils";

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
  const [dark, setDark] = useState(() =>
    document.documentElement.getAttribute("data-theme") === "dark",
  );

  useEffect(() => {
    if (shikiSetup)
      shikiSetup.then(() => setReady(true)).catch(() => setReady(true));

    const observer = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute("data-theme") === "dark"),
    );
    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const d = api.onDidParametersChange((e) => {
      const p = e as any;
      if (p.content !== undefined) {
        setContent(p.content);
        setLoadingState(undefined);
        if (isVirtual)
          requestAnimationFrame(() => {
            const lineCount = (p.content ?? "").split("\n").length;
            editorRef.current?.revealLine(lineCount);
          });
      }
      if (p.language !== undefined) setLanguage(p.language);
      if (p.loading !== undefined) setLoadingState(p.loading);
      if (p.editorOptions !== undefined) setEditorOpts(p.editorOptions);
    });
    return () => d.dispose();
  }, [api, isVirtual]);

  const setCursor = useSetAtom(cursorAtom);
  const setFileInfo = useSetAtom(activeFileInfoAtom);

  useEffect(() => {
    if (api.isActive) setFileInfo({ language, path: api.id });
    const d = api.onDidActiveChange((e) => {
      if (e.isActive) setFileInfo({ language, path: api.id });
    });
    return () => d.dispose();
  }, [api, language, setFileInfo]);

  if (loadingState || !ready)
    return (
      <div className="flex h-full flex-col gap-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );

  if (!content)
    return (
      <div className={cn(CENTER, "text-muted-foreground text-xs")}>
        Empty file
      </div>
    );

  const pathParts = api.id.split("/");

  return (
    <div className="flex h-full flex-col">
      <Breadcrumb className="border-border border-b px-3 py-1">
        <BreadcrumbList className="flex-nowrap gap-1 text-xs sm:gap-1">
          {pathParts.flatMap((part, i) => {
            const items: ReactNode[] = [];
            if (i > 0) items.push(<BreadcrumbSeparator key={`sep-${part}`} />);
            items.push(
              <BreadcrumbSegment
                depth={i}
                isLast={i === pathParts.length - 1}
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
          const update = () => {
            const pos = editor.getPosition();
            if (pos) setCursor({ col: pos.column, line: pos.lineNumber });
          };
          update();
          editor.onDidChangeCursorPosition(update);
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
            : dark
              ? (params.theme?.dark ?? "dark-plus")
              : (params.theme?.light ?? "light-plus")
        }
        value={content}
      />
    </div>
  );
};
