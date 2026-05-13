import { SiGithub } from "@icons-pack/react-simple-icons";
import type { TreeDataItem, WorkspaceProps, WorkspaceRef } from "idecn";
import { AlertTriangle, PanelLeft, X } from "lucide-react";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { SwitchThemeSwitcher } from "./components/switchTheme-switcher";
import { toast } from "sonner";
import { Link } from "./components/link";
import { EXPAND_EXCLUDE } from "./constants";
import { downloadFile, downloadFolder, fetchFile, fetchTree } from "./repo-api";
import { repoFromInput } from "./url-utils";
import { Button } from "./components/button";

const triggerDownload = (base64: string, filename: string) => {
  const bytes = Uint8Array.from(
    atob(base64),
    (char) => char.codePointAt(0) ?? 0,
  );
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
};

export const Explorer = ({
  initialRepo,
  initialTree,
  initialFiles,
}: {
  initialRepo: string;
  initialTree: TreeDataItem[];
  initialFiles: string[];
}) => {
  const [repo, setRepo] = useState(initialRepo);
  const [tree, setTree] = useState(initialTree);
  const [error, setError] = useState<null | string>(null);
  const [input, setInput] = useState(initialRepo);
  const ref = useRef<WorkspaceRef>(null);
  const [Workspace, setWorkspace] =
    useState<ComponentType<WorkspaceProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("idecn").then((mod) => {
      if (!cancelled) setWorkspace(() => mod.Workspace);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRepo(initialRepo);
    setInput(initialRepo);
  }, [initialRepo]);

  useEffect(() => {
    setError(null);
    if (repo === initialRepo) {
      setTree(initialTree);
      return;
    }
    void (async () => {
      const fetchedTree = await fetchTree(repo);
      setTree(fetchedTree);

      if (fetchedTree.length === 0) {
        setError("Failed to load repo tree");
      }
    })();
  }, [initialRepo, initialTree, repo]);

  const submit = () => {
    const parsed = repoFromInput(input);
    if (!parsed || parsed === repo) {
      return;
    }

    setInput(parsed);
    setRepo(parsed);

    const params = new URLSearchParams(window.location.search);
    params.delete("repo");
    params.delete("url");

    const queryString = params.toString();
    const path = `/${parsed}`;

    window.history.replaceState(
      null,
      "",
      queryString ? `${path}?${queryString}` : path,
    );
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-2 py-1 bg-muted *:transition-all *:duration-300">
        <Button
          Icon={PanelLeft}
          label="Toggle sidebar"
          size="icon-md"
          variant="hoverable"
          color="text"
          className="-mr-2 ml-1 size-8 shrink-0 cursor-pointer stroke-1 p-2 hover:bg-accent hover:p-1.5"
          onClick={() => ref.current?.toggleSidebar()}
        />

        <input
          autoComplete="off"
          className="ml-4 min-w-0 flex-1 bg-transparent text-xs outline-none"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="owner/repo or GitHub URL"
          type="search"
          value={input}
        />
        <Link
          label="GitHub"
          href={`https://github.com/${repo}`}
          target="_blank"
          color="text"
          variant="button-outlined"
          roundedSize="full"
          rel="noopener noreferrer nofollow"
          className="flex p-1 min-h-0 aspect-square cursor-pointer items-center justify-center rounded-full border-[1.3px]"
        >
          <SiGithub size={18} />
        </Link>
        <div className="mr-2">
          <SwitchThemeSwitcher />
        </div>
      </div>
      {error ? (
        <div className="flex items-center gap-2 border-border border-b bg-amber-500/10 px-3 py-2 text-amber-500 text-xs">
          <AlertTriangle className="size-3.5 shrink-0" />
          {error}
          <button
            className="ml-auto shrink-0 opacity-60 hover:opacity-100"
            onClick={() => setError(null)}
            type="button"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : null}
      {Workspace ? (
        <Workspace
          className="flex-1"
          expandDepth={2}
          expandExclude={EXPAND_EXCLUDE}
          fileActions={{
            onDownload: async (path) => {
              const file = await downloadFile(repo, path).catch(() => null);
              if (file) {
                triggerDownload(file.base64, file.name);
                toast(`Downloaded ${file.name}`);
                return;
              }
              const folder = await downloadFolder(repo, path).catch(() => null);
              if (folder) {
                triggerDownload(folder.base64, `${folder.name}.zip`);
                toast(`Downloaded ${folder.name}.zip`);
                return;
              }
              toast.error(`Failed to download "${path}"`);
            },
          }}
          initialFiles={initialFiles}
          onOpenFile={async (item) => {
            const content = await fetchFile(repo, item.path).catch(() => null);
            return content;
          }}
          ref={ref}
          tree={tree}
        />
      ) : (
        <div
          aria-busy="true"
          className="flex flex-1 animate-pulse flex-col gap-2 bg-muted/30 p-3"
          role="status"
        >
          <span className="sr-only">Loading editor</span>
          <div className="h-8 max-w-md rounded-md bg-muted" />
          <div className="flex min-h-0 flex-1 rounded-md bg-muted" />
        </div>
      )}
    </div>
  );
};
