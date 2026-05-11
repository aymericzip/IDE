import { AlertTriangle } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { fetchTree } from './repo-api';
import { filesFromSearch, repoFromLocation } from './url-utils';
import './ide.css';
import { Providers } from './providers';

const Explorer = lazy(() =>
  import('./explorer').then((mod) => ({ default: mod.Explorer }))
);

const NoRepo = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="size-8 text-amber-500" />
      <p className="font-medium text-sm">No repository specified</p>
      <p className="text-muted-foreground text-xs">
        Open <code className="rounded bg-muted px-1">/owner/repo</code> (e.g.{' '}
        <code className="rounded bg-muted px-1">/facebook/react</code>
        ), or use legacy{' '}
        <code className="rounded bg-muted px-1">?repo=owner/name</code> /{' '}
        <code className="rounded bg-muted px-1">?url=https://github.com/…</code>
      </p>
    </div>
  );
};

const IdeApp = () => {
  const initialRepo = useMemo(
    () => repoFromLocation(window.location.pathname, window.location.search),
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
    void import('./explorer');
  }, [initialRepo]);

  useEffect(() => {
    if (!initialRepo) return;
    let alive = true;
    setEntry(null);
    setLoadError(null);
    void (async () => {
      const tree = await fetchTree(initialRepo);
      if (!alive) return;
      if (tree.length === 0)
        setLoadError('Could not load a file tree. Check the repo name or URL.');
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
        <p className="font-medium text-destructive text-sm">{loadError}</p>
        <p className="text-muted-foreground text-xs">
          Check <code className="rounded bg-muted px-1">/owner/repo</code> or
          legacy <code className="rounded bg-muted px-1">?repo=</code> /{' '}
          <code className="rounded bg-muted px-1">?url=</code>
        </p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground text-sm">
          <span className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-transparent" />
          Loading editor…
        </div>
      }
    >
      <Explorer
        initialFiles={initialFiles}
        initialRepo={entry.repo}
        initialTree={entry.tree}
      />
    </Suspense>
  );
};

export const App = () => {
  return (
    <Providers>
      <div className="h-dvh min-h-0 w-full">
        <IdeApp />
      </div>
    </Providers>
  );
};
