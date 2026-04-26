import { AlertTriangle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import Explorer from './explorer';
import { Providers } from './providers';
import { fetchTree } from './repo-api';
import { filesFromSearch, repoFromSearch } from './url-utils';

import './ide.css';

function NoRepo() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="size-8 text-amber-500" />
      <p className="text-sm font-medium">No repository specified</p>
      <p className="text-muted-foreground text-xs">
        Add{' '}
        <code className="bg-muted rounded px-1">?repo=owner/name</code> or{' '}
        <code className="bg-muted rounded px-1">
          ?url=https://github.com/…
        </code>{' '}
        to the URL
      </p>
    </div>
  );
}

function IdeApp() {
  const initialRepo = useMemo(
    () => repoFromSearch(window.location.search),
    []
  );
  const initialFiles = useMemo(
    () => filesFromSearch(window.location.search),
    []
  );
  const [entry, setEntry] = useState<{
    repo: string;
    tree: Awaited<ReturnType<typeof fetchTree>>;
  } | null>(null);
  const [loadError, setLoadError] = useState<null | string>(null);

  useEffect(() => {
    if (!initialRepo) return;
    let alive = true;
    setEntry(null);
    setLoadError(null);
    void (async () => {
      const tree = await fetchTree(initialRepo);
      if (!alive) return;
      if (tree.length === 0)
        setLoadError(
          'Could not load a file tree. Check the repo name or URL.'
        );
      else setEntry({ repo: initialRepo, tree });
    })();
    return () => {
      alive = false;
    };
  }, [initialRepo]);

  if (!initialRepo) return <NoRepo />;

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle className="size-8 text-amber-500" />
        <p className="text-destructive text-sm font-medium">{loadError}</p>
        <p className="text-muted-foreground text-xs">
          Add{' '}
          <code className="bg-muted rounded px-1">?repo=owner/name</code> or{' '}
          <code className="bg-muted rounded px-1">
            ?url=https://github.com/…
          </code>{' '}
          to the URL
        </p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <Explorer
      initialFiles={initialFiles}
      initialRepo={entry.repo}
      initialTree={entry.tree}
    />
  );
}

export default function App() {
  return (
    <Providers>
      <div className="h-dvh min-h-0 w-full">
        <IdeApp />
      </div>
    </Providers>
  );
}
