import { SiGithub } from '@icons-pack/react-simple-icons';
import type { TreeDataItem, WorkspaceRef } from 'idecn';
import { Workspace } from 'idecn';
import {
  AlertTriangle,
  Moon,
  PanelLeft,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  downloadFile,
  downloadFolder,
  fetchFile,
  fetchTree,
} from './repo-api';
import { EXPAND_EXCLUDE } from './constants';
import { repoFromInput } from './url-utils';

const triggerDownload = (base64: string, filename: string) => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.codePointAt(0) ?? 0);
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const Explorer = ({
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
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const ref = useRef<WorkspaceRef>(null);

  useEffect(() => {
    setRepo(initialRepo);
    setInput(initialRepo);
  }, [initialRepo]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setError(null);
    if (repo === initialRepo) {
      setTree(initialTree);
      return;
    }
    void (async () => {
      const t = await fetchTree(repo);
      setTree(t);
      if (t.length === 0) setError('Failed to load repo tree');
    })();
  }, [initialRepo, initialTree, repo]);

  const submit = () => {
    const parsed = repoFromInput(input);
    if (!parsed || parsed === repo) return;
    setInput(parsed);
    setRepo(parsed);
    const params = new URLSearchParams(window.location.search);
    params.set('repo', parsed);
    params.delete('url');
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center *:transition-all *:duration-300">
        <PanelLeft
          className="-mr-2 size-8 shrink-0 cursor-pointer p-2 stroke-1 hover:bg-accent hover:p-1.5"
          onClick={() => ref.current?.toggleSidebar()}
        />
        <Search
          className="size-8 shrink-0 cursor-pointer p-2 stroke-1 hover:bg-accent hover:p-1.5"
          onClick={submit}
        />
        <input
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="owner/repo or GitHub URL"
          type="search"
          value={input}
        />
        <a
          className="-mr-2 flex size-8 shrink-0 cursor-pointer items-center justify-center p-2 stroke-1 hover:bg-accent hover:p-1.5"
          href={`https://github.com/${repo}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          <SiGithub className="mb-0.5 size-full" />
        </a>
        <button
          className="size-8 shrink-0 cursor-pointer p-1.5 stroke-1 hover:bg-accent hover:p-1"
          onClick={() => {
            setTheme(mounted && resolvedTheme === 'dark' ? 'light' : 'dark');
          }}
          type="button"
        >
          {mounted && resolvedTheme === 'dark' ? (
            <Sun className="size-full stroke-1" />
          ) : (
            <Moon className="size-full stroke-1" />
          )}
        </button>
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
    </div>
  );
};

export default Explorer;
