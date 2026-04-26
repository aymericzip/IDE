import { useEffect, useMemo, useState } from 'react';

import Explorer from './explorer';
import { Providers } from './providers';
import { fetchTree } from './repo-api';
import { repoFromSearch } from './url-utils';

import './ide.css';

function IdeApp() {
  const initialRepo = useMemo(
    () => repoFromSearch(window.location.search),
    []
  );
  const [entry, setEntry] = useState<{
    repo: string;
    tree: Awaited<ReturnType<typeof fetchTree>>;
  } | null>(null);
  const [loadError, setLoadError] = useState<null | string>(null);
  useEffect(() => {
    let alive = true;
    setEntry(null);
    setLoadError(null);
    void (async () => {
      const tree = await fetchTree(initialRepo);
      if (!alive) return;
      if (tree.length === 0)
        setLoadError(
          'Could not load a file tree. Check `?repo=owner/name` or `?url=…github…`.'
        );
      else setEntry({ repo: initialRepo, tree });
    })();
    return () => {
      alive = false;
    };
  }, [initialRepo]);
  if (loadError) {
    return (
      <div className="text-destructive p-4 text-sm">
        <p className="font-medium">{loadError}</p>
        <p className="text-muted-foreground mt-2 text-xs">
          Add <code className="rounded bg-muted px-1">?repo=owner/name</code> or{' '}
          <code className="rounded bg-muted px-1">?url=https://github.com/…</code>
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
  return <Explorer initialRepo={entry.repo} initialTree={entry.tree} />;
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
